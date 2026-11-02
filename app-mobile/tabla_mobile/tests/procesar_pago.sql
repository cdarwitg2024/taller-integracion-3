-- Ejecutar SOLO en una BD aislada cf_panel_test_*; nunca en Cloud.
DO $$ BEGIN IF current_database() NOT LIKE 'cf_panel_test_%' THEN RAISE EXCEPTION 'Base no aislada'; END IF; END $$;
CREATE TABLE public.productos(id bigint PRIMARY KEY, cafeteria_id bigint, precio numeric, stock integer, activo boolean, eliminado_en timestamptz);
CREATE TABLE public.wallets(id bigint PRIMARY KEY, usuario_id bigint, saldo_actual integer);
CREATE TABLE public.pedidos(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, usuario_id bigint, cafeteria_id bigint, total numeric, estado text, pago_estado text, metodo_pago text, franja_retiro text, qr_token uuid, codigo_retiro_diario text);
CREATE TABLE public.detalles_pedido(pedido_id bigint, producto_id bigint, cantidad integer, precio_unitario numeric, subtotal numeric);
CREATE TABLE public.metodos_pago(id bigint PRIMARY KEY, codigo text);
CREATE TABLE public.pagos(pedido_id bigint, metodo_pago_id bigint, monto numeric, estado text, es_simulado boolean, referencia_transaccion text);
CREATE TABLE public.movimientos_wallet(wallet_id bigint, pedido_id bigint, tipo text, monto integer, descripcion text);
CREATE FUNCTION public.get_current_user_id() RETURNS bigint LANGUAGE sql AS 'SELECT 1::bigint';
-- RPC_INJECT
CREATE PROCEDURE reset_test(s integer, saldo integer DEFAULT 10000) LANGUAGE plpgsql AS $$ BEGIN
TRUNCATE productos, wallets, pedidos, detalles_pedido, metodos_pago, pagos, movimientos_wallet RESTART IDENTITY;
INSERT INTO productos VALUES (1,1,100,s,true,null);
INSERT INTO wallets VALUES (1,1,saldo);
INSERT INTO metodos_pago VALUES (1,'WALLET'); END $$;
DO $$ DECLARE r jsonb; BEGIN
CALL reset_test(10); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
IF r->>'ok'<>'true' OR (SELECT stock FROM productos WHERE id=1)<>7 OR (SELECT saldo_actual FROM wallets WHERE id=1)<>9700 OR (SELECT count(*) FROM pagos)<>1 OR (SELECT count(*) FROM detalles_pedido)<>1 THEN RAISE EXCEPTION 'suficiente'; END IF;
CALL reset_test(3); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
IF r->>'ok'<>'true' OR (SELECT stock FROM productos WHERE id=1)<>0 THEN RAISE EXCEPTION 'exacto'; END IF;
CALL reset_test(2); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
IF r->>'motivo'<>'stock_insuficiente' OR (SELECT stock FROM productos WHERE id=1)<>2 OR EXISTS(SELECT 1 FROM pedidos) THEN RAISE EXCEPTION 'insuficiente'; END IF;
CALL reset_test(0); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":1}]');
IF r->>'motivo'<>'stock_insuficiente' THEN RAISE EXCEPTION 'cero'; END IF;
CALL reset_test(10,0); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":3}]');
IF r->>'motivo'<>'saldo_insuficiente' OR (SELECT stock FROM productos WHERE id=1)<>10 OR EXISTS(SELECT 1 FROM pedidos) THEN RAISE EXCEPTION 'pago rechazado'; END IF;
CALL reset_test(3); r:=procesar_pago(1,'[{"producto_id":1,"cantidad":2},{"producto_id":1,"cantidad":2}]');
IF r->>'motivo'<>'stock_insuficiente' THEN RAISE EXCEPTION 'duplicados'; END IF;
CALL reset_test(10); r:=procesar_pago(2,'[{"producto_id":1,"cantidad":1}]');
IF r->>'motivo'<>'producto_no_disponible' THEN RAISE EXCEPTION 'otra cafeteria'; END IF;
END $$;
CREATE FUNCTION fallo_pago_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo_pago_test'; END $$;
CREATE TRIGGER fallo BEFORE INSERT ON pagos FOR EACH ROW EXECUTE FUNCTION fallo_pago_test();
CALL reset_test(10);
DO $$ BEGIN
BEGIN PERFORM procesar_pago(1,'[{"producto_id":1,"cantidad":3}]'); RAISE EXCEPTION 'No falló';
EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'fallo_pago_test' THEN RAISE; END IF; END;
IF (SELECT stock FROM productos WHERE id=1)<>10 OR (SELECT saldo_actual FROM wallets WHERE id=1)<>10000 OR EXISTS(SELECT 1 FROM pedidos) OR EXISTS(SELECT 1 FROM detalles_pedido) OR EXISTS(SELECT 1 FROM pagos) THEN RAISE EXCEPTION 'rollback incompleto'; END IF;
END $$;
DROP TRIGGER fallo ON pagos;
CALL reset_test(3);
SELECT '8 escenarios SQL aprobados' AS resultado;
