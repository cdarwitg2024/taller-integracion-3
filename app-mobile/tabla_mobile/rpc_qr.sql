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
  v_wallet_id    UUID;
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
  v_qr_token     UUID;
  v_codigo_retiro TEXT;
BEGIN
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

  UPDATE public.wallets
     SET saldo_actual = saldo_actual - v_total
   WHERE id = v_wallet_id
  RETURNING saldo_actual INTO v_saldo;

  INSERT INTO public.pedidos (
    usuario_id, cafeteria_id, total, estado, pago_estado, metodo_pago, franja_retiro
  )
  VALUES (
    v_usuario_id, p_cafeteria_id, v_total, 'Pagado', 'aprobado', 'wallet', p_franja_retiro
  )
  RETURNING id INTO v_pedido_id;

  -- Generar QR token único y código de contingencia (FR-21)
  -- No se reutilizan códigos de otro pedido: cada token es UUID único
  v_qr_token := gen_random_uuid();
  v_codigo_retiro := 'CF-' || lpad(v_pedido_id::TEXT, 4, '0');

  -- Guardar el QR token y código de retiro en el pedido
  UPDATE public.pedidos
  SET qr_token = v_qr_token,
      codigo_retiro_diario = v_codigo_retiro
  WHERE id = v_pedido_id;

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

  SELECT id INTO v_metodo_id
    FROM public.metodos_pago WHERE codigo = 'WALLET' LIMIT 1;

  INSERT INTO public.pagos (
    pedido_id, metodo_pago_id, monto, estado, es_simulado, referencia_transaccion
  )
  VALUES (
    v_pedido_id, v_metodo_id, v_total, 'aprobado', false,
    'wallet-pedido-' || v_pedido_id::TEXT
  );

  INSERT INTO public.movimientos_wallet (
    wallet_id, pedido_id, tipo, monto, descripcion
  )
  VALUES (
    v_wallet_id, v_pedido_id, 'compra', -v_total,
    'Compra cafeteria #' || p_cafeteria_id::TEXT
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido_id,
    'total', v_total,
    'saldo_restante', v_saldo,
    'estado', 'Pagado',
    'pago_estado', 'aprobado',
    'franja_retiro', p_franja_retiro,
    'qr_token', v_qr_token,
    'codigo_retiro', v_codigo_retiro
  );
END;
$$;

REVOKE ALL ON FUNCTION public.procesar_pago(BIGINT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.procesar_pago(BIGINT, JSONB, TEXT) TO authenticated;