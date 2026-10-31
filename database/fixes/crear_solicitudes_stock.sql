-- ============================================================
-- T17: Solicitudes de reposicion de stock
-- ============================================================
-- El EMPLEADO registra una solicitud ("encargar mas stock") desde
-- la pagina Stock. El DUENO la consulta desde el panel administrativo.
--
-- Mapeo de nombres: el enunciado pedia `id_producto` y `estados`,
-- pero el codigo ya escrito en app-desktop/src/service/
-- solicitudes_stock.js inserta `producto_id` y `estado`. Se usan los
-- nombres del CODIGO para que el INSERT del empleado no reviente.
--
-- Convenciones heredadas del esquema:
--   * bigint GENERATED ALWAYS AS IDENTITY (no serial).
--   * FKs a public.productos / cafeterias / usuarios.
--   * RLS habilitado y filtrado por rol via auth_user_id.
--   * Idempotente: se puede re-ejecutar sin error.
--
-- ROLES (S2-T18): los ids NO son iguales en todas las bases locales.
--   Esta base usa 1 = estudiante, 2 = empleado, 3 = dueño, mientras que
--   el script original asumia 4 = empleado y 6 = dueño. Por eso las
--   politicas resuelven el rol por NOMBRE (public.roles.nombre) y no por
--   id. Asi el mismo script funciona en cualquier seed.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor (base local de cada uno).
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
  'Solicitudes de reposicion de stock. El empleado inserta (estado pendiente); el dueno puede actualizar el estado y stamp fecha_respuesta + usuario_responde_id.';

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

-- 5) SELECT: el empleado y el dueno ven las solicitudes.
--
--    LIMITACION CONOCIDA: la politica valida el ROL, no la cafeteria. El
--    filtro por cafeteria autorizada se aplica en la consulta del cliente
--    (`listarPorCafeteria` usa .eq('cafeteria_id', ...)). Se mantiene asi
--    porque `cafeteria_usuarios` puede estar vacia en las bases locales y
--    denegaria toda lectura. No se usa para operaciones de escritura.
DROP POLICY IF EXISTS solicitudes_stock_select ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_select
    ON public.solicitudes_stock
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.usuarios u
            JOIN public.roles r ON r.id = u.rol_id
            WHERE u.auth_user_id = auth.uid()
              AND r.nombre IN ('empleado', 'dueño', 'dueno')
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
            SELECT 1
            FROM public.usuarios u
            JOIN public.roles r ON r.id = u.rol_id
            WHERE u.auth_user_id = auth.uid()
              AND r.nombre IN ('empleado', 'dueño', 'dueno')
        )
    );

-- 7) UPDATE: SOLO el dueno.
--    Sin esta politica el empleado podria aprobarse a si mismo su pedido.
DROP POLICY IF EXISTS solicitudes_stock_update_dueno ON public.solicitudes_stock;
CREATE POLICY solicitudes_stock_update_dueno
    ON public.solicitudes_stock
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.usuarios u
            JOIN public.roles r ON r.id = u.rol_id
            WHERE u.auth_user_id = auth.uid()
              AND r.nombre IN ('dueño', 'dueno')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.usuarios u
            JOIN public.roles r ON r.id = u.rol_id
            WHERE u.auth_user_id = auth.uid()
              AND r.nombre IN ('dueño', 'dueno')
        )
    );

-- 8) Sin DELETE para authenticated: las solicitudes son registro de auditoria.
--    Si alguna hay que anular, se deja en 'rechazado'.
