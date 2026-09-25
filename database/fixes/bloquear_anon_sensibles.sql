-- ============================================================
-- Bloquear acceso ANÓNIMO (clave publishable) a datos sensibles
-- ============================================================
-- Problema: las políticas RLS actuales de `usuarios` se consultan a
-- sí mismas (recursión infinita -> error 42P17), lo que en la práctica
-- deja caer la seguridad de los datos. Además `pagos` y
-- `logs_validacion_qr` permiten lectura/inserción sin restricciones útiles.
--
-- Solución adoptada (NO deshabilitar RLS, como hacía fix_rls_recursion.sql):
--   * Se ELIMINAN las políticas recursivas de estas 3 tablas.
--   * Se mantiene RLS HABILITADO -> anon/authenticated queda denegado.
--   * El backend (backend-node) opera con service_role, que BYPASEA RLS.
--
-- Ejecutar una sola vez en: Supabase Dashboard -> SQL Editor
-- Idempotente: se puede re-ejecutar sin error.
-- ============================================================

-- 1) usuarios: drop de las 5 políticas que consultan `usuarios` dentro de sí (recursivas)
DROP POLICY IF EXISTS usuarios_select_own       ON public.usuarios;
DROP POLICY IF EXISTS usuarios_select_dueno     ON public.usuarios;
DROP POLICY IF EXISTS usuarios_insert_dueno     ON public.usuarios;
DROP POLICY IF EXISTS usuarios_delete_dueno     ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_own       ON public.usuarios;

-- 2) pagos: drop de las 2 políticas recursivas / liberales
DROP POLICY IF EXISTS pagos_select_own          ON public.pagos;
DROP POLICY IF EXISTS pagos_select_dueno        ON public.pagos;

-- 3) logs_validacion_qr: drop de las 2 políticas recursivas / liberales
DROP POLICY IF EXISTS logs_validacion_qr_insert_empleado ON public.logs_validacion_qr;
DROP POLICY IF EXISTS logs_validacion_qr_select_dueno    ON public.logs_validacion_qr;

-- 4) Garantizar que RLS QUEDE HABILITADO (denegar anon), no deshabilitado
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_validacion_qr ENABLE ROW LEVEL SECURITY;

-- NOTA: NO se tocan las políticas de cafeterias/productos/pedidos/
--       detalles_pedido/metodos_pago/categorias (no son recursivas).
--       El seed usa service_role/admin, así que no lo bloquea.