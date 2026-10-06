-- =============================================================================
-- T13 - POLITICA RLS PARA EL HISTORIAL DE ACTIVIDAD DEL PERFIL
-- Destinatario: Camilo
-- =============================================================================
--
-- QUE HACE
--   La pantalla de Perfil (app-mobile/src/screens/PerfilScreen.js) muestra
--   "Mis movimientos" leyendo de public.logs_auditoria. Para que cada usuario
--   vea SOLO lo suyo y el dueño mantenga la vision global, esta politica
--   reemplaza a la version anterior que solo dejaba leer al dueño.
--
-- COMO SE USA
--   psql -f docs/politica_logs_auditoria_camilo.sql
--
-- QUE VERAS DESPUES
--   SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='logs_auditoria';
--
-- =============================================================================
-- NOTA DE CODIFICACION (leer antes de tocar nada)
-- -----------------------------------------------------------------------------
-- La version anterior de es_dueno() comparaba contra un literal que quedo
-- escrito como 'due??o' (dos interrogantes ASCII) en vez de 'dueño'. Como
-- 'due??o' <> 'dueño', la funcion SIEMPRE devolvia false y el dueno perdia la
-- visibilidad global del historial.
--
-- Para que eso no vuelva a pasar, esta version NO usa ningun caracter
-- no-ascii en el archivo: la 'n' con tilde se construye en tiempo de ejecucion
-- con chr(241). Asi el SQL sobrevive a cualquier camino de encoding.
-- =============================================================================


-- =============================================================================
-- 1. FUNCIONES AUXILIARES
--    Son SECURITY DEFINER: resuelven el usuario actual a partir del JWT aunque
--    la politica se evalue en un contexto donde la tabla no es visible.
-- =============================================================================

-- Devuelve el id INTERNO (bigint) de public.usuarios para quien este logueado.
CREATE OR REPLACE FUNCTION public.mi_usuario_id()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT u.id
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;
$$;


-- Devuelve true si el usuario logueado tiene rol dueño.
--
-- Se normaliza con translate() para que funcione igual con 'dueno' o 'dueño',
-- sin depender de como se haya guardado el literal ni del encoding del archivo.
CREATE OR REPLACE FUNCTION public.es_dueno()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.roles r ON r.id = u.rol_id
        WHERE u.auth_user_id = auth.uid()
          AND translate(lower(r.nombre), chr(241), 'n') = 'dueno'
    );
$$;


-- Devuelve el id de la wallet del usuario logueado. Se incluye porque tambien
-- se usa desde app-mobile/tabla_mobile/rpc_qr.sql y tampoco estaba versionada.
CREATE OR REPLACE FUNCTION public.mi_wallet_id()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT w.id
    FROM public.wallets w
    JOIN public.usuarios u ON u.id = w.usuario_id
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;
$$;


-- =============================================================================
-- 2. ROW LEVEL SECURITY EN logs_auditoria
-- =============================================================================

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 3. LA POLITICA
--
--    Ve el historial completo si:
--      a) es dueño  -> es_dueno()
--    Ve solo lo suyo si:
--      b) el log esta asociado a su id interno      -> usuario_id = mi_usuario_id()
--      c) el log esta asociado a su uuid de Auth    -> auth_user_id = auth.uid()
--
--    (c) existe porque la pantalla consulta con
--        .or('usuario_id.eq.<id>, auth_user_id.eq.<uuid>')
--        sin esa rama, los logs que solo traen el uuid quedarian fuera.
-- =============================================================================

DROP POLICY IF EXISTS "logs_auditoria_select_dueno" ON public.logs_auditoria;

CREATE POLICY "logs_auditoria_select_dueno"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (
      es_dueno()
   OR usuario_id = mi_usuario_id()
   OR auth_user_id = auth.uid()
  );


-- =============================================================================
-- 4. VERIFICACION
-- =============================================================================
--
-- 4.1 La politica quedo creada:
--       SELECT policyname, cmd, qual::text
--       FROM pg_policies WHERE tablename = 'logs_auditoria';
--       -- esperado: logs_auditoria_select_dueno | SELECT | ...
--
-- 4.2 es_dueno() ya no esta rota (esta linea debe dar 't' con el dueno logueado):
--       SELECT translate(lower(nombre), chr(241), 'n') = 'dueno' AS es_dueno
--       FROM public.roles;
--       -- esperado: estudiante=f, empleado=f, dueno=t
--
-- 4.3 En la app: Perfil -> "Mis movimientos".
--       - Con datos  -> muestra fecha, icono y descripcion.
--       - Sin datos   -> "Sin actividad registrada".
--       - Sin permiso -> caja de aviso con el nombre de la politica.
--
-- =============================================================================
