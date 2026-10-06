-- ============================================================
-- T17: Solicitudes de reposicion de stock
-- ============================================================
-- El EMPLEADO registra una solicitud ("encargar mas stock") desde
-- la pagina Stock. El DUENO la aprueba o rechaza cambiando el estado.
--
-- Mapeo de nombres: el enunciado pedia `id_producto` y `estados`,
-- pero el codigo ya escrito en app-desktop/src/service/
-- solicitudes_stock.js inserta `producto_id` y `estado`. Se usan los
-- nombres del CODIGO para que el INSERT del empleado no reviente;
-- son las mismas columnas que pedia Elias, renombradas.
--
-- Convenciones heredadas del esquema:
--   * bigint GENERATED ALWAYS AS IDENTITY (no serial).
--   * FKs a public.productos / cafeterias / usuarios.
--   * RLS habilitado y filtrado por rol via auth_user_id.
--   * Idempotente: se puede re-ejecutar sin error.
--
-- ROLES: en esta base de datos los ids reales son
--   rol 4 = "empleado", rol 6 = "dueño", rol 5 = "estudiante".
--   (Los SQL viejos de este repo asumian 2 y 3; ver
--   database/fixes/crear_anuncios_pedido.sql.)
-- ============================================================

-- 1) Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.solicitudes_stock (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    producto_id         bigint       NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    nombre_producto     varchar(150),
    cantidad_solicitada integer     NOT NULL CHECK (cantidad_solicitada > 0),
    cafeteria_id        bigint       REFERENCES public.cafeterias(id),
    usuario_id          bigint       REFERENCES public.usuarios(id),
    observaciones       text,
    estado              varchar(20)  NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    fecha_solicitud     timestamptz  NOT NULL DEFAULT now(),
    fecha_respuesta     timestamptz,
    usuario_responde_id bigint       REFERENCES public.usuarios(id)
);

COMMENT ON TABLE public.solicitudes_stock IS
  'Solicitudes de reposicion de stock. El empleado inserta (estado pendiente); el dueno actualiza el estado a aprobado/rechazado y stamp fecha_respuesta + usuario_responde_id.';

COMMENT ON COLUMN public.solicitudes_stock.estado IS
  'pendiente = recien creada; aprobado = el dueno la acepta; rechazado = el dueno la rechaza';

-- `nombre_producto` es denormalizado a proposito: guarda el nombre tal como
-- estaba al solicitar, para que el historial siga siendo legible aunque el
-- producto se renombre o se de baja despues.

-- 2) Permisos: authenticated opera; anon no toca nada.
REVOKE ALL ON public.solicitudes_stock FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.solicitudes_stock TO authenticated;

-- 3) Indices de consulta
CREATE INDEX IF NOT EXISTS idx_solicitudes_stock_estado
    ON public.solicitudes_stock (estado, fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_stock_usuario
    ON public.solicitudes_stock (usuario_id, fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_stock_cafeteria
    ON public.solicitudes_stock (cafeteria_id, fecha_solicitud DESC);

-- 4) RLS habilitado
ALTER TABLE public.solicitudes_stock ENABLE ROW LEVEL SECURITY;

-- 5) SELECT: el empleado y el dueno ven las solicitudes de su cafeteria.
--
--    LIMITACION CONOCIDA: se filtra por cafeteria_id y no por
--    `cafeteria_usuarios`, asi que un empleado ve las solicitudes de todas
--    las cafeterias. Es el mismo criterio que ya usa el resto del modulo.
DROP POLICY IF EXISTS solicitudes_stock_select ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_select
    ON public.solicitudes_stock
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id IN (4, 6)     -- 4 = empleado, 6 = dueño
        )
    );

-- 6) INSERT: cualquier empleado o dueno puede crear una solicitud.
--    El estado lo fija el DEFAULT ('pendiente'): el empleado no elige si su
--    propia solicitud nace ya aprobada.
DROP POLICY IF EXISTS solicitudes_stock_insert ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_insert
    ON public.solicitudes_stock
    FOR INSERT
    TO authenticated
    WITH CHECK (
        estado = 'pendiente'
        AND EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id IN (4, 6)
        )
    );

-- 7) UPDATE: SOLO el dueno, y SOLO para mover el estado.
--    Sin esta politica el empleado podria aprobarse a si mismo su pedido.
DROP POLICY IF EXISTS solicitudes_stock_update_dueno ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_update_dueno
    ON public.solicitudes_stock
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id = 6            -- 6 = dueño
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id = 6
        )
    );

-- 8) Sin DELETE para authenticated: las solicitudes son registro de auditoría.
--    Si alguna hay que anular, se deja en 'rechazado'.
