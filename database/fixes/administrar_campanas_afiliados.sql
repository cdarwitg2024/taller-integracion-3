-- C03 · Administración de campañas de afiliados.
-- Define la tabla campanas_afiliados, su RLS y la RPC
-- administrar_campana_afiliados para crear, editar, pausar y reanudar.
-- Preparado para revisión; NO aplicado en Supabase Cloud.
-- Requiere es_dueno_cafeteria(bigint), instalada por gestion_promociones_cafeteria.sql.
-- La tabla campanas_afiliados es provisional hasta el esquema definitivo de V05.
BEGIN;

CREATE TABLE public.campanas_afiliados (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id bigint NOT NULL REFERENCES public.cafeterias(id),
    nombre text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 150),
    descuento_normal_pct numeric NOT NULL CHECK (descuento_normal_pct BETWEEN 0 AND 100),
    descuento_oferta_pct numeric NOT NULL CHECK (descuento_oferta_pct BETWEEN 0 AND 100),
    comision_pct numeric NOT NULL CHECK (comision_pct BETWEEN 0 AND 100),
    inicio timestamptz NOT NULL,
    fin timestamptz NOT NULL,
    pausada boolean NOT NULL DEFAULT false,
    CHECK (inicio < fin),
    CHECK (descuento_oferta_pct <= descuento_normal_pct)
);

ALTER TABLE public.campanas_afiliados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campanas_afiliados FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.administrar_campana_afiliados(
    p_cafeteria_id bigint,
    p_campana_id bigint,
    p_cambios jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    campaña public.campanas_afiliados;
    propuesta public.campanas_afiliados;
    ahora timestamptz;
    es_estado boolean;
BEGIN
    IF auth.uid() IS NULL OR
       public.es_dueno_cafeteria(p_cafeteria_id) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'sin_acceso_cafeteria' USING ERRCODE = '42501';
    END IF;

    IF jsonb_typeof(p_cambios) IS DISTINCT FROM 'object' OR p_cambios = '{}'::jsonb THEN
        RAISE EXCEPTION 'campana_invalida';
    END IF;

    es_estado := p_campana_id IS NOT NULL
        AND p_cambios ? 'pausada'
        AND p_cambios - 'pausada' = '{}'::jsonb
        AND jsonb_typeof(p_cambios->'pausada') = 'boolean';

    IF NOT es_estado AND (
        p_cambios - ARRAY['nombre','descuento_normal_pct','descuento_oferta_pct','comision_pct','inicio','fin'] <> '{}'::jsonb
        OR EXISTS (
            SELECT 1 FROM jsonb_each(p_cambios) AS campo(clave, valor)
            WHERE jsonb_typeof(valor) <> CASE
                WHEN clave IN ('nombre','inicio','fin') THEN 'string' ELSE 'number' END
        )
    ) THEN
        RAISE EXCEPTION 'campana_invalida';
    END IF;

    IF p_campana_id IS NOT NULL THEN
        SELECT * INTO campaña FROM public.campanas_afiliados
        WHERE id = p_campana_id AND cafeteria_id = p_cafeteria_id
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'sin_acceso_cafeteria' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Se toma la hora después de adquirir el bloqueo para validar la vigencia.
    ahora := clock_timestamp();
    propuesta := jsonb_populate_record(campaña, p_cambios);

    IF p_campana_id IS NULL THEN
        IF propuesta.inicio < ahora THEN
            RAISE EXCEPTION 'campana_invalida';
        END IF;
        INSERT INTO public.campanas_afiliados
            (cafeteria_id, nombre, descuento_normal_pct, descuento_oferta_pct, comision_pct, inicio, fin)
        VALUES (p_cafeteria_id, btrim(propuesta.nombre), propuesta.descuento_normal_pct,
                propuesta.descuento_oferta_pct, propuesta.comision_pct, propuesta.inicio, propuesta.fin)
        RETURNING * INTO campaña;
    ELSE
        IF NOT es_estado AND ahora >= campaña.inicio AND (
            propuesta.descuento_normal_pct IS DISTINCT FROM campaña.descuento_normal_pct
            OR propuesta.descuento_oferta_pct IS DISTINCT FROM campaña.descuento_oferta_pct
            OR propuesta.comision_pct IS DISTINCT FROM campaña.comision_pct
        ) THEN
            RAISE EXCEPTION 'porcentajes_fijados';
        END IF;
        IF ahora >= campaña.fin THEN
            RAISE EXCEPTION 'campana_finalizada';
        END IF;
        IF es_estado AND NOT propuesta.pausada AND ahora < campaña.inicio THEN
            RAISE EXCEPTION 'campana_no_iniciada';
        END IF;
        -- Una edición no puede reabrir la ventana de cambios de porcentajes.
        IF NOT es_estado AND (
            (ahora >= campaña.inicio AND (propuesta.inicio, propuesta.fin)
                IS DISTINCT FROM (campaña.inicio, campaña.fin))
            OR (ahora < campaña.inicio AND propuesta.inicio < ahora)
        ) THEN
            RAISE EXCEPTION 'campana_invalida';
        END IF;
        UPDATE public.campanas_afiliados
        SET nombre = btrim(propuesta.nombre),
            descuento_normal_pct = propuesta.descuento_normal_pct,
            descuento_oferta_pct = propuesta.descuento_oferta_pct,
            comision_pct = propuesta.comision_pct,
            inicio = propuesta.inicio,
            fin = propuesta.fin,
            pausada = propuesta.pausada
        WHERE id = campaña.id AND cafeteria_id = p_cafeteria_id
        RETURNING * INTO campaña;
    END IF;

    RETURN to_jsonb(campaña) || jsonb_build_object('estado', CASE
        WHEN campaña.pausada THEN 'pausada'
        WHEN ahora < campaña.inicio THEN 'programada'
        ELSE 'activa'
    END);
EXCEPTION
    WHEN check_violation OR not_null_violation OR foreign_key_violation
      OR invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'campana_invalida';
END;
$$;

REVOKE ALL ON FUNCTION public.administrar_campana_afiliados(bigint, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.administrar_campana_afiliados(bigint, bigint, jsonb) TO authenticated;

COMMIT;
