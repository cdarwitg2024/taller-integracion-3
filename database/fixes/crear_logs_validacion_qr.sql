-- ============================================================
-- T12: Logs de validación QR / Token (solo visible para el Dueño)
-- ============================================================
-- Requisito: al validar un QR o Token (marcar pedido como retirado)
-- se debe almacenar un registro de auditoría que SOLO el Dueño
-- pueda ver.
--
-- Diseño:
--   * La tabla apunta al pedido, cafetería y usuario que validó.
--   * RLS HABILITADO:
--       - INSERT: empleado o dueño autenticado (rol 2 o 3).
--       - SELECT: SOLO dueño (rol 3) -> anon y empleado no ven logs.
--   * Idempotente: se puede re-ejecutar sin error.
-- ============================================================

-- 1) Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.logs_validacion_qr (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id    bigint REFERENCES public.pedidos(id),
    cafeteria_id bigint REFERENCES public.cafeterias(id),
    usuario_id   bigint REFERENCES public.usuarios(id),
    qr_token     text,
    resultado    varchar(30)  NOT NULL,
    detalle      text,
    validado_en  timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.logs_validacion_qr IS
  'Auditoría de validaciones de QR/Token de entrega. Solo el Dueño (rol 3) puede consultar (RLS).';

-- 2) Permisos mínimos: solo authenticated (policy + RLS deciden a quién)
REVOKE ALL ON public.logs_validacion_qr FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_validacion_qr TO authenticated;

-- 3) RLS habilitado
ALTER TABLE public.logs_validacion_qr ENABLE ROW LEVEL SECURITY;

-- 4) Política de INSERT: empleado o dueño autenticado
DROP POLICY IF EXISTS logs_validacion_qr_insert_empleado ON public.logs_validacion_qr;
CREATE POLICY logs_validacion_qr_insert_empleado
    ON public.logs_validacion_qr
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id IN (2, 3)   -- empleado o dueño
        )
    );

-- 5) Política de SELECT: SOLO dueño (rol 3)
DROP POLICY IF EXISTS logs_validacion_qr_select_dueno ON public.logs_validacion_qr;
CREATE POLICY logs_validacion_qr_select_dueno
    ON public.logs_validacion_qr
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id = 3          -- rol "dueño"
        )
    );
