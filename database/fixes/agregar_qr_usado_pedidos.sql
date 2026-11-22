-- C06: preparar la marca de consumo antes de habilitar la entrega en ms-pedidos.
-- Si la columna existe, conservar su definición y las marcas históricas.
ALTER TABLE public.pedidos
    ADD COLUMN IF NOT EXISTS qr_usado boolean NOT NULL DEFAULT false;
