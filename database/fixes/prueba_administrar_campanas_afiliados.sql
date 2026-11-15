-- Prueba reproducible de C03 · administración de campañas de afiliados.
-- Crea un esquema mínimo, aplica la migración y comprueba alta, edición,
-- pausa, reanudación y rechazo de dueños ajenos o fuera de vigencia.
-- Ejecutar solo en PostgreSQL desechable, desde la raíz del repositorio con psql.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.cafeterias (id bigint PRIMARY KEY);
CREATE TABLE public.roles (id bigint PRIMARY KEY, nombre text);
CREATE TABLE public.usuarios (id bigint PRIMARY KEY, rol_id bigint, activo boolean, auth_user_id uuid);
CREATE TABLE public.cafeteria_usuarios (usuario_id bigint, cafeteria_id bigint);
INSERT INTO public.cafeterias VALUES (7), (8);
INSERT INTO public.roles VALUES (1, 'dueno'), (2, 'empleado');
INSERT INTO public.usuarios VALUES
    (1, 1, true, '00000000-0000-0000-0000-000000000001'),
    (2, 1, true, '00000000-0000-0000-0000-000000000002'),
    (3, 2, true, '00000000-0000-0000-0000-000000000003');
INSERT INTO public.cafeteria_usuarios VALUES (1, 7), (2, 8), (3, 7);
-- Mismo control de pertenencia que gestion_promociones_cafeteria.sql.
CREATE FUNCTION public.es_dueno_cafeteria(p_cafeteria_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id = u.rol_id
        JOIN public.cafeteria_usuarios cu ON cu.usuario_id = u.id
        WHERE u.auth_user_id = auth.uid() AND u.activo
          AND lower(r.nombre) IN ('dueño', 'dueno') AND cu.cafeteria_id = p_cafeteria_id
    )
$$;
\i database/fixes/administrar_campanas_afiliados.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
    resultado jsonb;
BEGIN
    resultado := public.administrar_campana_afiliados(7, NULL, '{
        "nombre":"Semana del café", "descuento_normal_pct":15,
        "descuento_oferta_pct":5, "comision_pct":10,
        "inicio":"2099-12-01T08:00:00-03:00", "fin":"2099-12-15T20:00:00-03:00"
    }');
    IF resultado->>'estado' IS DISTINCT FROM 'programada' THEN
        RAISE EXCEPTION 'Alta inesperada: %', resultado;
    END IF;
    RAISE NOTICE 'Alta: %', resultado;
    resultado := public.administrar_campana_afiliados(7, 1, '{"descuento_normal_pct":12}');
    IF resultado->>'descuento_normal_pct' IS DISTINCT FROM '12' THEN
        RAISE EXCEPTION 'Edición inesperada: %', resultado;
    END IF;
END $$;

RESET ROLE;
UPDATE public.campanas_afiliados SET inicio = now() - interval '1 day' WHERE id = 1;
SET ROLE authenticated;
DO $$
DECLARE
    resultado jsonb;
    cambios jsonb;
    intento record;
BEGIN
    resultado := public.administrar_campana_afiliados(7, 1, '{"pausada":true}');
    IF resultado->>'estado' IS DISTINCT FROM 'pausada' THEN
        RAISE EXCEPTION 'Pausa inesperada: %', resultado;
    END IF;

    FOR intento IN SELECT * FROM (VALUES
        ('00000000-0000-0000-0000-000000000002', 7),
        ('00000000-0000-0000-0000-000000000002', 8),
        ('00000000-0000-0000-0000-000000000003', 7)
    ) AS casos(usuario, cafeteria) LOOP
        PERFORM set_config('request.jwt.claim.sub', intento.usuario, true);
        FOREACH cambios IN ARRAY ARRAY['{"nombre":"Ajena"}'::jsonb, '{"pausada":false}'::jsonb] LOOP
            BEGIN
                PERFORM public.administrar_campana_afiliados(intento.cafeteria, 1, cambios);
                RAISE EXCEPTION 'Se permitió editar o activar fuera del alcance';
            EXCEPTION WHEN insufficient_privilege THEN
                IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
            END;
        END LOOP;
    END LOOP;

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, 1, '{"descuento_normal_pct":20}');
        RAISE EXCEPTION 'Se permitió cambiar porcentajes después del inicio';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'porcentajes_fijados' THEN RAISE; END IF;
    END;
    resultado := public.administrar_campana_afiliados(7, 1, '{"pausada":false}');
    IF resultado->>'estado' IS DISTINCT FROM 'activa'
       OR resultado->>'nombre' IS DISTINCT FROM 'Semana del café'
       OR resultado->>'descuento_normal_pct' IS DISTINCT FROM '12' THEN
        RAISE EXCEPTION 'Reanudación inesperada: %', resultado;
    END IF;
    RAISE NOTICE 'Reanudación: %', resultado;
END $$;

RESET ROLE;
UPDATE public.campanas_afiliados SET fin = now() - interval '1 hour' WHERE id = 1;
SET ROLE authenticated;
DO $$
BEGIN
    PERFORM public.administrar_campana_afiliados(7, 1, '{"pausada":false}');
    RAISE EXCEPTION 'Se permitió reanudar una campaña finalizada';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'campana_finalizada' THEN RAISE; END IF;
    RAISE NOTICE 'Reanudación tras término rechazada';
END $$;
