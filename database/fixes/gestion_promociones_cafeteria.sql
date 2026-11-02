-- Preparado para revisión; NO aplicado en Supabase Cloud.
-- Activar junto con rpc_qr.sql y rpc_cancelar_pedido.sql, en una transacción.
-- No incluye datos de ejemplo ni modifica precios base de productos.
BEGIN;

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
COMMIT;
