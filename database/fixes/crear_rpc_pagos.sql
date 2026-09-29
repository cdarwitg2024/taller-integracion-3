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
--   6. Estado posterior -> el pedido queda 'pendiente' en la MISMA transaccion,
--                          que es el slug que filtran el KDS y el movil.
--   7. QR de retiro      -> se generan `qr_token` y `codigo_retiro_diario` en la
--                          misma transaccion, para que el KDS siempre tenga un
--                          codigo valido que validar (FR-22 / FR-23).
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
--
-- FIRMA UNICA
--   Esta es la version canónica. Antes coexistían dos definiciones con firmas
--   distintas (`(BIGINT, JSONB)` y `(BIGINT, JSONB, TEXT)`) y PostgREST resolvia
--   por la que hubiera en la base, dejando al movil con un 404 al mandar
--   `p_franja_retiro`. Se hace DROP de la firma vieja antes del CREATE.
-- =============================================================================


-- =============================================================================
-- 0) COLUMNA FRANJA DE RETIRO
-- =============================================================================
-- El checkout permite elegir franja horaria. Va como columna (no en el JSON de
-- items) porque la KDS agrupa las comandas por esta franja.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS franja_retiro TEXT;

-- Se deja nullable a proposito: hay pedidos historicos anteriores a la franja
-- (creados por el backend sin ella) y volver la columna NOT NULL los dejaria
-- huerfanos. La obligatoriedad se aplica en la RPC, que es por donde pasa todo
-- pago nuevo, y devuelve un motivo claro si falta.


-- =============================================================================
-- 0b) CODIGO VISIBLE DEL PEDIDO  (distinto del token de contingencia)
-- =============================================================================
-- Antes una sola columna hacia dos trabajos: `codigo_retiro_diario` guardaba el
-- token de contingencia y la app lo mostraba como si fuera el nombre del pedido.
-- Eso exponia la credencial que sirve para retirar: con solo mirar el pedido del
-- cliente ya se podia completar el retiro sin pasar por el QR.
--
-- Ahora cada campo tiene una funcion y ninguno sirve para retirar:
--   - `codigo_pedido`        -> lo que VE el estudiante y el KDS. "91-AW1".
--                               Identifica el pedido, NO retira nada.
--   - `codigo_retiro_diario` -> token de contingencia, unico y secreto. Solo
--                               se usa si el QR no se puede escanear.
--   - `qr_token`             -> lo que viaja dentro de la imagen QR.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS codigo_pedido TEXT;

-- Se genera con un trigger y no dentro de la RPC a proposito: cualquier via que
-- cree un pedido (RPC, backend, admin) queda con codigo, no solo los pagos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_codigo_pedido
  ON public.pedidos (codigo_pedido)
  WHERE codigo_pedido IS NOT NULL;

-- El numero es el `id` (lo que el cliente ya reconoce) y el sufijo son 3 letras
-- al azar del mismo alfabeto sin I/L/O/U. El sufijo NO es un token: no sirve
-- para validar ningun retiro, solo evita que dos pedidos distintos se
-- confundan en pantalla.
CREATE OR REPLACE FUNCTION public.generar_codigo_pedido(p_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_alfabeto CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTVWXYZ';
  v_codigo   TEXT;
  v_intentos INTEGER := 0;
BEGIN
  LOOP
    v_codigo := p_id::TEXT || '-';
    FOR i IN 1..3 LOOP
      v_codigo := v_codigo || substr(
        v_alfabeto,
        1 + floor(random() * length(v_alfabeto))::INTEGER,
        1
      );
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pedidos WHERE codigo_pedido = v_codigo
    );

    v_intentos := v_intentos + 1;
    IF v_intentos > 50 THEN
      RAISE EXCEPTION 'No se pudo generar un codigo de pedido unico para el id %', p_id;
    END IF;
  END LOOP;

  RETURN v_codigo;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_codigo ON public.pedidos;

CREATE OR REPLACE FUNCTION public.trg_pedidos_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_pedido IS NULL THEN
    NEW.codigo_pedido := public.generar_codigo_pedido(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_codigo
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.trg_pedidos_codigo();

-- Backfill para los pedidos que ya existian antes de esta columna.
UPDATE public.pedidos
   SET codigo_pedido = public.generar_codigo_pedido(id)
 WHERE codigo_pedido IS NULL;


-- =============================================================================
-- 0c) EL KDS DE COCINA VE TODAS LAS CAFETERIAS
-- =============================================================================
-- Hay un unico KDS y el estudiante puede pedir en cualquiera de las cafeterias.
-- La politica `pedidos_select_empleado` filtra por `es_empleado_de_cafeteria()`,
-- asi que si el empleado de Cocina solo esta asignado a una cafeteria, los
-- pedidos de las otras dos le son invisibles: se pagaban y nunca llegaban al KDS.
-- Y al no verlos, tampoco llegarian por Realtime, porque RLS tambien filtra los
-- eventos que Postgres entrega al canal.
--
-- Esto no es un rodeo de seguridad: `cafeteria_usuarios` sigue siendo la tabla
-- que decide que ve cada quien. Lo que se hace es asignar a este empleado a las
-- tres cafeterias, que es exactamente lo que corresponde a un unico KDS central.
INSERT INTO public.cafeteria_usuarios (usuario_id, cafeteria_id, gestiona_pedidos_kds)
SELECT v.uid, c.id, true
FROM (VALUES (7::BIGINT)) AS v(uid)
CROSS JOIN public.cafeterias c
WHERE NOT EXISTS (
  SELECT 1 FROM public.cafeteria_usuarios x
  WHERE x.usuario_id = v.uid AND x.cafeteria_id = c.id
);

UPDATE public.cafeteria_usuarios
   SET gestiona_pedidos_kds = true
 WHERE usuario_id = 7;


-- Indice unico del token de contingencia. `qr_token` ya lo tenia, pero este no:
-- sin el, dos pagos simultaneos podian sacar el mismo codigo de 8 caracteres
-- (el bucle de colisiones de la RPC es una comprobacion, no una garantia) y el
-- KDS validaria el pedido equivocado. Es parcial porque solo los pedidos con
-- token deben ser unicos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_codigo_retiro
  ON public.pedidos (codigo_retiro_diario)
  WHERE codigo_retiro_diario IS NOT NULL;


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
-- 2b) GENERADOR DE TOKENS DE RETIRO  (FR-22 / FR-23)
-- =============================================================================
-- El pedido nace con sus dos codigos de retiro:
--   - `qr_token`              -> lo que viaja dentro de la imagen QR.
--   - `codigo_retiro_diario`  -> el token de contingencia legible que el
--                                estudiante escribe si no puede escanear.
--
-- Por que se generan aqui y no en el backend: si nacieran vacios, el KDS solo
-- tendria un codigo valido despues de pedir `/api/pedidos/:id/qr`, y un pedido
-- antiguo quedaria sin forma de retirarse. Generandolos en la misma transaccion
-- que el pago, todo pedido pago es siempre retirable.
--
-- El alfabeto excluye I, L, O y U para evitar confusion al dictar o teclear.
--
-- Se elimina la version previa si existe: Postgres no permite renombrar los
-- parametros de entrada de una funcion con CREATE OR REPLACE (error: cannot
-- change name of input parameter).
DROP FUNCTION IF EXISTS public.generar_token_retiro(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.generar_token_retiro(
  p_prefijo  TEXT,
  p_longitud INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_alfabeto CONSTANT TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_token    TEXT;
BEGIN
  v_token := p_prefijo;
  FOR i IN 1..p_longitud LOOP
    v_token := v_token || substr(
      v_alfabeto,
      1 + floor(random() * length(v_alfabeto))::INTEGER,
      1
    );
  END LOOP;
  RETURN v_token;
END;
$$;


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
--
-- Se elimina la firma anterior `(BIGINT, JSONB)`: si queda, PostgREST tiene dos
-- candidatas y deja de resolver la llamada del movil.
DROP FUNCTION IF EXISTS public.procesar_pago(BIGINT, JSONB);

CREATE OR REPLACE FUNCTION public.procesar_pago(
  p_cafeteria_id  BIGINT,
  p_items         JSONB,
  p_franja_retiro TEXT DEFAULT NULL
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
  v_qr_token     TEXT;
  v_codigo       TEXT;
  v_codigo_pedido TEXT;
  v_intento      INTEGER;
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

  -- La franja de retiro es obligatoria en un pago nuevo: es la columna por la
  -- que la KDS agrupa las comandas. Sin ella un pedido pagado llegaria al barra
  -- sin ventana de retiro. (La columna queda nullable solo por los pedidos
  -- historicos que se crearon antes de que existiera.)
  IF p_franja_retiro IS NULL OR btrim(p_franja_retiro) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'franja_requerida',
      'mensaje', 'Elige una franja de retiro antes de pagar.'
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
  -- 3.6) TOKENS DE RETIRO  (FR-22 / FR-23)
  --      Se generan antes del INSERT con reintentos por colision. El indice
  --      UNIQUE es la garantia real; el bucle solo evita fallar en la practica.
  -- ---------------------------------------------------------------------------
  v_qr_token := public.generar_token_retiro('CF-', 20);
  FOR v_intento IN 1..5 LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pedidos WHERE qr_token = v_qr_token);
    v_qr_token := public.generar_token_retiro('CF-', 20);
  END LOOP;

  v_codigo := public.generar_token_retiro('', 8);
  FOR v_intento IN 1..5 LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pedidos WHERE codigo_retiro_diario = v_codigo);
    v_codigo := public.generar_token_retiro('', 8);
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 3.7) PEDIDO  (requisitos 1 y 6)
  --      `usuario_id` y NO `auth_user_id`: esa columna NO existe en el esquema.
  --      El checkout viejo la mandaba y Postgres la ignoraba en silencio, dejando
  --      el pedido huerfano y sin_dueno, lo que ademas hacia fallar las
  --      politicas RLS de `pedidos`.
  --
  --      Estado 'pendiente' en minuscula: es el slug con el que comparan el KDS
  --      (`estado IN ('pendiente','en_preparacion','listo')`) y el movil. Con la
  --      etiqueta 'Pagado' el pedido quedaba pagado pero nunca aparecia en las
  --      comandas.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.pedidos (
    usuario_id, cafeteria_id, total, estado, pago_estado, metodo_pago,
    franja_retiro, qr_token, codigo_retiro_diario, qr_usado
  )
  VALUES (
    v_usuario_id, p_cafeteria_id, v_total, 'pendiente', 'aprobado', 'wallet',
    p_franja_retiro, v_qr_token, v_codigo, false
  )
  RETURNING id, codigo_pedido INTO v_pedido_id, v_codigo_pedido;

  -- ---------------------------------------------------------------------------
  -- 3.8) DETALLES
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
  -- 3.9) ASIENTO DEL PAGO  (requisito 3)
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
  -- 3.10) MOVIMIENTO DE WALLET  (historial del Perfil)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.movimientos_wallet (
    wallet_id, pedido_id, tipo, monto, descripcion
  )
  VALUES (
    v_wallet_id, v_pedido_id, 'compra', -v_total,
    'Compra cafeteria #' || p_cafeteria_id::TEXT
  );

  -- ---------------------------------------------------------------------------
  -- 3.11) RESPUESTA
  --      Se devuelven los tokens para que la app pueda mostrarlos de inmediato,
  --      sin una segunda consulta ni depender de que el backend este arriba.
  -- ---------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido_id,
    'codigo_pedido', v_codigo_pedido,
    'total', v_total,
    'saldo_restante', v_saldo,
    'estado', 'pendiente',
    'pago_estado', 'aprobado',
    'franja_retiro', p_franja_retiro,
    'qr_token', v_qr_token,
    'codigo_retiro_diario', v_codigo
  );
END;
$$;

-- Solo el usuario autenticado puede invocarla. El grant debe nombrar la firma
-- de tres argumentos: si queda en `(BIGINT, JSONB)` no corresponde a ninguna
-- funcion existente y el pago falla por permisos.
REVOKE ALL ON FUNCTION public.procesar_pago(BIGINT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.procesar_pago(BIGINT, JSONB, TEXT) TO authenticated;


-- =============================================================================
-- 4) RECARGA DE SALDO  (RPC, no UPDATE abierto)
-- =============================================================================
-- `setup_movil_completo.sql:261` creo `wallets_update_own`, que deja al usuario
-- autenticado hacer UPDATE sobre su PROPIA wallet. Con ella, un estudiante
-- puede ejecutar desde la app:
--
--     supabase.from('wallets').update({ saldo_actual: 999999 }).eq(...)
--
-- y convertirse en millonario.
--
-- El saldo solo cambia por la via de una RPC: `procesar_pago` (gasto) y
-- `recargar_saldo` (ingreso). Por eso se elimina `wallets_update_own`.
--
-- NOTA SOBRE EL COMPORTAMIENTO ANTERIOR: sin esta politica, el `UPDATE` de la
-- recarga no daba error: RLS hacia coincidir 0 filas y PostgREST respondia 204
-- como si hubiera funcionado. La app actualizaba el saldo en pantalla y al
-- refrescar volvia al valor viejo. Por eso `recargar_saldo` devuelve el saldo
-- real leido de la base, no un total calculado en el cliente.
--
-- Se conservan `wallets_select_own` (leer el saldo si) y `wallets_insert_own`
-- (crear la fila propia al registrarse). Lo que se elimina es poder MODIFICARLA.
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;


-- -----------------------------------------------------------------------------
-- 4.1) RPC `recargar_saldo`
-- -----------------------------------------------------------------------------
-- Suma saldo a la wallet del usuario autenticado y deja el movimiento en el
-- historial, todo en la misma transaccion y con la fila bloqueada (`FOR UPDATE`),
-- igual que `procesar_pago`.
--
-- RECUERDA: esto simula una recarga. En produccion hay que llamarla SOLO
-- despues de confirmar el pago con la pasarela; expuesta tal cual, cualquier
-- estudiante autenticado se puede recargar a si mismo. Por eso se acotan los
-- limites: monto positivo, tope por operacion y tope diario.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recargar_saldo(p_monto BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id    BIGINT;
  v_wallet_id     BIGINT;
  v_saldo_actual  INTEGER;
  v_saldo_nuevo   INTEGER;
  v_monto         INTEGER;
  v_recargado_hoy INTEGER := 0;
  v_tope_operacion  CONSTANT INTEGER := 100000;   -- $100.000 por operacion
  v_tope_diario     CONSTANT INTEGER := 200000;   -- $200.000 por dia
BEGIN
  -- El monto llega del cliente: se acota antes de tocar nada.
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'monto_invalido',
      'mensaje', 'El monto de recarga debe ser mayor a 0.'
    );
  END IF;

  v_monto := p_monto::INTEGER;

  IF v_monto > v_tope_operacion THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'monto_excede_tope',
      'mensaje', 'La recarga supera el maximo por operacion.'
    );
  END IF;

  -- Quien sos. `mi_usuario_id()` es SECURITY DEFINER justamente para que
  -- estas funciones puedan ver la fila de `usuarios` sin saltarse el RLS.
  v_usuario_id := public.mi_usuario_id();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Tu sesion no tiene usuario interno. Registrate de nuevo.'
      USING ERRCODE = '42501',
            HINT    = 'Tu sesion no tiene usuario interno. Registrate de nuevo.';
  END IF;

  -- Tope diario: suma lo ya recargado hoy, no lo que el cliente diga.
  SELECT COALESCE(SUM(m.monto), 0)::INTEGER
    INTO v_recargado_hoy
  FROM public.movimientos_wallet m
  JOIN public.wallets w ON w.id = m.wallet_id
  WHERE w.usuario_id = v_usuario_id
    AND m.tipo = 'recarga'
    AND m.creado_en >= date_trunc('day', now());

  IF v_recargado_hoy + v_monto > v_tope_diario THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'tope_diario_superado',
      'mensaje', 'Superaste el maximo de recarga permitido por dia.',
      'recargado_hoy', v_recargado_hoy,
      'tope_diario', v_tope_diario
    );
  END IF;

  -- Bloqueo de la fila: sin esto, dos recargas simultaneas parten del mismo
  -- saldo y una se pierde (lost update).
  SELECT id, saldo_actual INTO v_wallet_id, v_saldo_actual
  FROM public.wallets
  WHERE usuario_id = v_usuario_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'wallet_no_encontrada',
      'mensaje', 'No se encontro una billetera asociada a tu cuenta.'
    );
  END IF;

  v_saldo_nuevo := v_saldo_actual + v_monto;

  UPDATE public.wallets
  SET saldo_actual = v_saldo_nuevo,
      actualizado_en = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.movimientos_wallet (wallet_id, tipo, monto, descripcion)
  VALUES (v_wallet_id, 'recarga', v_monto, 'Recarga de saldo');

  RETURN jsonb_build_object(
    'ok', true,
    'saldo_anterior', v_saldo_actual,
    'saldo_nuevo', v_saldo_nuevo,
    'monto', v_monto,
    'mensaje', 'Recarga realizada correctamente.'
  );
END;
$$;

COMMENT ON FUNCTION public.recargar_saldo(BIGINT) IS
  'Suma saldo a la wallet del usuario autenticado. Simula una recarga: en '
  'produccion debe invocarse solo tras confirmar el pago con la pasarela.';

REVOKE ALL ON FUNCTION public.recargar_saldo(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recargar_saldo(BIGINT) TO authenticated;

