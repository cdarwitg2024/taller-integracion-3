-- =============================================================================
-- CoffeeFast — Pago con saldo de Wallet (atomico, anti doble pago)
-- =============================================================================
-- Reemplaza el checkout client-side de `App.tsx` (handleCheckout), que hoy
-- inserta `pedidos` y `detalles_pedido` en dos llamadas separadas: si la segunda
-- falla queda un pedido sin productos, y el saldo de la wallet no se toca nunca.
--
-- QUE GARANTIZA ESTA RPC (los 6 requisitos del taller)
--   1. Total           -> se recalcula en la base desde `productos.precio`.
--                          El cliente ya no puede inventar el monto.
--   2. Saldo disponible-> se lee con `SELECT ... FOR UPDATE` sobre la wallet.
--   3. Aprobado/rechazado -> devuelve JSON con `ok: true|false` y `motivo`.
--   4. Descuento del wallet -> el saldo de la wallet ES el medio de pago: se
--                          debita el total exacto. No hay descuento; el
--                          requisito es "se cobra desde la wallet".
--   5. Evitar doble pago-> UNIQUE en `pagos.pedido_id`.
--   6. Estado posterior -> el pedido queda 'Pagado' en la MISMA transaccion.
--
-- REGLA DE NEGOCIO
--   El pago solo se efectua con saldo suficiente. Si no alcanza, NO se crea el
--   pedido: la funcion devuelve el motivo y la app muestra "Saldo insuficiente
--   en la Wallet" conservando el carrito.
--
-- CONCURRENCIA
--   `FOR UPDATE` es lo que hace real la regla. Sin el, dos pagos simultaneos
--   pueden leer el mismo saldo y ambos "pasar" el check (lost update): se
--   entregarian dos cafes y se cobraría uno.
--
-- IDEMPOTENCIA
--   Todo el script se puede re-ejecutar sin error.
-- =============================================================================


-- =============================================================================
-- 1) UNIQUE ANTI DOBLE PAGO  (requisito 5)
-- =============================================================================
-- Es la red de seguridad real. Un `if` en JavaScript se puede saltar con dos
-- taps rapidos; un UNIQUE no.
--
-- POR QUE NO ALCANZA EL UNIQUE QUE YA EXISTE en `referencia_transaccion`:
-- una columna UNIQUE admite multiples NULL en Postgres, asi que hoy dos pagos
-- con `referencia_transaccion` NULL pasan los dos. El UNIQUE va sobre
-- `pedido_id`, que es NOT NULL y representa de verdad "un pago por pedido".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pagos'::regclass
      AND conname  = 'pagos_pedido_id_uniq'
  ) THEN
    -- Si el historico tuviera pagos duplicados, el ALTER fallaria y quedaria a
    -- medias. Se conserva el mas antiguo de cada grupo.
    DELETE FROM public.pagos p
    WHERE p.id NOT IN (
      SELECT MIN(id) FROM public.pagos GROUP BY pedido_id
    );

    ALTER TABLE public.pagos
      ADD CONSTRAINT pagos_pedido_id_uniq UNIQUE (pedido_id);
  END IF;
END $$;


-- =============================================================================
-- 2) METODO DE PAGO "WALLET"
-- =============================================================================
-- `pagos.metodo_pago_id` es FK a `metodos_pago`. Se crea la fila para que el
-- pago quede trazable en el historial y no dependa de un id magic.
INSERT INTO public.metodos_pago (codigo, nombre, tipo, requiere_referencia, activo)
VALUES ('WALLET', 'Saldo Wallet', 'wallet', false, true)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 3) LA RPC
-- =============================================================================
-- SECURITY DEFINER: la funcion corre con privilegios del owner, asi que puede
-- debitar la wallet de cualquier usuario. Es necesario porque `wallets` tiene
-- RLS y el UPDATE del cliente esta prohibido justamente para que nadie se
-- agregue saldo a si mismo.
--
-- SET search_path: fija el esquema de busqueda para que la funcion no sea
-- suceptible a injecting un objeto malicioso en otro esquema.
CREATE OR REPLACE FUNCTION public.procesar_pago(
  p_cafeteria_id  BIGINT,
  p_items         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id   BIGINT;
  v_wallet_id    BIGINT;
  v_saldo        INTEGER;
  v_total        INTEGER  := 0;
  v_item         JSONB;
  v_producto_id  BIGINT;
  v_cantidad     INTEGER;
  v_precio       NUMERIC;
  v_subtotal     NUMERIC;
  v_pedido_id    BIGINT;
  v_metodo_id    BIGINT;
  v_detalles     JSONB := '[]'::jsonb;
  v_faltantes    TEXT    := '';
BEGIN
  -- ---------------------------------------------------------------------------
  -- 3.1) Quien sos. `mi_usuario_id()` es SECURITY DEFINER justamente para que
  --      esta politica no sea recursiva (error 42P17).
  -- ---------------------------------------------------------------------------
  v_usuario_id := public.mi_usuario_id();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'sin_sesion'
      USING ERRCODE = '42501',
            HINT    = 'Tu sesion no tiene usuario interno. Registrate de nuevo.';
  END IF;

  IF p_cafeteria_id IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'carrito_vacio',
      'mensaje', 'El carrito esta vacio.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3.2) TOTAL: se recalcula desde la base, no se recibe del cliente.
  --      Tomar el precio vigente del producto es la unica forma de que el
  --      telefono no pueda pagar $100 un sándwich de $2.000. Cualquier `precio`
  --      que venga en el JSON se ignora a proposito.
  -- ---------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item ->> 'producto_id')::BIGINT;
    v_cantidad    := (v_item ->> 'cantidad')::INTEGER;

    IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'motivo', 'item_invalido',
        'mensaje', 'El carrito tiene un producto invalido.'
      );
    END IF;

    SELECT precio INTO v_precio
    FROM public.productos
    WHERE id = v_producto_id AND activo = true AND eliminado_en IS NULL;

    IF v_precio IS NULL THEN
      v_faltantes := v_faltantes || v_producto_id || ',';
      CONTINUE;
    END IF;

    v_subtotal := v_precio * v_cantidad;

    -- El precio vive en `productos.precio` (NUMERIC) pero el saldo vive en
    -- `wallets.saldo_actual` (INTEGER). Postgres NO compara INTEGER con NUMERIC
    -- implicitamente: si se mezclan, lanza error en vez de comparar. Por eso el
    -- cast es explicito.
    --
    -- Se castea POR SUBTOTAL y se acumula, no por precio unitario: castear cada
    -- unidad y despues multiplicar daria el redondeo equivocado (3 x 999
    -- truncado a 999 -> 2.997, pero si el precio fuera 999.60 -> 999 y el
    -- total real seria 2.998.80).
    v_total := v_total + round(v_subtotal)::INTEGER;

    v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
      'producto_id',     v_producto_id,
      'cantidad',        v_cantidad,
      'precio_unitario', v_precio,
      'subtotal',        v_subtotal
    ));
  END LOOP;

  IF v_faltantes <> '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'producto_no_disponible',
      'mensaje', 'Uno o mas productos ya no estan disponibles.',
      'productos', v_faltantes
    );
  END IF;

  IF v_total <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'total_invalido',
      'mensaje', 'El total del pedido no es valido.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3.3) WALLET + CANDADO  (requisitos 2 y 4)
  --      `FOR UPDATE` bloquea la fila: cualquier otra transaccion que intente
  --      leer o escribir esta wallet ESPERA aca. Eso elimina el lost update.
  -- ---------------------------------------------------------------------------
  SELECT w.id, w.saldo_actual
    INTO v_wallet_id, v_saldo
    FROM public.wallets w
   WHERE w.usuario_id = v_usuario_id
     FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'sin_wallet',
      'mensaje', 'Tu usuario no tiene Wallet.'
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3.4) REGLA DE NEGOCIO: saldo suficiente.
  --      Ambos lados ya son INTEGER, asi que la comparacion es valida.
  -- ---------------------------------------------------------------------------
  IF v_saldo < v_total THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'saldo_insuficiente',
      'mensaje', 'Saldo insuficiente en la Wallet',
      'saldo_disponible', v_saldo,
      'total', v_total,
      'faltante', v_total - v_saldo
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3.5) DEBITO  (requisito 4)
  --      El `CHECK (saldo_actual >= 0)` de la tabla es la segunda barrera: si
  --      algo se colara entre el check anterior y este UPDATE, Postgres lo
  --      rechaza igual.
  -- ---------------------------------------------------------------------------
  UPDATE public.wallets
     SET saldo_actual = saldo_actual - v_total
   WHERE id = v_wallet_id
  RETURNING saldo_actual INTO v_saldo;

  -- ---------------------------------------------------------------------------
  -- 3.6) PEDIDO  (requisitos 1 y 6)
  --      `usuario_id` y NO `auth_user_id`: esa columna NO existe en el esquema.
  --      El checkout viejo la mandaba y Postgres la ignoraba en silencio, dejando
  --      el pedido huerfano y sin_dueno, lo que ademas hacia fallar las
  --      politicas RLS de `pedidos`.
  --
  --      Estado 'Pagado' (con mayuscula) para ser consistente con
  --      `setup_movil_completo.sql:367`, que condiciona la cancelacion a
  --      `estado = 'Pagado'`.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.pedidos (
    usuario_id, cafeteria_id, total, estado, pago_estado, metodo_pago
  )
  VALUES (
    v_usuario_id, p_cafeteria_id, v_total, 'Pagado', 'aprobado', 'wallet'
  )
  RETURNING id INTO v_pedido_id;

  -- ---------------------------------------------------------------------------
  -- 3.7) DETALLES
  -- ---------------------------------------------------------------------------
  INSERT INTO public.detalles_pedido (
    pedido_id, producto_id, cantidad, precio_unitario, subtotal
  )
  SELECT
    v_pedido_id,
    (d ->> 'producto_id')::BIGINT,
    (d ->> 'cantidad')::INTEGER,
    (d ->> 'precio_unitario')::NUMERIC,
    (d ->> 'subtotal')::NUMERIC
  FROM jsonb_array_elements(v_detalles) AS d;

  -- ---------------------------------------------------------------------------
  -- 3.8) ASIENTO DEL PAGO  (requisito 3)
  --      La referencia lleva el id del pedido, asi un reintento con el mismo
  --      pedido choca contra el UNIQUE de la seccion 1.
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_metodo_id
    FROM public.metodos_pago WHERE codigo = 'WALLET' LIMIT 1;

  INSERT INTO public.pagos (
    pedido_id, metodo_pago_id, monto, estado, es_simulado, referencia_transaccion
  )
  VALUES (
    v_pedido_id, v_metodo_id, v_total, 'aprobado', false,
    'wallet-pedido-' || v_pedido_id::TEXT
  );

  -- ---------------------------------------------------------------------------
  -- 3.9) MOVIMIENTO DE WALLET  (historial del Perfil)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.movimientos_wallet (
    wallet_id, pedido_id, tipo, monto, descripcion
  )
  VALUES (
    v_wallet_id, v_pedido_id, 'compra', -v_total,
    'Compra cafeteria #' || p_cafeteria_id::TEXT
  );

  -- ---------------------------------------------------------------------------
  -- 3.10) RESPUESTA
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido_id,
    'total', v_total,
    'saldo_restante', v_saldo,
    'estado', 'Pagado',
    'pago_estado', 'aprobado'
  );
END;
$$;

-- Solo el usuario autenticado puede invocarla.
REVOKE ALL ON FUNCTION public.procesar_pago(BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.procesar_pago(BIGINT, JSONB) TO authenticated;


-- =============================================================================
-- 4) CERRAR LA PUERTA DE TRASERA: el cliente NO puede editar su saldo
-- =============================================================================
-- `setup_movil_completo.sql:261` creo `wallets_update_own`, que deja al usuario
-- autenticado hacer UPDATE sobre su PROPIA wallet. Con ella, un estudiante
-- puede ejecutar desde la app:
--
--     supabase.from('wallets').update({ saldo_actual: 999999 }).eq(...)
--
-- y convertirse en millonario. Ese UPDATE libre es el que hace hoy
-- `WalletScreen.tsx:304-308` en la recarga.
--
-- El saldo solo puede cambiar por la via de `procesar_pago`. La recarga queda
-- fuera de este taller: cuando se implemente, debe ser una RPC que valide el
-- medio de pago, no un UPDATE abierto.
--
-- Se conservan `wallets_select_own` (leer el saldo si) y `wallets_insert_own`
-- (crear la fila propia al registrarse). Lo que se elimina es poder MODIFICARLA.
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
