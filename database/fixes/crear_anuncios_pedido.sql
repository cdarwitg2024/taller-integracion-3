-- ============================================================
-- T16: Control de avisos de voz del KDS (ElevenLabs TTS)
-- ============================================================
-- Mejora propuesta sobre lo solicitado: cuando entra un pedido
-- nuevo a la cocina, el KDS lo anuncia por audio.
--
-- Esta tabla NO guarda el audio (eso viaja directo al navegador).
-- Guarda el CONTROL del aviso:
--   * pedido_id UNIQUE -> idempotencia: un pedido se anuncia
--     UNA sola vez, aunque haya varias pantallas de cocina abiertas
--     o la conexión se corte y vuelva.
--   * Auditoria: que se anunció, cuándo, con qué modelo y cuantos
--     caracteres se gastaron (control de costo de la API).
--
-- Diseño:
--   * RLS HABILITADO:
--       - INSERT/UPDATE: solo service_role (lo usa la Edge Function
--         "voz-pedido"). El empleado no escribe aquí.
--       - SELECT: SOLO dueno (rol 3), igual que logs_validacion_qr.
--   * Idempotente: se puede re-ejecutar sin error.
-- ============================================================

-- 1) Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.anuncios_pedido (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id    bigint       NOT NULL UNIQUE
                             REFERENCES public.pedidos(id) ON DELETE CASCADE,
    cafeteria_id bigint       NOT NULL REFERENCES public.cafeterias(id),
    usuario_id   bigint       REFERENCES public.usuarios(id),
    canal        varchar(20)  NOT NULL DEFAULT 'elevenlabs',
    modelo       varchar(40),
    voz          varchar(60),
    caracteres   integer,
    estado       varchar(20)  NOT NULL DEFAULT 'en_curso',
    detalle      text,
    creado_en    timestamptz  NOT NULL DEFAULT now(),
    emitido_en   timestamptz
);

COMMENT ON TABLE public.anuncios_pedido IS
  'Control de avisos de voz del KDS. pedido_id UNIQUE garantiza un solo aviso por pedido. Solo el empleado (rol 2) puede consultar (RLS); los INSERT/UPDATE los hace la Edge Function voz-pedido con service_role.';

COMMENT ON COLUMN public.anuncios_pedido.estado IS
  'en_curso = reservado; emitido = el KDS ya lo reproduce; fallido = no se pudo generar audio (reintentable) o descartado';

-- 2) Permisos mínimos: authenticated solo puede LEER (y RLS lo
--    restringe al empleado). Escribir es exclusivo de service_role.
REVOKE ALL ON public.anuncios_pedido FROM anon;
REVOKE ALL ON public.anuncios_pedido FROM authenticated;
GRANT SELECT ON public.anuncios_pedido TO authenticated;

-- 3) Índices de consulta
CREATE INDEX IF NOT EXISTS idx_anuncios_pedido_cafeteria
    ON public.anuncios_pedido (cafeteria_id, creado_en DESC);

-- 4) RLS habilitado
ALTER TABLE public.anuncios_pedido ENABLE ROW LEVEL SECURITY;

-- 5) Política de SELECT: SOLO el empleado (rol 2)
--
--    La voz de aviso pertenece al KDS, que es la pantalla del empleado.
--    Esta política era del dueño (rol 3), lo que era al revés de lo que
--    corresponde: el dueño no tiene una cocina delante y su panel no
--    necesita que las comandas le hablen. Y el KDS sí lo necesitaba: con
--    la política anterior el empleado no podía confirmar, ni desde la app
--    ni desde el panel de pruebas, si una comanda se había anunciado.
--
--    LIMITACIÓN CONOCIDA: filtra por rol y no por cafetería, así que un
--    empleado puede leer los avisos de todas las cafeterías.
--    Limitarlos a las suyas exige cafeteria_usuarios, que todavía no
--    existe en la base (ver el comentario de usuarios.js). Cuando esa
--    tabla aparezca, esta política debe pasar a filtrar por
--    cafeteria_id en lugar de por rol.
DROP POLICY IF EXISTS anuncios_pedido_select_dueno ON public.anuncios_pedido;
DROP POLICY IF EXISTS anuncios_pedido_select_operadores ON public.anuncios_pedido;
CREATE POLICY anuncios_pedido_select_empleado
    ON public.anuncios_pedido
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_user_id = auth.uid()
              AND u.rol_id = 2          -- rol "empleado": quien tiene el KDS
        )
    );

-- 6) Sin políticas de INSERT/UPDATE para authenticated ni anon:
--    la Edge Function "voz-pedido" escribe con service_role, que
--    ignora RLS. Así el empleado no puede falsear el control de
--    avisos (por ejemplo, marcar como "emitido" un pedido que
--    nunca se anunció).
