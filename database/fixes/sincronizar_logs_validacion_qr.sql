-- ============================================================
-- Sync de esquema: logs_validacion_qr (T12)
-- ============================================================
-- La tabla local se había creado (o alterado) SIN las columnas
-- `qr_token`, `detalle` y `validado_en` que sí definen el script
-- base crear_logs_validacion_qr.sql y que escribe el backend.
--
-- Síntoma: el panel Logs de Validación del Dueño salía vacío. No
-- era RLS (el dueño sí puede SELECT) ni el lector: era el INSERT.
-- backend-node registra el log en cada validación, pero el INSERT
-- fallaba con PGRST204 "Could not find the 'detalle'/'validado_en'
-- column" y el fallo se tragaba (solo console.error), así que la
-- tabla quedaba en 0 filas y el panel mostraba "Aún no hay
-- validaciones registradas".
--
-- Idempotente: se puede re-ejecutar sin error.
-- ============================================================

ALTER TABLE public.logs_validacion_qr ADD COLUMN IF NOT EXISTS qr_token   text;
ALTER TABLE public.logs_validacion_qr ADD COLUMN IF NOT EXISTS detalle    text;
ALTER TABLE public.logs_validacion_qr ADD COLUMN IF NOT EXISTS validado_en timestamptz NOT NULL DEFAULT now();