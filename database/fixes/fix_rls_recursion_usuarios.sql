-- ============================================================
-- Fix 42P17: "infinite recursion detected in policy for
-- relation \"usuarios\""
-- ============================================================
-- POR QUE FALLA:
--   Las políticas `usuarios_select_dueno`, `usuarios_insert_dueno`
--   y `usuarios_delete_dueno` tenían el EXISTS escrito A Mano:
--
--     USING (EXISTS (SELECT 1 FROM usuarios u JOIN roles r ...
--                     WHERE u.auth_user_id = auth.uid() ...))
--
--   Una política sobre `usuarios` que vuelve a leer `usuarios` es
--   recursiva: Postgres la aborta con 42P17 y TODA lectura con la
--   clave anon/authenticated devuelve 500. Por eso el escritorio
--   y el movil no cargaban ni `cafeterias`.
--
-- QUE HACE ESTE SCRIPT (no borra nada que funcione):
--   El proyecto YA tiene la funcion `es_dueno()`, que es
--   SECURITY DEFINER. Al ser SECURITY DEFINER corre con los
--   privilegios del dueño de la funcion y NO dispara las
--   politicas RLS -> no hay recursion.
--
--   Las 3 politicas rotas solo cambian `EXISTS (...)` por la
--   llamada a `es_dueno()`. Mismo comportamiento, sin recursión.
--
-- POR QUE NO se usa `bloquear_anon_sensibles.sql`:
--   Ese script BORRA esas politicas. Con RLS habilitado y sin
--   politica SELECT, el login del escritorio y del movil dejan
--   de poder leer su propio perfil (`usuarios.js` busca por
--   `auth_user_id` despues de `signInWithPassword`), y falla con
--   "No se encontro el perfil de usuario registrado".
--   Corregir es mejor que borrar.
--
-- Ejecutar en: Dashboard -> SQL Editor  (o psql de supabase_db)
-- Idempotente: se puede re-ejecutar sin error.
--
-- En local se aplico con:
--   Get-Content database\fixes\fix_rls_recursion_usuarios.sql -Raw |
--     docker exec -i supabase_db_db_CoffeeFaster psql -U postgres -d postgres -v ON_ERROR_STOP=1
-- ============================================================

-- 1) Asegurar que las funciones helper existan y sigan siendo
--    SECURITY DEFINER. Es la garantia de que no hay recursion.
--
-- OJO CON LA 'n' TILDADA DE "dueno":
--   Aqui NO se escribe el literal 'dueño'. Al pasar este archivo por
--   PowerShell hacia el contenedor la enye se corrompio y quedo
--   'due??o', que nunca coincide con el rol real -> `es_dueno()`
--   devolvia false y el_dueno_ solo veia su propia fila.
--   Se usa el regex '^due.o$' (solo ASCII): '.' es un caracter
--   cualquiera, asi que matchea las dos escrituras correctas,
--   'dueño' (due + ñ + o) y 'dueno' (due + e + o).
CREATE OR REPLACE FUNCTION public.es_dueno()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.roles r ON r.id = u.rol_id
        WHERE u.auth_user_id = auth.uid()
          AND lower(r.nombre) ~ '^due.o$'
    );
$function$;

CREATE OR REPLACE FUNCTION public.es_empleado()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.roles r ON r.id = u.rol_id
        WHERE u.auth_user_id = auth.uid()
          AND lower(r.nombre) = 'empleado'
    );
$function$;

CREATE OR REPLACE FUNCTION public.mi_usuario_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT u.id
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;
$function$;

-- 2) Recrear las 3 politicas RECURSIVAS usando es_dueno().
--    `es_dueno()` mantiene el criterio original: compara el
--    nombre del rol, no un id fijo.

-- 2.1) SELECT: el dueño ve todos los usuarios (los demas siguen con
--      `usuarios_select_own`, que NO es recursiva: usa
--      auth_user_id y las funciones helper).
DROP POLICY IF EXISTS usuarios_select_dueno ON public.usuarios;
CREATE POLICY usuarios_select_dueno
    ON public.usuarios
    FOR SELECT
    TO public
    USING (es_dueno());

-- 2.2) INSERT: solo el dueño.
DROP POLICY IF EXISTS usuarios_insert_dueno ON public.usuarios;
CREATE POLICY usuarios_insert_dueno
    ON public.usuarios
    FOR INSERT
    TO public
    WITH CHECK (es_dueno());

-- 2.3) DELETE: solo el dueño.
DROP POLICY IF EXISTS usuarios_delete_dueno ON public.usuarios;
CREATE POLICY usuarios_delete_dueno
    ON public.usuarios
    FOR DELETE
    TO public
    USING (es_dueno());

-- 3) RLS queda HABILITADO (no se deshabilita: eso seria abrir la
--    puerta en vez de arreglar la cerradura).
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 4) Las 2 politicas que NO eran recursivas, ahora alineadas a las
--    funciones helper para que no dependan de auth_user_id suelto.
--    OJO: `usuarios_insert_auth` permite insertar con auth_user_id
--    NULL aAuthenticated; no se toca, es el alta desde la app.
DROP POLICY IF EXISTS usuarios_select_own ON public.usuarios;
CREATE POLICY usuarios_select_own
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid() OR id = mi_usuario_id() OR es_dueno() OR es_empleado());

DROP POLICY IF EXISTS usuarios_update_own ON public.usuarios;
CREATE POLICY usuarios_update_own
    ON public.usuarios
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid() OR id = mi_usuario_id())
    WITH CHECK (auth_user_id = auth.uid() OR id = mi_usuario_id());

-- NOTA sobre los ids de rol: este script NO los fija. Usa
-- `lower(roles.nombre)`, asi que funciona en la local (1=estudiante,
-- 2=empleado, 3=dueño) y en la nube (5/4/6) sin cambios.