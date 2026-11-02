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
