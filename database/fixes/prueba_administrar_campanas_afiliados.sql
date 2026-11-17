-- Prueba reproducible de C03 · administración de campañas de afiliados.
--
-- Reproduce las definiciones V05 0018/0019 de db_CoffeeFaster que C03
-- necesita: tabla campanas, función dueno_campana_id, RLS/grants, trigger
-- proteger_confirmacion_campanas y RPC confirmar_condiciones_campana.
--
-- La identidad auth.uid() se simula con request.jwt.claim.sub. Los contratos
-- de negocio, privilegios y triggers son los reales; no se sustituyen por un
-- trigger simplificado.
--
-- Las campañas ya aceptadas o ya iniciadas se insertan como fixtures. La
-- aceptación que se valida se ejecuta siempre con
-- public.confirmar_condiciones_campana; no se acepta con UPDATE ni con el
-- trigger deshabilitado.
--
-- Ejecutar solo en PostgreSQL desechable, desde la raíz del repositorio:
--   psql -v ON_ERROR_STOP=1 -f database/fixes/prueba_administrar_campanas_afiliados.sql
\set ON_ERROR_STOP on

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.cafeterias (id bigint PRIMARY KEY);
CREATE TABLE public.roles (id bigint PRIMARY KEY, nombre text, activo boolean NOT NULL DEFAULT true);
CREATE TABLE public.usuarios (
    id bigint PRIMARY KEY,
    rol_id bigint,
    activo boolean,
    auth_user_id uuid
);
CREATE TABLE public.cafeteria_usuarios (usuario_id bigint, cafeteria_id bigint);

INSERT INTO public.cafeterias VALUES (7), (8);
INSERT INTO public.roles VALUES
    (1, 'dueno', true),
    (2, 'empleado', true),
    (3, 'dueno', false);
INSERT INTO public.usuarios VALUES
    (1, 1, true, '00000000-0000-0000-0000-000000000001'),
    (2, 1, true, '00000000-0000-0000-0000-000000000002'),
    (3, 2, true, '00000000-0000-0000-0000-000000000003'),
    (4, 1, false, '00000000-0000-0000-0000-000000000004'),
    (5, 3, true, '00000000-0000-0000-0000-000000000005');
INSERT INTO public.cafeteria_usuarios VALUES (1, 7), (2, 8), (3, 7), (4, 7), (5, 7);

-- V05 0018: tabla campanas, sin columnas ficticias. dueno_campana_id es una
-- función de 0019, no una columna de esta tabla.
CREATE TABLE public.campanas (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id            bigint NOT NULL REFERENCES public.cafeterias(id) ON DELETE CASCADE,
    nombre                  varchar(150) NOT NULL,
    descripcion             text,
    tipo                    varchar(50) NOT NULL DEFAULT 'carrito_completo'
                            CHECK (tipo IN ('carrito_completo')),
    estado                  varchar(30) NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'activa', 'pausada', 'finalizada', 'pendiente_aceptacion', 'aceptada')),
    version_condiciones     varchar(20) NOT NULL DEFAULT '1.0',
    tasa_descuento          numeric(5,2) NOT NULL DEFAULT 0.00
                            CHECK (tasa_descuento >= 0.00 AND tasa_descuento <= 100.00),
    tasa_comision           numeric(5,2) NOT NULL DEFAULT 0.00
                            CHECK (tasa_comision >= 0.00 AND tasa_comision <= 100.00),
    vigencia_desde          timestamptz NOT NULL,
    vigencia_hasta          timestamptz NOT NULL,
    confirmada_por_dueno    boolean NOT NULL DEFAULT false,
    fecha_confirmacion      timestamptz,
    usuario_confirma_id     bigint REFERENCES public.usuarios(id) ON DELETE SET NULL,
    version_confirmada      varchar(20),
    creado_en               timestamptz NOT NULL DEFAULT clock_timestamp(),
    actualizado_en          timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_campanas_vigencia CHECK (vigencia_hasta > vigencia_desde)
);

-- V05 0019: identidad del dueño. Es una función, no una columna.
CREATE OR REPLACE FUNCTION public.dueno_campana_id(p_cafeteria_id bigint)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT u.id FROM public.usuarios u
    JOIN public.roles r ON r.id = u.rol_id
    JOIN public.cafeteria_usuarios cu ON cu.usuario_id = u.id
    WHERE u.auth_user_id = auth.uid() AND u.activo AND r.activo
      AND lower(r.nombre) IN ('dueño', 'dueno') AND cu.cafeteria_id = p_cafeteria_id
    LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.dueno_campana_id(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dueno_campana_id(bigint) TO authenticated;

-- V05 0019: RLS y privilegios reales. authenticated solo puede leer; las
-- escrituras pasan por funciones SECURITY DEFINER.
ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campanas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.campanas TO authenticated;
GRANT ALL ON public.campanas TO service_role;

CREATE POLICY campanas_select_operador ON public.campanas FOR SELECT TO authenticated
    USING (public.dueno_campana_id(cafeteria_id) IS NOT NULL);

-- V05 0019: trigger real, sin la extensión de oferta. Nuestra migración lo
-- reemplazará por la versión extendida.
CREATE OR REPLACE FUNCTION public.proteger_confirmacion_campanas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Utilice la RPC para confirmar condiciones' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.confirmada_por_dueno AND ROW(
            NEW.cafeteria_id, NEW.nombre, NEW.descripcion, NEW.tipo, NEW.version_condiciones,
            NEW.tasa_descuento, NEW.tasa_comision, NEW.vigencia_desde, NEW.vigencia_hasta,
            NEW.confirmada_por_dueno, NEW.fecha_confirmacion, NEW.usuario_confirma_id, NEW.version_confirmada
        ) IS DISTINCT FROM ROW(
            OLD.cafeteria_id, OLD.nombre, OLD.descripcion, OLD.tipo, OLD.version_condiciones,
            OLD.tasa_descuento, OLD.tasa_comision, OLD.vigencia_desde, OLD.vigencia_hasta,
            OLD.confirmada_por_dueno, OLD.fecha_confirmacion, OLD.usuario_confirma_id, OLD.version_confirmada
        ) THEN
            RAISE EXCEPTION 'La aceptación es inmutable; cree una nueva campaña para otras condiciones'
                USING ERRCODE = '22023';
        END IF;
        IF ROW(NEW.nombre, NEW.descripcion, NEW.tasa_descuento, NEW.tasa_comision, NEW.vigencia_desde, NEW.vigencia_hasta)
            IS DISTINCT FROM ROW(OLD.nombre, OLD.descripcion, OLD.tasa_descuento, OLD.tasa_comision, OLD.vigencia_desde, OLD.vigencia_hasta)
            AND trim(NEW.version_condiciones) = trim(OLD.version_condiciones) THEN
            RAISE EXCEPTION 'Cambiar condiciones requiere una nueva versión' USING ERRCODE = '22023';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_confirmacion_campanas() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_proteger_confirmacion_campanas BEFORE INSERT OR UPDATE ON public.campanas
    FOR EACH ROW EXECUTE FUNCTION public.proteger_confirmacion_campanas();

-- V05 0019: aceptación real. Conserva la restricción de vigencia y la firma
-- de tres argumentos. No se modifica.
CREATE OR REPLACE FUNCTION public.confirmar_condiciones_campana(
    p_campana_id bigint, p_cafeteria_id bigint, p_version text
)
RETURNS public.campanas LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_usuario_id bigint;
    v_campana public.campanas;
BEGIN
    v_usuario_id := public.dueno_campana_id(p_cafeteria_id);
    IF auth.uid() IS NULL OR v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Solo el dueño activo de la cafetería puede confirmar' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_campana FROM public.campanas
    WHERE id = p_campana_id AND cafeteria_id = p_cafeteria_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaña no encontrada' USING ERRCODE = 'P0002';
    END IF;
    IF trim(coalesce(p_version, '')) = '' OR trim(p_version) IS DISTINCT FROM trim(v_campana.version_condiciones) THEN
        RAISE EXCEPTION 'La versión cambió; revise las condiciones de nuevo' USING ERRCODE = '22023';
    END IF;
    IF v_campana.estado NOT IN ('pendiente_aceptacion', 'activa') OR
       v_campana.vigencia_desde > clock_timestamp() OR v_campana.vigencia_hasta <= clock_timestamp() THEN
        RAISE EXCEPTION 'La campaña no está vigente para aceptar condiciones' USING ERRCODE = '22023';
    END IF;
    IF v_campana.confirmada_por_dueno THEN
        IF v_campana.version_confirmada IS DISTINCT FROM v_campana.version_condiciones THEN
            RAISE EXCEPTION 'La aceptación no corresponde a la versión vigente' USING ERRCODE = '22023';
        END IF;
        RETURN v_campana;
    END IF;
    UPDATE public.campanas SET confirmada_por_dueno = true, fecha_confirmacion = clock_timestamp(),
        usuario_confirma_id = v_usuario_id, version_confirmada = trim(p_version), estado = 'activa',
        actualizado_en = clock_timestamp()
    WHERE id = p_campana_id RETURNING * INTO v_campana;
    RETURN v_campana;
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_condiciones_campana(bigint, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_condiciones_campana(bigint, bigint, text) TO authenticated;

CREATE TABLE public.cf_test_ids (nombre text PRIMARY KEY, id bigint);
GRANT SELECT, INSERT, UPDATE ON public.cf_test_ids TO authenticated;

-- Fixtures. Se insertan como postgres; no son aceptaciones. Las campañas
-- dentro de vigencia se usan para que confirmar_condiciones_campana pueda
-- operar con su restricción real. Las campañas futuras se crean con C03.
WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, descripcion, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta,
        confirmada_por_dueno, fecha_confirmacion, usuario_confirma_id, version_confirmada
    ) VALUES (
        7, 'Convenio previo', 'Aceptado antes de C03', 'activa', '1.0',
        10, 3, now() - interval '1 day', now() + interval '1 day',
        true, now(), 1, '1.0'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'legacy7', id FROM insertada;

WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta,
        confirmada_por_dueno, fecha_confirmacion, usuario_confirma_id, version_confirmada
    ) VALUES (
        8, 'Convenio de la cafetería 8', 'activa', '1.0',
        20, 4, now() - interval '1 day', now() + interval '1 day',
        true, now(), 2, '1.0'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'legacy8', id FROM insertada;

WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, descripcion, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta
    ) VALUES (
        7, 'Campaña aceptable', 'Dentro de vigencia para aceptar', 'pendiente_aceptacion', '1.0',
        15, 10, now() - interval '1 hour', now() + interval '1 day'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'aceptable', id FROM insertada;

WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta
    ) VALUES (
        7, 'Campaña futura para trigger', 'pendiente_aceptacion', '1.0',
        15, 10, now() + interval '1 day', now() + interval '10 days'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'trigger_futura', id FROM insertada;

WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta
    ) VALUES (
        7, 'Campaña iniciada pendiente', 'pendiente_aceptacion', '1.0',
        10, 3, now() - interval '1 day', now() + interval '1 day'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'iniciada_pendiente', id FROM insertada;

WITH insertada AS (
    INSERT INTO public.campanas (
        cafeteria_id, nombre, estado, version_condiciones,
        tasa_descuento, tasa_comision, vigencia_desde, vigencia_hasta,
        confirmada_por_dueno, fecha_confirmacion, usuario_confirma_id, version_confirmada
    ) VALUES (
        7, 'Campaña finalizada', 'activa', '1.0',
        10, 3, now() - interval '2 days', now() - interval '1 day',
        true, now() - interval '2 days', 1, '1.0'
    ) RETURNING id
)
INSERT INTO public.cf_test_ids SELECT 'finalizada', id FROM insertada;

\echo 'Aplicando la migración integrada C03...'
\i database/fixes/administrar_campanas_afiliados.sql

-- 1. Regresiones del esquema: dueno_campana_id es función, no columna.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'campanas'
          AND column_name = 'dueno_campana_id'
    ) THEN
        RAISE EXCEPTION 'campanas no debe tener una columna dueno_campana_id';
    END IF;
    IF to_regprocedure('public.dueno_campana_id(bigint)') IS NULL THEN
        RAISE EXCEPTION 'Falta la función dueno_campana_id';
    END IF;
    IF to_regprocedure('public.confirmar_condiciones_campana(bigint, bigint, text)') IS NULL THEN
        RAISE EXCEPTION 'Falta la RPC real de aceptación';
    END IF;
    IF to_regprocedure('public.siguiente_version_condiciones(text)') IS NULL THEN
        RAISE EXCEPTION 'Falta la función de versionado';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'campanas'
          AND column_name = 'tasa_descuento_oferta'
    ) THEN
        RAISE EXCEPTION 'Falta tasa_descuento_oferta';
    END IF;
    IF position('current_user IN (''authenticated'', ''anon'')' IN
        pg_get_functiondef('public.proteger_confirmacion_campanas()'::regprocedure)) = 0 THEN
        RAISE EXCEPTION 'El trigger perdió la prohibición de escrituras directas';
    END IF;
    IF position('tasa_descuento_oferta' IN
        pg_get_functiondef('public.proteger_confirmacion_campanas()'::regprocedure)) = 0 THEN
        RAISE EXCEPTION 'El trigger no extendió la protección de oferta';
    END IF;
    RAISE NOTICE 'Esquema V05 y extensión del trigger verificados';
END $$;

-- 2. La migración conserva la campaña previa y no inventa dueno_campana_id.
DO $$
DECLARE
    previa public.campanas;
    json_previa jsonb;
BEGIN
    SELECT * INTO previa FROM public.campanas
    WHERE id = (SELECT id FROM public.cf_test_ids WHERE nombre = 'legacy7');
    json_previa := to_jsonb(previa);
    IF previa.tasa_descuento <> 10 OR previa.tasa_comision <> 3 THEN
        RAISE EXCEPTION 'La migración modificó condiciones existentes: %', json_previa;
    END IF;
    IF previa.tasa_descuento_oferta IS NOT NULL THEN
        RAISE EXCEPTION 'La migración rellenó el descuento de oferta existente: %', json_previa;
    END IF;
    IF NOT previa.confirmada_por_dueno OR previa.version_confirmada <> '1.0' THEN
        RAISE EXCEPTION 'La migración alteró la aceptación existente: %', json_previa;
    END IF;
    IF json_previa ? 'dueno_campana_id' THEN
        RAISE EXCEPTION 'La respuesta contiene una columna dueno_campana_id ficticia: %', json_previa;
    END IF;
    RAISE NOTICE 'Conservación de campaña previa: %', json_previa;
END $$;

-- 3. Formato de versión generado por el servidor.
DO $$
DECLARE
    v text;
BEGIN
    IF public.siguiente_version_condiciones('1.0') IS DISTINCT FROM '1.1' THEN
        RAISE EXCEPTION 'Versión 1.0 inesperada';
    END IF;
    IF public.siguiente_version_condiciones('1.9') IS DISTINCT FROM '1.10' THEN
        RAISE EXCEPTION 'Versión 1.9 inesperada';
    END IF;
    v := public.siguiente_version_condiciones('foo');
    IF length(v) <> 20 OR v = 'foo' THEN
        RAISE EXCEPTION 'Respaldo de versión inesperado: %', v;
    END IF;
    RAISE NOTICE 'Formato de versión: 1.0 -> 1.1; 1.9 -> 1.10; respaldo %', v;
END $$;

-- 4. Alta, listado y contrato de escritorio.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
    resultado jsonb;
    listado jsonb;
    campana_id bigint;
    encontradas integer;
    ajenas integer;
BEGIN
    resultado := public.administrar_campana_afiliados(7, NULL, '{
        "nombre":"Semana del café",
        "descripcion":"Campaña de prueba C03",
        "descuento_normal_pct":15,
        "descuento_oferta_pct":5,
        "comision_pct":10,
        "inicio":"2099-12-01T08:00:00-03:00",
        "fin":"2099-12-15T20:00:00-03:00"
    }');

    campana_id := (resultado->>'id')::bigint;
    INSERT INTO public.cf_test_ids VALUES ('c03', campana_id);

    IF resultado->>'estado' IS DISTINCT FROM 'pendiente_aceptacion'
       OR resultado->>'version_condiciones' IS DISTINCT FROM '1.0' THEN
        RAISE EXCEPTION 'Alta inesperada: %', resultado;
    END IF;
    IF (resultado->>'tasa_descuento')::numeric <> 15
       OR (resultado->>'tasa_descuento_oferta')::numeric <> 5
       OR (resultado->>'tasa_comision')::numeric <> 10 THEN
        RAISE EXCEPTION 'Mapeo de porcentajes inesperado: %', resultado;
    END IF;
    IF (resultado->>'confirmada_por_dueno')::boolean THEN
        RAISE EXCEPTION 'Aceptación inicial inesperada: %', resultado;
    END IF;
    IF resultado ? 'dueno_campana_id' THEN
        RAISE EXCEPTION 'Alta devolvió una columna ficticia: %', resultado;
    END IF;
    IF NOT (resultado ? 'descripcion' AND resultado ? 'version_condiciones'
            AND resultado ? 'confirmada_por_dueno' AND resultado ? 'version_confirmada'
            AND resultado ? 'creado_en' AND resultado ? 'actualizado_en'
            AND resultado ? 'tasa_descuento' AND resultado ? 'tasa_comision'
            AND resultado ? 'tasa_descuento_oferta'
            AND resultado ? 'vigencia_desde' AND resultado ? 'vigencia_hasta') THEN
        RAISE EXCEPTION 'Faltan columnas del contrato de escritorio: %', resultado;
    END IF;

    listado := public.listar_campanas_afiliados(7);
    SELECT count(*) INTO encontradas
    FROM jsonb_array_elements(listado) AS e
    WHERE (e->>'id')::bigint = campana_id;
    SELECT count(*) INTO ajenas
    FROM jsonb_array_elements(listado) AS e
    WHERE (e->>'cafeteria_id')::bigint <> 7;
    IF encontradas <> 1 OR ajenas <> 0 THEN
        RAISE EXCEPTION 'Listado inesperado: %', listado;
    END IF;

    RAISE NOTICE 'Alta y lectura: %', resultado;
    RAISE NOTICE 'Listado cafetería 7: %', listado;
END $$;

-- 5. Editar condiciones pendientes aumenta la versión.
DO $$
DECLARE
    r jsonb;
    campana_id bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
BEGIN
    r := public.administrar_campana_afiliados(7, campana_id, '{
        "nombre":"Semana del café editada",
        "descripcion":"Descripción editada",
        "descuento_normal_pct":12
    }');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.1'
       OR r->>'nombre' IS DISTINCT FROM 'Semana del café editada'
       OR r->>'descripcion' IS DISTINCT FROM 'Descripción editada'
       OR (r->>'tasa_descuento')::numeric <> 12
       OR (r->>'tasa_descuento_oferta')::numeric <> 5 THEN
        RAISE EXCEPTION 'Edición con versión nueva inesperada: %', r;
    END IF;
    RAISE NOTICE 'Edición de condiciones: %', r;
END $$;

-- 6. Enviar valores idénticos no aumenta la versión.
DO $$
DECLARE
    r jsonb;
    campana_id bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
BEGIN
    r := public.administrar_campana_afiliados(7, campana_id, '{
        "nombre":"Semana del café editada",
        "descripcion":"Descripción editada",
        "descuento_normal_pct":12,
        "descuento_oferta_pct":5,
        "comision_pct":10,
        "inicio":"2099-12-01T08:00:00-03:00",
        "fin":"2099-12-15T20:00:00-03:00"
    }');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.1' THEN
        RAISE EXCEPTION 'Valores idénticos aumentaron la versión: %', r;
    END IF;
    RAISE NOTICE 'Valores idénticos conservan versión 1.1';
END $$;

-- 7. Cambiar solo el descuento de oferta exige y aumenta la versión.
DO $$
DECLARE
    r jsonb;
    campana_id bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
BEGIN
    r := public.administrar_campana_afiliados(7, campana_id, '{"descuento_oferta_pct":6}');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.2'
       OR (r->>'tasa_descuento_oferta')::numeric <> 6 THEN
        RAISE EXCEPTION 'Cambio de oferta inesperado: %', r;
    END IF;
    RAISE NOTICE 'Cambio solo de oferta: versión % y tasa %',
        r->>'version_condiciones', r->>'tasa_descuento_oferta';
END $$;

-- 8. Comisión, fechas y descripción también versionan.
DO $$
DECLARE
    r jsonb;
    campana_id bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
BEGIN
    r := public.administrar_campana_afiliados(7, campana_id, '{"comision_pct":11}');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.3' THEN
        RAISE EXCEPTION 'Comisión no versionó: %', r;
    END IF;

    r := public.administrar_campana_afiliados(7, campana_id, '{
        "inicio":"2099-12-02T08:00:00-03:00",
        "fin":"2099-12-16T20:00:00-03:00"
    }');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.4' THEN
        RAISE EXCEPTION 'Fechas no versionaron: %', r;
    END IF;

    r := public.administrar_campana_afiliados(7, campana_id, '{"descripcion":"Otra descripción"}');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.5' THEN
        RAISE EXCEPTION 'Descripción no versionó: %', r;
    END IF;

    r := public.administrar_campana_afiliados(7, campana_id, '{"nombre":"  Semana del café editada  "}');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.5' THEN
        RAISE EXCEPTION 'Nombre normalizado idéntico versionó: %', r;
    END IF;

    RAISE NOTICE 'Versiones por comisión, fechas, descripción y nombre: %', r->>'version_condiciones';
END $$;

-- 9. Aceptación real: versión anterior rechazada, versión actual aceptada e
--    idempotencia. La campaña fixture ya está dentro de vigencia.
DO $$
DECLARE
    aceptable bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'aceptable');
    resultado public.campanas;
BEGIN
    BEGIN
        PERFORM public.confirmar_condiciones_campana(aceptable, 7, '0.9');
        RAISE EXCEPTION 'Se aceptó una versión anterior';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'La versión cambió; revise las condiciones de nuevo' THEN RAISE; END IF;
    END;

    resultado := public.confirmar_condiciones_campana(aceptable, 7, '1.0');
    IF NOT resultado.confirmada_por_dueno
       OR resultado.version_confirmada <> '1.0'
       OR resultado.estado <> 'activa'
       OR resultado.usuario_confirma_id <> 1
       OR resultado.fecha_confirmacion IS NULL THEN
        RAISE EXCEPTION 'Aceptación real inesperada: %', to_jsonb(resultado);
    END IF;

    resultado := public.confirmar_condiciones_campana(aceptable, 7, '1.0');
    IF NOT resultado.confirmada_por_dueno OR resultado.version_confirmada <> '1.0' THEN
        RAISE EXCEPTION 'Aceptación no idempotente: %', to_jsonb(resultado);
    END IF;

    RAISE NOTICE 'Aceptación real V05: %', to_jsonb(resultado);
END $$;

-- 10. confirmar_condiciones_campana conserva su restricción de vigencia.
DO $$
DECLARE
    futura bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
    version_actual text;
BEGIN
    SELECT version_condiciones INTO version_actual FROM public.campanas WHERE id = futura;
    BEGIN
        PERFORM public.confirmar_condiciones_campana(futura, 7, version_actual);
        RAISE EXCEPTION 'Se aceptó una campaña futura';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'La campaña no está vigente para aceptar condiciones' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'Aceptación futura rechazada por la restricción V05 de vigencia';
END $$;

-- 11. Tras aceptar, la RPC rechaza nombre, descripción, tasas y fechas.
DO $$
DECLARE
    aceptable bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'aceptable');
    cambios jsonb;
BEGIN
    FOREACH cambios IN ARRAY ARRAY[
        '{"nombre":"Nombre prohibido"}'::jsonb,
        '{"descripcion":"Descripción prohibida"}'::jsonb,
        '{"descuento_normal_pct":20}'::jsonb,
        '{"descuento_oferta_pct":2}'::jsonb,
        '{"comision_pct":2}'::jsonb,
        '{"inicio":"2026-01-01T00:00:00Z"}'::jsonb,
        '{"fin":"2030-01-01T00:00:00Z"}'::jsonb
    ] LOOP
        BEGIN
            PERFORM public.administrar_campana_afiliados(7, aceptable, cambios);
            RAISE EXCEPTION 'La RPC permitió cambiar condiciones aceptadas: %', cambios;
        EXCEPTION WHEN raise_exception THEN
            IF SQLERRM <> 'condiciones_aceptadas' THEN RAISE; END IF;
        END;
    END LOOP;

    IF (SELECT version_condiciones FROM public.campanas WHERE id = aceptable) <> '1.0' THEN
        RAISE EXCEPTION 'La versión de la campaña aceptada cambió';
    END IF;
    RAISE NOTICE 'RPC rechaza nombre, descripción, tasas y fechas aceptadas';
END $$;

-- 12. El trigger real, con la extensión de oferta, protege la aceptación.
RESET ROLE;
DO $$
DECLARE
    aceptable bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'aceptable');
    cambios jsonb;
BEGIN
    FOREACH cambios IN ARRAY ARRAY[
        '{"nombre":"Nombre prohibido"}'::jsonb,
        '{"descripcion":"Descripción prohibida"}'::jsonb,
        '{"tasa_descuento":20}'::jsonb,
        '{"tasa_descuento_oferta":2}'::jsonb,
        '{"tasa_comision":2}'::jsonb,
        '{"vigencia_desde":"2026-01-01T00:00:00Z"}'::jsonb,
        '{"vigencia_hasta":"2030-01-01T00:00:00Z"}'::jsonb,
        '{"tasa_descuento_oferta":2,"version_condiciones":"9.9"}'::jsonb
    ] LOOP
        BEGIN
            UPDATE public.campanas
            SET nombre = CASE WHEN cambios ? 'nombre' THEN cambios->>'nombre' ELSE nombre END,
                descripcion = CASE WHEN cambios ? 'descripcion' THEN cambios->>'descripcion' ELSE descripcion END,
                tasa_descuento = CASE WHEN cambios ? 'tasa_descuento' THEN (cambios->>'tasa_descuento')::numeric ELSE tasa_descuento END,
                tasa_descuento_oferta = CASE WHEN cambios ? 'tasa_descuento_oferta' THEN (cambios->>'tasa_descuento_oferta')::numeric ELSE tasa_descuento_oferta END,
                tasa_comision = CASE WHEN cambios ? 'tasa_comision' THEN (cambios->>'tasa_comision')::numeric ELSE tasa_comision END,
                vigencia_desde = CASE WHEN cambios ? 'vigencia_desde' THEN (cambios->>'vigencia_desde')::timestamptz ELSE vigencia_desde END,
                vigencia_hasta = CASE WHEN cambios ? 'vigencia_hasta' THEN (cambios->>'vigencia_hasta')::timestamptz ELSE vigencia_hasta END,
                version_condiciones = CASE WHEN cambios ? 'version_condiciones' THEN cambios->>'version_condiciones' ELSE version_condiciones END
            WHERE id = aceptable;
            RAISE EXCEPTION 'El trigger permitió cambiar condiciones aceptadas: %', cambios;
        EXCEPTION WHEN SQLSTATE '22023' THEN
            IF SQLERRM <> 'La aceptación es inmutable; cree una nueva campaña para otras condiciones' THEN RAISE; END IF;
        END;
    END LOOP;
    RAISE NOTICE 'Trigger real protege nombre, descripción, tasas, oferta y fechas aceptadas';
END $$;

-- 13. El trigger exige versión nueva para oferta antes de aceptar.
RESET ROLE;
DO $$
DECLARE
    pendiente bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'trigger_futura');
    actual text;
BEGIN
    SELECT version_condiciones INTO actual FROM public.campanas WHERE id = pendiente;
    BEGIN
        UPDATE public.campanas SET tasa_descuento_oferta = 4 WHERE id = pendiente;
        RAISE EXCEPTION 'El trigger permitió cambiar oferta sin versión';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'Cambiar condiciones requiere una nueva versión' THEN RAISE; END IF;
    END;

    UPDATE public.campanas
    SET tasa_descuento_oferta = 4, version_condiciones = '1.1'
    WHERE id = pendiente;

    IF (SELECT version_condiciones FROM public.campanas WHERE id = pendiente) <> '1.1'
       OR (SELECT tasa_descuento_oferta FROM public.campanas WHERE id = pendiente) <> 4 THEN
        RAISE EXCEPTION 'El trigger no permitió oferta con versión nueva';
    END IF;
    RAISE NOTICE 'Trigger exige versión para oferta: % -> 1.1', actual;
END $$;

-- 14. authenticated no tiene escrituras directas y anon no tiene lectura.
RESET ROLE;
DO $$
BEGIN
    IF has_table_privilege('authenticated', 'public.campanas', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated conserva UPDATE directo';
    END IF;
    IF has_table_privilege('authenticated', 'public.campanas', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated conserva INSERT directo';
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.campanas', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated perdió SELECT';
    END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
    previa bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'legacy7');
BEGIN
    BEGIN
        UPDATE public.campanas SET nombre = 'Directo' WHERE id = previa;
        RAISE EXCEPTION 'authenticated pudo escribir directamente';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    RAISE NOTICE 'Escritura directa de authenticated rechazada';
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
    BEGIN
        PERFORM count(*) FROM public.campanas;
        RAISE EXCEPTION 'anon pudo leer campanas';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    RAISE NOTICE 'Lectura de anon rechazada';
END $$;

-- 15. Pausa y reanudación conservan versión, condiciones y aceptación.
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
    aceptable bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'aceptable');
    pausada jsonb;
    reanudada jsonb;
BEGIN
    pausada := public.administrar_campana_afiliados(7, aceptable, '{"pausada":true}');
    IF pausada->>'estado' IS DISTINCT FROM 'pausada'
       OR pausada->>'version_condiciones' IS DISTINCT FROM '1.0'
       OR (pausada->>'tasa_descuento')::numeric <> 15
       OR (pausada->>'tasa_descuento_oferta') IS NOT NULL
       OR (pausada->>'tasa_comision')::numeric <> 10
       OR NOT (pausada->>'confirmada_por_dueno')::boolean
       OR pausada->>'version_confirmada' IS DISTINCT FROM '1.0' THEN
        RAISE EXCEPTION 'Pausa inesperada: %', pausada;
    END IF;

    reanudada := public.administrar_campana_afiliados(7, aceptable, '{"pausada":false}');
    IF reanudada->>'estado' IS DISTINCT FROM 'activa'
       OR reanudada->>'version_condiciones' IS DISTINCT FROM '1.0'
       OR (reanudada->>'tasa_descuento')::numeric <> 15
       OR (reanudada->>'tasa_comision')::numeric <> 10
       OR NOT (reanudada->>'confirmada_por_dueno')::boolean
       OR reanudada->>'version_confirmada' IS DISTINCT FROM '1.0' THEN
        RAISE EXCEPTION 'Reanudación inesperada: %', reanudada;
    END IF;

    RAISE NOTICE 'Pausa: %', pausada;
    RAISE NOTICE 'Reanudación: %', reanudada;
END $$;

-- 16. Campaña finalizada.
DO $$
DECLARE
    finalizada bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'finalizada');
BEGIN
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, finalizada, '{"pausada":false}');
        RAISE EXCEPTION 'Se reanudó una campaña finalizada';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_finalizada' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'Reanudación tras término rechazada';
END $$;

-- 17. Porcentajes y fechas fijados desde el inicio; nombre/descripción no.
DO $$
DECLARE
    iniciada bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'iniciada_pendiente');
    r jsonb;
BEGIN
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, iniciada, '{"descuento_normal_pct":11}');
        RAISE EXCEPTION 'Se editaron porcentajes después del inicio';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'porcentajes_fijados' THEN RAISE; END IF;
    END;

    r := public.administrar_campana_afiliados(7, iniciada, '{"nombre":"Nombre iniciado"}');
    IF r->>'version_condiciones' IS DISTINCT FROM '1.1'
       OR r->>'nombre' IS DISTINCT FROM 'Nombre iniciado' THEN
        RAISE EXCEPTION 'Nombre no versionó después del inicio: %', r;
    END IF;

    RAISE NOTICE 'Porcentajes fijados; nombre versionado: %', r->>'version_condiciones';
END $$;

-- 18. Validaciones de entrada.
DO $$
BEGIN
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, NULL, '{
            "nombre":"Oferta inválida", "descuento_normal_pct":10,
            "descuento_oferta_pct":15, "comision_pct":5,
            "inicio":"2099-12-01T08:00:00-03:00", "fin":"2099-12-15T20:00:00-03:00"
        }');
        RAISE EXCEPTION 'Se permitió una oferta mayor que el descuento normal';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_invalida' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, NULL, '{
            "nombre":"Fechas inválidas", "descuento_normal_pct":10,
            "descuento_oferta_pct":5, "comision_pct":5,
            "inicio":"2099-12-15T08:00:00-03:00", "fin":"2099-12-01T20:00:00-03:00"
        }');
        RAISE EXCEPTION 'Se permitió un fin anterior al inicio';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_invalida' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, NULL, '{
            "nombre":"Campo extra", "descuento_normal_pct":10,
            "descuento_oferta_pct":5, "comision_pct":5,
            "inicio":"2099-12-01T08:00:00-03:00", "fin":"2099-12-15T20:00:00-03:00",
            "version_condiciones":"9.9"
        }');
        RAISE EXCEPTION 'Se aceptó version_condiciones del cliente';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_invalida' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, (SELECT id FROM public.cf_test_ids WHERE nombre='iniciada_pendiente'), '{"cafeteria_id":8}');
        RAISE EXCEPTION 'Se permitió reasignar la cafetería';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_invalida' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'Validaciones de entrada verificadas';
END $$;

-- 19. Activación sin aceptación.
DO $$
DECLARE
    futura bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'c03');
BEGIN
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, futura, '{"pausada":false}');
        RAISE EXCEPTION 'Se activó sin aceptación';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'aceptacion_requerida' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, futura, '{"pausada":true}');
        RAISE EXCEPTION 'Se pausó sin aceptación';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'campana_no_activa' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'Activación y pausa sin aceptación rechazadas';
END $$;

-- 19b. Ciclo completo de una misma campaña C03 con triggers habilitados:
--      alta futura, edición, rechazo antes de vigencia, espera acotada,
--      rechazo de versión anterior, aceptación real, pausa, reanudación e
--      inmutabilidad posterior.
DO $$
DECLARE
    v_id bigint;
    v_inicio_texto text;
    v_fin_texto text;
    v_r jsonb;
    v_resultado public.campanas;
    v_inicio_ts timestamptz;
    v_fin_ts timestamptz;
    v_tasa_normal numeric;
    v_tasa_oferta numeric;
    v_comision numeric;
    v_version text;
    v_fecha_confirmacion timestamptz;
    v_limite timestamptz;
BEGIN
    v_inicio_texto := to_char(
        (clock_timestamp() + interval '8 seconds') AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS'
    ) || 'Z';
    v_fin_texto := to_char(
        (clock_timestamp() + interval '1 day') AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS'
    ) || 'Z';

    v_r := public.administrar_campana_afiliados(7, NULL, jsonb_build_object(
        'nombre', 'Ciclo completo C03',
        'descripcion', 'Campaña con inicio próximo',
        'descuento_normal_pct', 15,
        'descuento_oferta_pct', 5,
        'comision_pct', 10,
        'inicio', v_inicio_texto,
        'fin', v_fin_texto
    ));
    v_id := (v_r->>'id')::bigint;
    IF v_r->>'version_condiciones' IS DISTINCT FROM '1.0'
       OR v_r->>'estado' IS DISTINCT FROM 'pendiente_aceptacion' THEN
        RAISE EXCEPTION 'Alta del ciclo inesperada: %', v_r;
    END IF;

    -- Antes del inicio se puede editar y la versión cambia.
    v_r := public.administrar_campana_afiliados(7, v_id, '{"descuento_normal_pct":12}');
    IF v_r->>'version_condiciones' IS DISTINCT FROM '1.1'
       OR (v_r->>'tasa_descuento')::numeric <> 12 THEN
        RAISE EXCEPTION 'Edición antes del inicio inesperada: %', v_r;
    END IF;

    -- Antes de la vigencia no se puede aceptar.
    BEGIN
        PERFORM public.confirmar_condiciones_campana(v_id, 7, '1.1');
        RAISE EXCEPTION 'Se aceptó una campaña antes de su vigencia';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'La campaña no está vigente para aceptar condiciones' THEN RAISE; END IF;
    END;

    -- Espera acotada a que comience la vigencia. Margen de 8 s y límite 30 s.
    SELECT vigencia_desde INTO v_inicio_ts FROM public.campanas WHERE id = v_id;
    v_limite := clock_timestamp() + interval '30 seconds';
    WHILE clock_timestamp() < v_inicio_ts AND clock_timestamp() < v_limite LOOP
        PERFORM pg_sleep(0.25);
    END LOOP;
    IF clock_timestamp() < v_inicio_ts THEN
        RAISE EXCEPTION 'La campaña del ciclo no inició dentro del límite';
    END IF;

    -- La versión anterior ya no sirve.
    BEGIN
        PERFORM public.confirmar_condiciones_campana(v_id, 7, '1.0');
        RAISE EXCEPTION 'Se aceptó una versión anterior';
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'La versión cambió; revise las condiciones de nuevo' THEN RAISE; END IF;
    END;

    -- Aceptación real de la versión actual.
    v_resultado := public.confirmar_condiciones_campana(v_id, 7, '1.1');
    IF v_resultado.estado <> 'activa'
       OR NOT v_resultado.confirmada_por_dueno
       OR v_resultado.version_confirmada <> '1.1'
       OR v_resultado.usuario_confirma_id <> 1
       OR v_resultado.fecha_confirmacion IS NULL THEN
        RAISE EXCEPTION 'Aceptación del ciclo inesperada: %', to_jsonb(v_resultado);
    END IF;

    v_fin_ts := v_resultado.vigencia_hasta;
    v_tasa_normal := v_resultado.tasa_descuento;
    v_tasa_oferta := v_resultado.tasa_descuento_oferta;
    v_comision := v_resultado.tasa_comision;
    v_version := v_resultado.version_condiciones;
    v_fecha_confirmacion := v_resultado.fecha_confirmacion;

    -- Pausa y reanudación conservan todo.
    v_r := public.administrar_campana_afiliados(7, v_id, '{"pausada":true}');
    IF v_r->>'estado' IS DISTINCT FROM 'pausada'
       OR v_r->>'version_condiciones' IS DISTINCT FROM v_version
       OR (v_r->>'tasa_descuento')::numeric <> v_tasa_normal
       OR (v_r->>'tasa_descuento_oferta')::numeric <> v_tasa_oferta
       OR (v_r->>'tasa_comision')::numeric <> v_comision
       OR (v_r->>'vigencia_desde')::timestamptz <> v_inicio_ts
       OR (v_r->>'vigencia_hasta')::timestamptz <> v_fin_ts
       OR NOT (v_r->>'confirmada_por_dueno')::boolean
       OR v_r->>'version_confirmada' IS DISTINCT FROM v_version
       OR (v_r->>'fecha_confirmacion')::timestamptz <> v_fecha_confirmacion THEN
        RAISE EXCEPTION 'Pausa del ciclo inesperada: %', v_r;
    END IF;

    v_r := public.administrar_campana_afiliados(7, v_id, '{"pausada":false}');
    IF v_r->>'estado' IS DISTINCT FROM 'activa'
       OR v_r->>'version_condiciones' IS DISTINCT FROM v_version
       OR (v_r->>'tasa_descuento')::numeric <> v_tasa_normal
       OR (v_r->>'tasa_descuento_oferta')::numeric <> v_tasa_oferta
       OR (v_r->>'tasa_comision')::numeric <> v_comision
       OR (v_r->>'vigencia_desde')::timestamptz <> v_inicio_ts
       OR (v_r->>'vigencia_hasta')::timestamptz <> v_fin_ts
       OR NOT (v_r->>'confirmada_por_dueno')::boolean
       OR v_r->>'version_confirmada' IS DISTINCT FROM v_version
       OR (v_r->>'fecha_confirmacion')::timestamptz <> v_fecha_confirmacion THEN
        RAISE EXCEPTION 'Reanudación del ciclo inesperada: %', v_r;
    END IF;

    -- Después de aceptar no se puede cambiar una condición.
    BEGIN
        PERFORM public.administrar_campana_afiliados(7, v_id, '{"descripcion":"Prohibida"}');
        RAISE EXCEPTION 'Se editó una condición después de aceptar';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'condiciones_aceptadas' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'Ciclo completo C03 verificado: versión %, tasas %/%/%, inicio %, fin %',
        v_version, v_tasa_normal, v_tasa_oferta, v_comision, v_inicio_ts, v_fin_ts;
END $$;

-- 20. Alcance: dueño ajeno, empleado, dueño inactivo, campaña ajena con URL
--     propia y sesión ausente.
DO $$
DECLARE
    propia bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'legacy7');
    intento record;
BEGIN
    FOR intento IN SELECT * FROM (VALUES
        ('00000000-0000-0000-0000-000000000002', 7, 'dueño ajeno'),
        ('00000000-0000-0000-0000-000000000003', 7, 'empleado'),
        ('00000000-0000-0000-0000-000000000004', 7, 'dueño inactivo')
    ) AS casos(usuario, cafeteria, caso) LOOP
        PERFORM set_config('request.jwt.claim.sub', intento.usuario, true);
        BEGIN
            PERFORM public.administrar_campana_afiliados(intento.cafeteria, propia, '{"nombre":"Ajeno"}');
            RAISE EXCEPTION 'Se permitió %', intento.caso;
        EXCEPTION WHEN insufficient_privilege THEN
            IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
        END;
        BEGIN
            PERFORM public.listar_campanas_afiliados(intento.cafeteria);
            RAISE EXCEPTION 'Se permitió listar a %', intento.caso;
        EXCEPTION WHEN insufficient_privilege THEN
            IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
        END;
    END LOOP;

    -- Dueño 8 con URL de su propia cafetería y campaña de la 7.
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
    BEGIN
        PERFORM public.administrar_campana_afiliados(8, propia, '{"nombre":"Campaña ajena"}');
        RAISE EXCEPTION 'Se permitió una campaña ajena con URL propia';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claim.sub', '', true);
    BEGIN
        PERFORM public.listar_campanas_afiliados(7);
        RAISE EXCEPTION 'Se permitió listar sin sesión';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'Alcance por cafetería, rol, campaña y sesión verificado';
END $$;

-- 20b. Dueño activo con rol inactivo: la identidad exacta de Cloud exige
--      u.activo AND r.activo. Rechazo en alta, edición, activación y listado.
DO $$
DECLARE
    propia bigint := (SELECT id FROM public.cf_test_ids WHERE nombre = 'legacy7');
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, NULL, '{
            "nombre":"Rol inactivo", "descuento_normal_pct":10,
            "descuento_oferta_pct":5, "comision_pct":5,
            "inicio":"2099-12-01T08:00:00-03:00", "fin":"2099-12-15T20:00:00-03:00"
        }');
        RAISE EXCEPTION 'Un rol inactivo pudo crear una campaña';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, propia, '{"nombre":"Rol inactivo"}');
        RAISE EXCEPTION 'Un rol inactivo pudo editar una campaña';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.administrar_campana_afiliados(7, propia, '{"pausada":false}');
        RAISE EXCEPTION 'Un rol inactivo pudo activar una campaña';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.listar_campanas_afiliados(7);
        RAISE EXCEPTION 'Un rol inactivo pudo listar campañas';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'sin_acceso_cafeteria' THEN RAISE; END IF;
    END;

    RAISE NOTICE 'Dueño activo con rol inactivo rechazado en alta, edición, activación y listado';
END $$;

-- 21. RLS de lectura y listado administrativo: cada dueño ve solo su
--     cafetería; el empleado no ve nada.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $$
DECLARE
    ajenas integer;
    propias integer;
    listado jsonb;
    ajenas_listado integer;
BEGIN
    SELECT count(*) INTO ajenas FROM public.campanas WHERE cafeteria_id = 7;
    SELECT count(*) INTO propias FROM public.campanas WHERE cafeteria_id = 8;
    IF ajenas <> 0 OR propias <> 1 THEN
        RAISE EXCEPTION 'RLS de lectura inesperada: ajenas=%, propias=%', ajenas, propias;
    END IF;

    listado := public.listar_campanas_afiliados(8);
    SELECT count(*) INTO ajenas_listado
    FROM jsonb_array_elements(listado) AS e
    WHERE (e->>'cafeteria_id')::bigint <> 8;
    IF ajenas_listado <> 0 THEN
        RAISE EXCEPTION 'El listado de la cafetería 8 incluyó campañas ajenas: %', listado;
    END IF;

    RAISE NOTICE 'RLS de lectura y listado de la cafetería 8 verificados';
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
DO $$
DECLARE
    visibles integer;
BEGIN
    SELECT count(*) INTO visibles FROM public.campanas;
    IF visibles <> 0 THEN
        RAISE EXCEPTION 'RLS mostró campañas a un empleado: %', visibles;
    END IF;
    RAISE NOTICE 'RLS de empleado sin acceso verificada';
END $$;

RESET ROLE;
RESET request.jwt.claim.sub;
\echo 'Prueba C03 completada'
