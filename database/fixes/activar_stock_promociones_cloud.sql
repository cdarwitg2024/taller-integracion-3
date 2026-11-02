-- Migración reconciliada con la función de pago Cloud respaldada el 2026-11-01.
-- Conserva generar_token_retiro, codigo_pedido, validación de franja y campos
-- de respuesta anteriores; añade codigo_retiro como alias compatible con Mobile.
-- No hace backfill ni asigna descuentos de stock a pedidos anteriores.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Detener la publicación si otra sesión cambió la base después del respaldo.
DO $$ BEGIN
  IF md5(pg_get_functiondef(to_regprocedure('public.procesar_pago(bigint,jsonb,text)'))) IS DISTINCT FROM '554da11df5adebe6c4321eb1d90ddf62'
    OR to_regprocedure('public.cancelar_pedido(bigint)') IS NOT NULL
    OR to_regclass('public.promociones') IS NOT NULL THEN
    RAISE EXCEPTION 'El esquema cambió desde el respaldo. Revisar antes de aplicar esta migración';
  END IF;
END $$;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.procesar_pago(p_cafeteria_id bigint, p_items jsonb, p_franja_retiro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_usuario_id    BIGINT;
    v_wallet_id     BIGINT;
    v_saldo         INTEGER;
    v_total         INTEGER := 0;
    v_item          JSONB;
    v_producto_id   BIGINT;
    v_cantidad      INTEGER;
    v_precio        NUMERIC;
    v_stock         INTEGER;
    v_subtotal      NUMERIC;
    v_pedido_id     BIGINT;
    v_metodo_id     BIGINT;
    v_detalles      JSONB := '[]'::jsonb;
    v_qr_token      TEXT;
    v_codigo        TEXT;
    v_codigo_pedido TEXT;
    v_intento       INTEGER;
BEGIN
    -- 1. Resolver usuario
    v_usuario_id := public.get_current_user_id();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'sin_sesion'
            USING ERRCODE = '42501',
                  HINT = 'Tu sesion no tiene usuario interno vinculado.';
    END IF;

    IF p_cafeteria_id IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'motivo', 'carrito_vacio',
            'mensaje', 'El carrito esta vacio.'
        );
    END IF;

    IF p_franja_retiro IS NULL OR btrim(p_franja_retiro) = '' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'motivo', 'franja_requerida',
            'mensaje', 'Elige una franja de retiro antes de pagar.'
        );
    END IF;

  -- Orden de bloqueo estable: productos por id -> wallet. Sumar duplicados
  -- evita aprobar dos líneas que individualmente caben pero juntas exceden stock.
  FOR v_item IN
    SELECT jsonb_build_object('producto_id', (i->>'producto_id')::BIGINT,
                             'cantidad', sum((i->>'cantidad')::BIGINT))
    FROM jsonb_array_elements(p_items) i
    GROUP BY (i->>'producto_id')::BIGINT ORDER BY (i->>'producto_id')::BIGINT
  LOOP
    v_producto_id := (v_item ->> 'producto_id')::BIGINT;
    v_cantidad := (v_item ->> 'cantidad')::INTEGER;
    SELECT precio, stock INTO v_precio, v_stock
    FROM public.productos
    WHERE id = v_producto_id AND cafeteria_id = p_cafeteria_id
      AND activo = true AND eliminado_en IS NULL
    FOR UPDATE;
    IF NOT FOUND OR v_precio IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'producto_no_disponible');
    END IF;
    IF v_stock IS NULL OR v_stock < v_cantidad THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'stock_insuficiente',
        'mensaje', 'Stock insuficiente para completar la compra.', 'producto_id', v_producto_id);
    END IF;

    -- Activación opcional y coordinada con gestion_promociones_cafeteria.sql.
    -- El precio de compra siempre parte del producto bloqueado, nunca del cliente.
    IF to_regprocedure('public.precio_promocional(bigint,bigint,numeric)') IS NOT NULL THEN
      v_precio := public.precio_promocional(v_producto_id, p_cafeteria_id, v_precio);
    END IF;
    -- Si la campaña/precio cambió desde que se agregó al carrito, no cobrar
    -- un importe distinto sin que el estudiante revise el menú nuevamente.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) i
      WHERE (i->>'producto_id')::BIGINT=v_producto_id AND i ? 'precio_esperado'
        AND (i->>'precio_esperado')::NUMERIC IS DISTINCT FROM v_precio
    ) THEN
      RETURN jsonb_build_object('ok',false,'motivo','precio_actualizado',
        'mensaje','El precio o la promoción cambió. Actualiza el menú y vuelve a agregar el producto antes de pagar.');
    END IF;

    v_subtotal := v_precio * v_cantidad;
    v_total := v_total + round(v_subtotal)::INTEGER;

    v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
      'producto_id',     v_producto_id,
      'cantidad',        v_cantidad,
      'precio_unitario', v_precio,
      'subtotal',        v_subtotal
    ));
  END LOOP;


    IF v_total <= 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'motivo', 'total_invalido',
            'mensaje', 'El total del pedido no es valido.'
        );
    END IF;

    -- 3. Bloqueo con FOR UPDATE de la Wallet
    SELECT w.id, w.saldo_actual
      INTO v_wallet_id, v_saldo
      FROM public.wallets w
     WHERE w.usuario_id = v_usuario_id
       FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'motivo', 'sin_wallet',
            'mensaje', 'Tu usuario no tiene Wallet asociada.'
        );
    END IF;

    -- 4. Validar saldo suficiente
    IF v_saldo IS NULL OR v_saldo < v_total THEN
        RETURN jsonb_build_object(
            'ok', false,
            'motivo', 'saldo_insuficiente',
            'mensaje', 'Saldo insuficiente en la Wallet',
            'saldo_disponible', v_saldo,
            'total', v_total,
            'faltante', v_total - v_saldo
        );
    END IF;

    -- Stock y wallet se modifican bajo los bloqueos anteriores. Si falla
    -- cualquier escritura posterior, PostgreSQL revierte toda la compra.
    UPDATE public.productos p
    SET stock=p.stock-(d->>'cantidad')::INTEGER, actualizado_en=CURRENT_TIMESTAMP
    FROM jsonb_array_elements(v_detalles) d WHERE p.id=(d->>'producto_id')::BIGINT;

    -- 5. Debitar saldo
    UPDATE public.wallets
       SET saldo_actual = saldo_actual - v_total,
           actualizado_en = CURRENT_TIMESTAMP
     WHERE id = v_wallet_id
    RETURNING saldo_actual INTO v_saldo;

    -- 6. Generar tokens únicos de retiro
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

    -- 7. Insertar Pedido
    INSERT INTO public.pedidos (
        usuario_id, cafeteria_id, total, estado, pago_estado, metodo_pago,
        franja_retiro, qr_token, codigo_retiro_diario, qr_usado, stock_descontado
    )
    VALUES (
        v_usuario_id, p_cafeteria_id, v_total, 'pendiente', 'pagado', 'wallet',
        p_franja_retiro, v_qr_token, v_codigo, false, true
    )
    RETURNING id, codigo_pedido INTO v_pedido_id, v_codigo_pedido;

    -- 8. Insertar Detalles de Pedido
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

    -- 9. Asiento de Pago (con método WALLET)
    SELECT id INTO v_metodo_id
      FROM public.metodos_pago WHERE codigo = 'WALLET' LIMIT 1;

    INSERT INTO public.pagos (
        pedido_id, metodo_pago_id, monto, estado, es_simulado, referencia_transaccion
    )
    VALUES (
        v_pedido_id, v_metodo_id, v_total, 'aprobado', false,
        'wallet-pedido-' || v_pedido_id::TEXT
    );

    -- 10. Movimiento de Wallet
    INSERT INTO public.movimientos_wallet (
        wallet_id, pedido_id, tipo, monto, descripcion
    )
    VALUES (
        v_wallet_id, v_pedido_id, 'compra', -v_total,
        'Compra cafeteria #' || p_cafeteria_id::TEXT
    );

    -- 11. Respuesta con tokens listos para retiro
    RETURN jsonb_build_object(
        'ok', true,
        'pedido_id', v_pedido_id,
        'codigo_pedido', v_codigo_pedido,
        'total', v_total,
        'saldo_restante', v_saldo,
        'estado', 'pendiente',
        'pago_estado', 'pagado',
        'franja_retiro', p_franja_retiro,
        'qr_token', v_qr_token,
        'codigo_retiro_diario', v_codigo,
        'codigo_retiro', v_codigo
    );
END;
$function$
;
REVOKE ALL ON FUNCTION public.procesar_pago(bigint,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_pago(bigint,jsonb,text) TO authenticated;
-- =============================================================================
-- RPC cancelar_pedido — cancelacion transaccional con reembolso a Wallet
-- =============================================================================
-- Etapa D.2.1-D.
--
-- Regla de negocio:
--   El estudiante puede cancelar SU PROPIO pedido SOLO mientras esta en
--   'pendiente' (equivalente legacy de lectura: 'pagado'). Al cancelar, el
--   monto originalmente pagado (pedidos.total) se devuelve integro a su Wallet.
--
--   'pendiente' significa "pedido ya pagado, pendiente de preparacion".
--   NO se permite cancelar desde en_preparacion / listo / entregado / cancelado.
--
-- Garantias:
--   * Autoria: resuelve el usuario con public.mi_usuario_id() (deriva de
--     auth.uid()); NUNCA confia en un usuario_id enviado por el cliente.
--     public.mi_usuario_id() SI esta versionada en el repositorio
--     (database/fixes/politica_logs_auditoria_por_usuario.sql).
--   * Atomicidad: toda la funcion es UNA transaccion (plpgsql). Cualquier
--     error hace ROLLBACK completo.
--   * Idempotencia / doble reembolso: se bloquea el pedido con FOR UPDATE y
--     se valida su estado DENTRO de la transaccion. Una segunda cancelacion
--     concurrente espera el lock y ve el pedido ya 'cancelado'.
--   * Orden de locks: pedido -> productos por id -> wallet. Compra también
--     bloquea productos por id antes de wallet, sin ciclo entre ambas RPC.
--
-- Solo repone si stock_descontado=true. No cambia pagos.estado ni QR;
-- el reembolso se registra en movimientos_wallet, como en el contrato previo.
--
-- IMPORTANTE: este archivo NO se ejecuta automaticamente. Aplicar en Supabase
-- es manual.
-- =============================================================================

-- Sin backfill: pedidos históricos NO prueban un descuento previo.
-- Aplicar pago y cancelación juntos antes de habilitar compras con stock.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  p_pedido_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id     BIGINT;
  v_ped_usuario_id BIGINT;
  v_estado         TEXT;
  v_total          NUMERIC(10,2);
  v_monto          INTEGER;
  v_wallet_id      BIGINT;
  v_saldo          INTEGER;
  v_saldo_nuevo    INTEGER;
  v_stock_descontado boolean;
  v_detalle RECORD;
  v_stock INTEGER;
BEGIN
  -- 1) Resolver el usuario autenticado (id interno desde auth.uid()).
  v_usuario_id := public.mi_usuario_id();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'sin_sesion'
      USING ERRCODE = '42501',
            HINT    = 'La sesion no tiene usuario interno asociado.';
  END IF;

  IF p_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'pedido_no_encontrado');
  END IF;

  -- 2) Bloquear el pedido (serializa cancelaciones concurrentes).
  SELECT p.usuario_id, p.estado, p.total, p.stock_descontado
    INTO v_ped_usuario_id, v_estado, v_total, v_stock_descontado
    FROM public.pedidos p
   WHERE p.id = p_pedido_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'pedido_no_encontrado');
  END IF;

  -- 3) Solo el propietario puede cancelar.
  IF v_ped_usuario_id IS DISTINCT FROM v_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
  END IF;

  -- 4) Solo se cancela desde 'pendiente' (legacy de lectura: 'pagado').
  IF lower(v_estado) = 'cancelado' THEN
    RETURN jsonb_build_object(
      'ok', false, 'motivo', 'ya_cancelado', 'estado_actual', 'cancelado'
    );
  END IF;

  IF v_estado IS NULL OR lower(v_estado) NOT IN ('pendiente', 'pagado') THEN
    RETURN jsonb_build_object(
      'ok', false, 'motivo', 'no_cancelable', 'estado_actual', v_estado
    );
  END IF;

  -- 5) Monto autoritativo: pedidos.total (NO se recalcula desde productos).
  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'monto_invalido');
  END IF;

  -- No reembolsar pedidos fabricados, sin pago o pagados por otro método.
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.pagos pg ON pg.pedido_id=p.id
    JOIN public.metodos_pago mp ON mp.id=pg.metodo_pago_id
    WHERE p.id=p_pedido_id AND lower(p.pago_estado)='pagado'
      AND lower(p.metodo_pago)='wallet' AND upper(mp.codigo)='WALLET'
      AND lower(pg.estado)='aprobado' AND pg.monto=v_total
      AND coalesce(pg.es_simulado,false)=false
  ) THEN
    RETURN jsonb_build_object('ok',false,'motivo','pago_no_reembolsable');
  END IF;

  -- 6) La Wallet usa INTEGER (CLP): el total debe ser entero y caber en INTEGER.
  IF v_total <> trunc(v_total) OR v_total > 2147483647 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'monto_no_entero');
  END IF;

  v_monto := v_total::INTEGER;

  -- La marca se escribe solo en la compra que descontó stock; no inferirla
  -- del estado, fecha, pago ni del formato de las credenciales.
  IF v_stock_descontado THEN
    IF NOT EXISTS (SELECT 1 FROM public.detalles_pedido WHERE pedido_id=p_pedido_id)
       OR EXISTS (SELECT 1 FROM public.detalles_pedido WHERE pedido_id=p_pedido_id
                  AND (producto_id IS NULL OR cantidad IS NULL OR cantidad <= 0)) THEN
      RAISE EXCEPTION 'Detalles inválidos para reponer stock' USING ERRCODE='23514';
    END IF;
    FOR v_detalle IN
      SELECT producto_id, sum(cantidad)::BIGINT AS cantidad
      FROM public.detalles_pedido WHERE pedido_id=p_pedido_id
      GROUP BY producto_id ORDER BY producto_id
    LOOP
      SELECT stock INTO v_stock FROM public.productos
      WHERE id=v_detalle.producto_id FOR UPDATE;
      IF NOT FOUND OR v_stock IS NULL OR v_stock < 0
         OR v_detalle.cantidad > 2147483647::BIGINT - v_stock THEN
        RAISE EXCEPTION 'No se puede reponer stock del producto %', v_detalle.producto_id
          USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;

  -- 7) Bloquear la Wallet del usuario.
  SELECT w.id, w.saldo_actual
    INTO v_wallet_id, v_saldo
    FROM public.wallets w
   WHERE w.usuario_id = v_usuario_id
     FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sin_wallet');
  END IF;

  -- 8) Validar overflow antes de acreditar (INTEGER MAX).
  IF v_saldo IS NULL OR v_saldo > 2147483647 - v_monto THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'saldo_invalido');
  END IF;

  IF v_stock_descontado THEN
    UPDATE public.productos p SET stock=p.stock+d.cantidad::INTEGER
    FROM (SELECT producto_id, sum(cantidad)::BIGINT AS cantidad
          FROM public.detalles_pedido WHERE pedido_id=p_pedido_id GROUP BY producto_id) d
    WHERE p.id=d.producto_id;
  END IF;

  -- 9) Acreditar el saldo (patron inverso de procesar_pago).
  UPDATE public.wallets
     SET saldo_actual = saldo_actual + v_monto
   WHERE id = v_wallet_id
  RETURNING saldo_actual INTO v_saldo_nuevo;

  -- 10) Registrar el reembolso en el ledger (monto POSITIVO).
  INSERT INTO public.movimientos_wallet (
    wallet_id, pedido_id, tipo, monto, descripcion
  )
  VALUES (
    v_wallet_id, p_pedido_id, 'reembolso', v_monto,
    'Reembolso pedido #' || p_pedido_id::TEXT
  );

  -- 11) Cerrar el pedido: estado canonico + timestamp de cancelacion.
  UPDATE public.pedidos
     SET estado       = 'cancelado',
         stock_descontado = false,
         cancelado_en = CURRENT_TIMESTAMP
   WHERE id = p_pedido_id;

  -- 12) Respuesta.
  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', p_pedido_id,
    'estado', 'cancelado',
    'monto_reembolsado', v_monto,
    'saldo_nuevo', v_saldo_nuevo
  );
END;
$$;

-- Permisos explicitos: solo usuarios autenticados (NUNCA anon).
REVOKE ALL ON FUNCTION public.cancelar_pedido(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(BIGINT) TO authenticated;

-- =============================================================================
-- MIGRACION DE SEGURIDAD (misma funcionalidad)
-- =============================================================================
-- La policy "pedidos_update_cancelar_own" permitia al propietario hacer un
-- UPDATE directo del pedido a 'cancelado' SIN reembolso, saltandose esta RPC.
-- Se elimina para que cancelar_pedido() sea la UNICA via de cancelacion del
-- estudiante. La RPC es SECURITY DEFINER, por lo que no necesita esa policy.
--
-- NO tocar pedidos_update_staff aqui (riesgo separado, ver reporte D.2.1-D).
--
-- IMPORTANTE: NO ejecutar este DROP remotamente en esta etapa.
-- =============================================================================

DROP POLICY IF EXISTS "pedidos_update_cancelar_own" ON public.pedidos;

-- Preparado para revisión; NO aplicado en Supabase Cloud.
-- Activar junto con rpc_qr.sql y rpc_cancelar_pedido.sql, en una transacción.
-- No incluye datos de ejemplo ni modifica precios base de productos.

-- No habilitar precios promocionales en Mobile mientras el cobro siga usando
-- la definición anterior: el catálogo podría mostrar un precio y cobrar otro.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pedidos' AND column_name='stock_descontado')
    OR position('public.precio_promocional(' IN coalesce(pg_get_functiondef(to_regprocedure('public.procesar_pago(bigint,jsonb,text)')), ''))=0
    OR position('stock_descontado' IN coalesce(pg_get_functiondef(to_regprocedure('public.cancelar_pedido(bigint)')), ''))=0 THEN
    RAISE EXCEPTION 'Instala primero las definiciones locales de procesar_pago y cancelar_pedido en la misma transacción de activación';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promociones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafeteria_id bigint NOT NULL REFERENCES public.cafeterias(id),
  producto_id bigint REFERENCES public.productos(id),
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 3 AND 120),
  descripcion text CHECK (length(descripcion) <= 2000),
  descuento_porcentaje numeric(5,2) NOT NULL CHECK (descuento_porcentaje BETWEEN 1 AND 99),
  activo boolean NOT NULL DEFAULT true,
  inicio_en timestamptz,
  fin_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (inicio_en IS NULL OR fin_en IS NULL OR fin_en > inicio_en)
);
CREATE INDEX IF NOT EXISTS promociones_cafeteria_idx ON public.promociones(cafeteria_id);

CREATE OR REPLACE FUNCTION public.es_dueno_cafeteria(p_cafeteria_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id=u.rol_id
    JOIN public.cafeteria_usuarios cu ON cu.usuario_id=u.id
    WHERE u.auth_user_id=auth.uid() AND u.activo=true
      AND lower(r.nombre) IN ('dueño','dueno') AND cu.cafeteria_id=p_cafeteria_id
  );
$$;
REVOKE ALL ON FUNCTION public.es_dueno_cafeteria(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_dueno_cafeteria(bigint) TO authenticated;

-- La FK individual no garantiza la cafetería del producto; validar ambas.
CREATE OR REPLACE FUNCTION public.validar_producto_promocion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.producto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.productos p WHERE p.id=NEW.producto_id AND p.cafeteria_id=NEW.cafeteria_id
  ) THEN RAISE EXCEPTION 'El producto no pertenece a la cafetería de la promoción'; END IF;
  NEW.actualizado_en := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validar_producto_promocion() FROM PUBLIC;
DROP TRIGGER IF EXISTS promocion_producto_valido ON public.promociones;
CREATE TRIGGER promocion_producto_valido BEFORE INSERT OR UPDATE ON public.promociones
FOR EACH ROW EXECUTE FUNCTION public.validar_producto_promocion();

ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promociones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promociones TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.promociones_id_seq TO authenticated;
DROP POLICY IF EXISTS promociones_dueno ON public.promociones;
CREATE POLICY promociones_dueno ON public.promociones TO authenticated
USING (public.es_dueno_cafeteria(cafeteria_id))
WITH CHECK (public.es_dueno_cafeteria(cafeteria_id));

-- Usa la fila bloqueada de productos durante el pago. No acepta precios del móvil.
-- La vigencia es [inicio, fin); mayor descuento; mínimo 1 CLP por unidad.
CREATE OR REPLACE FUNCTION public.precio_promocional(p_producto_id bigint, p_cafeteria_id bigint, p_precio_base numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN max(pr.descuento_porcentaje) IS NULL THEN p_precio_base
    ELSE greatest(1, round(p_precio_base * (100 - max(pr.descuento_porcentaje)) / 100)) END
  FROM public.promociones pr
  WHERE pr.cafeteria_id=p_cafeteria_id AND (pr.producto_id IS NULL OR pr.producto_id=p_producto_id)
    AND pr.activo AND (pr.inicio_en IS NULL OR pr.inicio_en <= now())
    AND (pr.fin_en IS NULL OR now() < pr.fin_en);
$$;
REVOKE ALL ON FUNCTION public.precio_promocional(bigint,bigint,numeric) FROM PUBLIC, anon, authenticated;

-- Solo devuelve precios de productos públicos: no expone campañas privadas/futuras.
CREATE OR REPLACE FUNCTION public.cotizar_promociones(p_ids bigint[])
RETURNS TABLE(id bigint, precio_base numeric, precio numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(array_length(p_ids,1),0) > 500 THEN RAISE EXCEPTION 'Demasiados productos'; END IF;
  RETURN QUERY SELECT p.id, p.precio::numeric,
    public.precio_promocional(p.id, p.cafeteria_id, p.precio::numeric)
  FROM public.productos p
  WHERE p.id=ANY(p_ids) AND p.activo=true AND p.eliminado_en IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cotizar_promociones(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotizar_promociones(bigint[]) TO anon, authenticated;

-- Compatible con los campos reales de cafeterias. No crea dirección/email ficticios.
DROP POLICY IF EXISTS cafeterias_consultar_dueno ON public.cafeterias;
CREATE POLICY cafeterias_consultar_dueno ON public.cafeterias FOR SELECT TO authenticated
USING (public.es_dueno_cafeteria(id));
DROP POLICY IF EXISTS cafeterias_actualizar_dueno ON public.cafeterias;
CREATE POLICY cafeterias_actualizar_dueno ON public.cafeterias FOR UPDATE TO authenticated
USING (public.es_dueno_cafeteria(id)) WITH CHECK (public.es_dueno_cafeteria(id));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='promociones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.promociones;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';


-- Evitar que un cliente falsifique la marca de stock en una fila propia o
-- cambie directamente a Cancelado omitiendo la reposición y el reembolso.
CREATE OR REPLACE FUNCTION public.proteger_stock_pedido()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF (TG_OP='INSERT' AND NEW.stock_descontado)
      OR (TG_OP='UPDATE' AND NEW.stock_descontado IS DISTINCT FROM OLD.stock_descontado) THEN
      RAISE EXCEPTION 'La marca de stock solo puede cambiar mediante las RPC de pedido' USING ERRCODE='42501';
    END IF;
    IF TG_OP='UPDATE' AND lower(NEW.estado)='cancelado' AND lower(OLD.estado) IS DISTINCT FROM 'cancelado' THEN
      RAISE EXCEPTION 'Cancela el pedido mediante cancelar_pedido' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.proteger_stock_pedido() FROM PUBLIC;
DROP TRIGGER IF EXISTS proteger_stock_pedido ON public.pedidos;
CREATE TRIGGER proteger_stock_pedido BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.proteger_stock_pedido();

REVOKE ALL ON FUNCTION public.cancelar_pedido(bigint) FROM anon;
NOTIFY pgrst, 'reload schema';
COMMIT;
