-- ============================================================
-- T14: Datos de la cafeteria para la boleta
-- ============================================================
-- La boleta de pedidos inactivos debe incluir, segun el requisito:
--   nombre, direccion, telefono y RUT de la cafeteria,
--   numero de pedido, fecha, detalle, total y metodo de pago.
--
-- La tabla cafeterias NO tenia direccion ni rut, y el telefono
-- venia nulo, asi que los agrego y los completo con un seed.
-- ============================================================

-- 1) Agregar columnas (idempotente)
ALTER TABLE public.cafeterias
    ADD COLUMN IF NOT EXISTS direccion text,
    ADD COLUMN IF NOT EXISTS rut text;

-- 2) Completar telefono/direccion/rut de las cafeterias existentes (solo si faltan)
UPDATE public.cafeterias SET
    direccion = COALESCE(direccion, 'Edificio Central, Av. Alemania 0001, Temuco'),
    telefono  = COALESCE(telefono,  '+56 45 2200001'),
    rut       = COALESCE(rut,       '66.123.456-7')
WHERE id = 1;

UPDATE public.cafeterias SET
    direccion = COALESCE(direccion, 'Facultad de Ingenieria, Campus UCT, Temuco'),
    telefono  = COALESCE(telefono,  '+56 45 2200002'),
    rut       = COALESCE(rut,       '66.123.456-8')
WHERE id = 2;

UPDATE public.cafeterias SET
    direccion = COALESCE(direccion, 'Biblioteca Central, Campus UCT, Temuco'),
    telefono  = COALESCE(telefono,  '+56 45 2200003'),
    rut       = COALESCE(rut,       '66.123.456-9')
WHERE id = 3;

-- ============================================================
-- 3) Verificacion
-- ============================================================
--   SELECT nombre, direccion, telefono, rut FROM public.cafeterias;
-- ============================================================
