-- ============================================================
-- Fix error 42P17: "infinite recursion detected in policy for
-- relation \"usuarios\""
-- ============================================================
-- ** OBSOLETO / NO EJECUTAR **
-- Este script DESHABILITABA RLS en 10 tablas. El plan final en su lugar
-- mantiene RLS habilitado y elimina SOLO las políticas recursivas:
--    -> usar bloquear_anon_sensibles.sql
-- La única parte que sigue siendo útil era habilitar Realtime:
--    -> usar habilitar_realtime.sql
-- ============================================================
-- Las políticas RLS actuales de este proyecto son recursivas
-- (una política de la tabla `usuarios` vuelve a consultar `usuarios`),
-- lo que rompe TODAS las lecturas desde el cliente (app móvil, KDS, desktop)
-- con la clave anónima.
--
-- Para el flujo mínimo, el control de acceso se delega en los
-- microservicios (NestJS + service_role). Por eso se deshabilita RLS:
-- NO se crean columnas ni se cambian tipos de dato.
-- ============================================================

ALTER TABLE public.usuarios           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafeterias         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalles_pedido    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_validacion_qr DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias         DISABLE ROW LEVEL SECURITY;

-- Para que Supabase Realtime emita cambios de la tabla PEDIDOS
-- (INSERT/UPDATE) hacia el KDS y la app móvil.
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;