-- ============================================================
-- CoffeeFast - Esquema local de desarrollo (KDS Realtime FR-27)
-- Archivo LOCAL de testeo: NO se sube al repositorio.
-- Apunta el KDS con VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
-- (y opcional VITE_CAFETERIA_ID, default 1) hacia esta DB.
--
-- IMPORTANTE: los nombres de tabla usan MAYÚSCULAS ("PEDIDOS",
-- "DETALLES_PEDIDO", ...) porque es como la app los consulta
-- (.from('PEDIDOS')) y como están en la BD remota del proyecto.
-- Sin RLS (igual que el estado actual del proyecto remoto).
-- ============================================================

DROP TABLE IF EXISTS public."LOGS_VALIDACION_QR" CASCADE;
DROP TABLE IF EXISTS public."MOVIMIENTOS_INVENTARIO" CASCADE;
DROP TABLE IF EXISTS public."PAGOS" CASCADE;
DROP TABLE IF EXISTS public."METODOS_PAGO" CASCADE;
DROP TABLE IF EXISTS public."CAFETERIA_USUARIOS" CASCADE;
DROP TABLE IF EXISTS public."DISPOSITIVOS" CASCADE;
DROP TABLE IF EXISTS public."DETALLES_PEDIDO" CASCADE;
DROP TABLE IF EXISTS public."PEDIDOS" CASCADE;
DROP TABLE IF EXISTS public."PRODUCTOS" CASCADE;
DROP TABLE IF EXISTS public."CATEGORIAS" CASCADE;
DROP TABLE IF EXISTS public."CAFETERIAS" CASCADE;
DROP TABLE IF EXISTS public."CAMPUS_SEDES" CASCADE;
DROP TABLE IF EXISTS public."USUARIOS" CASCADE;
DROP TABLE IF EXISTS public."UNIVERSIDADES" CASCADE;

-- ------------------------------------------------------------
-- UNIVERSIDADES
-- ------------------------------------------------------------
CREATE TABLE public."UNIVERSIDADES" (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre     varchar(150) NOT NULL
);

-- ------------------------------------------------------------
-- CAMPUS_SEDES
-- ------------------------------------------------------------
CREATE TABLE public."CAMPUS_SEDES" (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    universidad_id  bigint NOT NULL REFERENCES public."UNIVERSIDADES"(id),
    nombre          varchar(150) NOT NULL
);

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE public."USUARIOS" (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    universidad_id bigint REFERENCES public."UNIVERSIDADES"(id),
    nombre         varchar(100) NOT NULL,
    apellido       varchar(100),
    email          varchar(200),
    telefono       varchar(30),
    password_hash  text,
    rol            varchar(30) NOT NULL DEFAULT 'estudiante'
        CHECK (rol IN ('estudiante', 'empleado', 'dueño', 'superadmin')),
    activo         boolean NOT NULL DEFAULT true,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_email_uk UNIQUE (email)
);

-- ------------------------------------------------------------
-- CAFETERIAS
-- ------------------------------------------------------------
CREATE TABLE public."CAFETERIAS" (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campus_sede_id      bigint NOT NULL REFERENCES public."CAMPUS_SEDES"(id),
    nombre              varchar(150) NOT NULL,
    descripcion         text,
    estado              varchar(20) NOT NULL DEFAULT 'abierta'
        CHECK (estado IN ('abierta', 'cerrada')),
    horario_apertura    time,
    horario_cierre      time,
    tiempo_base_espera  numeric(4,2) NOT NULL DEFAULT 2.5,
    capacidad_maxima    int          NOT NULL DEFAULT 30
);

-- ------------------------------------------------------------
-- CATEGORIAS
-- ------------------------------------------------------------
CREATE TABLE public."CATEGORIAS" (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id bigint REFERENCES public."CAFETERIAS"(id),
    nombre       varchar(120) NOT NULL,
    descripcion  text
);

-- ------------------------------------------------------------
-- PRODUCTOS
-- ------------------------------------------------------------
CREATE TABLE public."PRODUCTOS" (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id bigint NOT NULL REFERENCES public."CAFETERIAS"(id),
    categoria_id bigint REFERENCES public."CATEGORIAS"(id),
    nombre       varchar(150) NOT NULL,
    descripcion  text,
    precio       numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    stock        int NOT NULL DEFAULT 0,
    activo       boolean NOT NULL DEFAULT true,
    imagen_url   text
);

-- ------------------------------------------------------------
-- PEDIDOS  (fuente de la comanda del KDS)
-- ------------------------------------------------------------
CREATE TABLE public."PEDIDOS" (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    qr_token              uuid NOT NULL DEFAULT gen_random_uuid(),
    cafeteria_id          bigint NOT NULL REFERENCES public."CAFETERIAS"(id),
    usuario_id            bigint REFERENCES public."USUARIOS"(id),
    estado                varchar(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'preparando', 'listo', 'entregado', 'cancelado')),
    total                 numeric(10,2) NOT NULL DEFAULT 0,
    hora_retiro           timestamptz,
    creado_en             timestamptz NOT NULL DEFAULT now(),
    inicio_preparacion_en timestamptz,
    completado_en         timestamptz,
    notas_estudiante      text,
    CONSTRAINT pedidos_qr_token_uk UNIQUE (qr_token)
);

CREATE INDEX idx_pedidos_cafeteria_creado
    ON public."PEDIDOS" (cafeteria_id, creado_en);

-- ------------------------------------------------------------
-- DETALLES_PEDIDO  (lineas de la comanda)
-- ------------------------------------------------------------
CREATE TABLE public."DETALLES_PEDIDO" (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id      bigint NOT NULL REFERENCES public."PEDIDOS"(id) ON DELETE CASCADE,
    producto_id    bigint NOT NULL REFERENCES public."PRODUCTOS"(id),
    cantidad       int NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    modificaciones text
);

CREATE INDEX idx_detalles_pedido_id
    ON public."DETALLES_PEDIDO" (pedido_id);

-- ------------------------------------------------------------
-- METODOS_PAGO / PAGOS
-- ------------------------------------------------------------
CREATE TABLE public."METODOS_PAGO" (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre varchar(80) NOT NULL
);

CREATE TABLE public."PAGOS" (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id            bigint NOT NULL REFERENCES public."PEDIDOS"(id),
    metodo_pago_id       bigint REFERENCES public."METODOS_PAGO"(id),
    monto                numeric(10,2) NOT NULL DEFAULT 0,
    estado               varchar(20) NOT NULL DEFAULT 'pagado'
        CHECK (estado IN ('pendiente', 'pagado', 'reembolsado', 'fallido')),
    transaccion_externa  varchar(120),
    pagado_en            timestamptz
);

-- ------------------------------------------------------------
-- CAFETERIA_USUARIOS
-- ------------------------------------------------------------
CREATE TABLE public."CAFETERIA_USUARIOS" (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id bigint NOT NULL REFERENCES public."CAFETERIAS"(id),
    usuario_id   bigint NOT NULL REFERENCES public."USUARIOS"(id),
    rol          varchar(30) NOT NULL DEFAULT 'empleado',
    activo       boolean NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- DISPOSITIVOS
-- ------------------------------------------------------------
CREATE TABLE public."DISPOSITIVOS" (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cafeteria_id bigint NOT NULL REFERENCES public."CAFETERIAS"(id),
    nombre       varchar(120) NOT NULL,
    tipo         varchar(60) NOT NULL DEFAULT 'kds',
    token_envio  text,
    activo       boolean NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- MOVIMIENTOS_INVENTARIO
-- ------------------------------------------------------------
CREATE TABLE public."MOVIMIENTOS_INVENTARIO" (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    producto_id  bigint NOT NULL REFERENCES public."PRODUCTOS"(id),
    cafeteria_id bigint NOT NULL REFERENCES public."CAFETERIAS"(id),
    tipo         varchar(20) NOT NULL DEFAULT 'egreso'
        CHECK (tipo IN ('ingreso', 'egreso')),
    cantidad     int NOT NULL DEFAULT 0,
    fecha        timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- LOGS_VALIDACION_QR
-- ------------------------------------------------------------
CREATE TABLE public."LOGS_VALIDACION_QR" (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id   bigint REFERENCES public."PEDIDOS"(id),
    resultado   varchar(30) NOT NULL,
    detalle     text,
    validado_en timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- REALTIME: publicar cambios para el KDS (FR-27)
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'PEDIDOS'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public."PEDIDOS";
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'DETALLES_PEDIDO'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public."DETALLES_PEDIDO";
        END IF;
    END IF;
END;
$$;

-- ------------------------------------------------------------
-- SEED basico para testeo local
-- ------------------------------------------------------------
INSERT INTO public."UNIVERSIDADES" (nombre) VALUES ('Universidad Católica de Temuco');

INSERT INTO public."CAMPUS_SEDES" (universidad_id, nombre) VALUES (1, 'Campus San Juan Pablo II');

INSERT INTO public."USUARIOS" (universidad_id, nombre, apellido, email, rol)
VALUES (1, 'Camila', 'Silva', 'camila@test.cl', 'estudiante');

INSERT INTO public."CAFETERIAS" (campus_sede_id, nombre, descripcion, estado, horario_apertura, horario_cierre)
VALUES (1, 'Café Central', 'Cafetería principal del campus', 'abierta', '08:00', '18:00');

INSERT INTO public."CATEGORIAS" (cafeteria_id, nombre) VALUES (1, 'Bebidas Calientes'), (1, 'Repostería');

INSERT INTO public."PRODUCTOS" (cafeteria_id, categoria_id, nombre, descripcion, precio, stock)
VALUES
  (1, 1, 'Café Americano', 'Café filtrado clásico', 1800, 100),
  (1, 1, 'Capuchino', 'Espresso con leche y espuma', 2400, 80),
  (1, 1, 'Té Verde', 'Infusión de té verde', 1200, 60),
  (1, 2, 'Muffin de Arándanos', 'Muffin horneado', 1800, 40),
  (1, 2, 'Croissant de Jamón y Queso', 'Croissant calentado', 2000, 35);

INSERT INTO public."METODOS_PAGO" (nombre) VALUES ('Tarjeta'), ('Webpay');

INSERT INTO public."PEDIDOS" (qr_token, cafeteria_id, usuario_id, estado, total, creado_en)
VALUES
  (gen_random_uuid(), 1, 1, 'pendiente', 4200, now() - interval '4 minutes'),
  (gen_random_uuid(), 1, 1, 'preparando', 2400, now() - interval '12 minutes'),
  (gen_random_uuid(), 1, 1, 'listo', 3600, now() - interval '20 minutes');

INSERT INTO public."DETALLES_PEDIDO" (pedido_id, producto_id, cantidad, modificaciones)
VALUES
  (1, 1, 1, 'Sin azúcar'),
  (1, 5, 1, 'Calentado'),
  (2, 2, 1, 'Leche descremada'),
  (3, 4, 2, 'Para llevar');