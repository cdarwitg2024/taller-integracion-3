-- Se carga después de procesar_pago.sql, únicamente en la BD temporal de pruebas.
DO $$ BEGIN IF current_database() NOT LIKE 'cf_panel_test_%' THEN RAISE EXCEPTION 'Base no aislada'; END IF; END $$;
ALTER TABLE pedidos ADD COLUMN cancelado_en timestamptz;
CREATE FUNCTION public.mi_usuario_id() RETURNS bigint LANGUAGE sql AS 'SELECT 1::bigint';
-- CANCEL_RPC_INJECT
DO $$ DECLARE r jsonb; pid bigint; BEGIN
  CALL reset_test(10);
  r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]'); pid:=(r->>'pedido_id')::bigint;
  IF (SELECT stock FROM productos WHERE id=1)<>7 OR NOT (SELECT stock_descontado FROM pedidos WHERE id=pid) THEN RAISE EXCEPTION 'compra sin marca'; END IF;
  r:=cancelar_pedido(pid);
  IF r->>'ok'<>'true' OR (SELECT stock FROM productos WHERE id=1)<>10
     OR (SELECT saldo_actual FROM wallets WHERE id=1)<>10000
     OR (SELECT estado FROM pedidos WHERE id=pid)<>'cancelado'
     OR (SELECT stock_descontado FROM pedidos WHERE id=pid)
     OR (SELECT count(*) FROM movimientos_wallet WHERE tipo='reembolso')<>1 THEN RAISE EXCEPTION 'cancelacion normal'; END IF;
  r:=cancelar_pedido(pid);
  IF r->>'motivo'<>'ya_cancelado' OR (SELECT stock FROM productos WHERE id=1)<>10
     OR (SELECT saldo_actual FROM wallets WHERE id=1)<>10000
     OR (SELECT count(*) FROM movimientos_wallet WHERE tipo='reembolso')<>1 THEN RAISE EXCEPTION 'duplicada'; END IF;

  CALL reset_test(10);
  INSERT INTO productos VALUES (2,1,100,20,true,null);
  r:=procesar_pago(1,'[{"producto_id":1,"cantidad":2},{"producto_id":2,"cantidad":5}]');
  IF (SELECT stock FROM productos WHERE id=1)<>8 OR (SELECT stock FROM productos WHERE id=2)<>15 THEN RAISE EXCEPTION 'compra multiple'; END IF;
  PERFORM cancelar_pedido((r->>'pedido_id')::bigint);
  IF (SELECT stock FROM productos WHERE id=1)<>10 OR (SELECT stock FROM productos WHERE id=2)<>20 THEN RAISE EXCEPTION 'reposicion multiple'; END IF;

  CALL reset_test(10);
  r:=procesar_pago(1,'[{"producto_id":1,"cantidad":1},{"producto_id":1,"cantidad":2}]'); pid:=(r->>'pedido_id')::bigint;
  -- Simular detalles históricos repetidos conservando las unidades reales.
  UPDATE detalles_pedido SET cantidad=1 WHERE pedido_id=pid;
  INSERT INTO detalles_pedido VALUES (pid,1,2,100,200);
  PERFORM cancelar_pedido(pid);
  IF (SELECT stock FROM productos WHERE id=1)<>10 THEN RAISE EXCEPTION 'lineas repetidas'; END IF;

  CALL reset_test(10);
  INSERT INTO pedidos(usuario_id,cafeteria_id,total,estado,pago_estado) VALUES (1,1,300,'pendiente','pagado') RETURNING id INTO pid;
  INSERT INTO detalles_pedido VALUES(pid,1,3,100,300);
  PERFORM cancelar_pedido(pid);
  IF (SELECT stock FROM productos WHERE id=1)<>10 THEN RAISE EXCEPTION 'repuesto sin descuento'; END IF;

  CALL reset_test(10);
  r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]'); pid:=(r->>'pedido_id')::bigint;
  UPDATE pedidos SET estado='en_preparacion' WHERE id=pid;
  r:=cancelar_pedido(pid);
  IF r->>'motivo'<>'no_cancelable' OR (SELECT stock FROM productos WHERE id=1)<>7 THEN RAISE EXCEPTION 'estado no cancelable'; END IF;

  CALL reset_test(10);
  r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]'); pid:=(r->>'pedido_id')::bigint;
  UPDATE pedidos SET usuario_id=2 WHERE id=pid;
  r:=cancelar_pedido(pid);
  IF r->>'motivo'<>'no_autorizado' OR (SELECT stock FROM productos WHERE id=1)<>7 THEN RAISE EXCEPTION 'propietario ajeno'; END IF;
END $$;
CREATE FUNCTION fallo_cancelacion_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.estado='cancelado' THEN RAISE EXCEPTION 'fallo_cancelacion_test'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER fallo_cancelacion BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION fallo_cancelacion_test();
CALL reset_test(10);
SELECT procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
DO $$ BEGIN
  BEGIN PERFORM cancelar_pedido(1); RAISE EXCEPTION 'No fallo';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'fallo_cancelacion_test' THEN RAISE; END IF; END;
  IF (SELECT stock FROM productos WHERE id=1)<>7 OR (SELECT saldo_actual FROM wallets WHERE id=1)<>9700
     OR (SELECT estado FROM pedidos WHERE id=1)<>'pendiente' OR NOT (SELECT stock_descontado FROM pedidos WHERE id=1)
     OR EXISTS(SELECT 1 FROM movimientos_wallet WHERE tipo='reembolso')
     OR (SELECT estado FROM pagos WHERE pedido_id=1)<>'aprobado' THEN RAISE EXCEPTION 'rollback cancelacion incompleto'; END IF;
END $$;
DROP TRIGGER fallo_cancelacion ON pedidos;
CALL reset_test(10);
SELECT procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
SELECT '8 escenarios de cancelacion aprobados' AS resultado;
