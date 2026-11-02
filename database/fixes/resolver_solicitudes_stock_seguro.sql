-- Preparado para revisión/aplicación manual. NO ejecutado en Cloud.
-- Resolución administrativa, sin modificar stock ni observaciones del empleado.
DROP POLICY IF EXISTS solicitudes_stock_update_dueno ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_update_dueno ON public.solicitudes_stock
FOR UPDATE TO authenticated
USING (estado = 'pendiente' AND EXISTS (
  SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id=u.rol_id
  JOIN public.cafeteria_usuarios cu ON cu.usuario_id=u.id
  WHERE u.auth_user_id=auth.uid() AND r.nombre IN ('dueño','dueno')
    AND cu.cafeteria_id=solicitudes_stock.cafeteria_id
))
WITH CHECK (estado IN ('aprobado','rechazado') AND fecha_respuesta IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.usuarios u JOIN public.roles r ON r.id=u.rol_id
  JOIN public.cafeteria_usuarios cu ON cu.usuario_id=u.id
  WHERE u.auth_user_id=auth.uid() AND r.nombre IN ('dueño','dueno')
    AND u.id=solicitudes_stock.usuario_responde_id
    AND cu.cafeteria_id=solicitudes_stock.cafeteria_id
));
