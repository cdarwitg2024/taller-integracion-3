-- Aplicar después de V07, V08 y V09 de db_CoffeeFaster.
BEGIN;

CREATE OR REPLACE FUNCTION afiliados_privado.tiene_uso_de_codigo(
    p_usuario bigint, p_afiliacion bigint, p_excluir_pedido bigint DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.movimientos_comision m
        JOIN public.pedidos p ON p.id = m.pedido_id
        WHERE m.afiliacion_id = p_afiliacion
          AND m.tipo = 'comision' AND m.estado <> 'revertida'
          AND p.usuario_id = p_usuario AND p.pago_estado = 'pagado'
          AND p.estado <> 'cancelado'
          AND (p_excluir_pedido IS NULL OR p.id <> p_excluir_pedido)
    );
$$;
REVOKE ALL ON FUNCTION afiliados_privado.tiene_uso_de_codigo(bigint,bigint,bigint)
    FROM PUBLIC, anon, authenticated, service_role;

DO $actualizar$
DECLARE
    v_definicion text := pg_get_functiondef('afiliados_privado.cotizar_carrito(bigint,jsonb,text)'::regprocedure);
    v_anterior constant text := 'afiliados_privado.tiene_compra_previa(v_comprador, p_cafeteria_id)';
    v_nueva constant text := 'afiliados_privado.tiene_uso_de_codigo(v_comprador, v_afiliacion.id)';
BEGIN
    IF to_regprocedure('public.procesar_pago(bigint,jsonb,text,text,bigint,text)') IS NULL
       OR to_regprocedure('afiliados_privado.cancelar_pedido(bigint)') IS NULL THEN
        RAISE EXCEPTION 'Instale V08 y V09 antes de cambiar el límite de códigos';
    END IF;
    IF strpos(v_definicion, v_anterior) > 0 THEN
        EXECUTE replace(v_definicion, v_anterior, v_nueva);
    ELSIF strpos(v_definicion, v_nueva) = 0 THEN
        RAISE EXCEPTION 'La cotización difiere de V07; revise la regla antes de aplicar';
    END IF;
END;
$actualizar$;

-- Cada código aprobado identifica una afiliación. El bloqueo de V07 se conserva
-- y V08 vuelve a cotizar bajo ese bloqueo antes de debitar la Wallet.
CREATE OR REPLACE FUNCTION afiliados_privado.validar_primera_compra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_pedido public.pedidos;
BEGIN
    IF NEW.tipo = 'comision' THEN
        SELECT * INTO STRICT v_pedido FROM public.pedidos WHERE id = NEW.pedido_id;
        PERFORM afiliados_privado.bloquear_comprador(v_pedido.usuario_id, v_pedido.cafeteria_id);
        IF afiliados_privado.tiene_uso_de_codigo(v_pedido.usuario_id, NEW.afiliacion_id, v_pedido.id) THEN
            RAISE EXCEPTION 'beneficio_usado' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
