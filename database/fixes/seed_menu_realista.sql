-- =============================================================================
-- CoffeeFast — Menú realista de cafeterías universitarias (CLP, Chile)
-- =============================================================================
-- Para que la pantalla de menú (FR-06) se vea como una cafetería de verdad:
--   * precios en rangos reales de un campus chileno
--   * categorías correctas (arregla los productos con categoria_id = NULL)
--   * productos con stock 0 para poder demostrar la diferenciación de
--     disponibilidad que pide el requerimiento
--
-- CÓMO CORRERLO
--   NO se puede pegar por el pipe de PowerShell: convierte 'í' y 'ñ' en '?'
--   y quedan categorías duplicadas. Hay que copiar el archivo al contenedor.
--
--   docker cp database/fixes/seed_menu_realista.sql \
--             supabase_db_db_CoffeeFaster:/tmp/menu.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_db_CoffeeFaster \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/menu.sql
--
-- Es idempotente: se puede correr las veces que quieras sin duplicar.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) CATEGORÍAS
-- -----------------------------------------------------------------------------
-- Diego dejó 'Reposteria' sin tilde. Se agrega la versión correcta y se
-- reapuntan los productos para que no queden dos categorías equivalentes.
INSERT INTO public.categorias (nombre, descripcion)
SELECT * FROM (VALUES
  ('Café y Té',        'Cafés de grano, infusiones y chocolate caliente.'),
  ('Bebidas Frías',    'Lattes fríos, jugos, smoothies y cold brew.'),
  ('Repostería',       'Dulces, tortas, galletas y pastelería.'),
  ('Salados',          'Sándwiches, hamburguesas y empanadas.'),
  ('Extras',           'Aguas, jugos, yogures y snacks pequenos.')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.nombre = v.nombre);

-- Reapuntar productos que quedaron con la version sin tilde
UPDATE public.productos p
   SET categoria_id = c.nuevo
  FROM (SELECT 'Reposteria' AS viejo, id AS nuevo FROM public.categorias WHERE nombre = 'Repostería'
        UNION ALL
        SELECT 'Snacks', id FROM public.categorias WHERE nombre = 'Salados') AS c
 WHERE c.viejo = (SELECT nombre FROM public.categorias WHERE id = p.categoria_id);

-- Eliminar la categoria duplicada sin tilde, ya vacia
DELETE FROM public.categorias WHERE nombre = 'Reposteria'
  AND id NOT IN (SELECT categoria_id FROM public.productos WHERE categoria_id IS NOT NULL);

-- Cualquier producto que siga sin categoria va a 'Extras'
UPDATE public.productos SET categoria_id = (SELECT id FROM public.categorias WHERE nombre = 'Extras')
 WHERE categoria_id IS NULL;


-- -----------------------------------------------------------------------------
-- 2) MENÚ POR CAFETERÍA
-- -----------------------------------------------------------------------------
-- Precios referenciales campus chileno 2026.
-- Los marcados (stock 0) son para demostrar la disponibilidad.
-- -----------------------------------------------------------------------------

-- ---------- CAFETERÍA CENTRAL (comedor principal, más variedad) ----------
INSERT INTO public.productos
  (cafeteria_id, categoria_id, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo, unidad)
SELECT
  (SELECT id FROM public.cafeterias WHERE nombre = 'Cafetería Central'),
  (SELECT id FROM public.categorias WHERE nombre = v.categoria),
  v.nombre, v.descripcion, v.precio, v.stock, v.stock_minimo,
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300',
  true, 'un'
FROM (VALUES
  -- Café y Té
  ('Café y Té','Café Americano',      'Café de grano 100% arábica, colado a la gota.',            1800, 60, 12),
  ('Café y Té','Café Latte',          'Espresso con leche vaporizada y arte latte.',                2500, 45, 10),
  ('Café y Té','Cappuccino',          'Espresso, leche y espuma con cacao.',                        2800, 35,  8),
  ('Café y Té','Chocolate Caliente',   'Chocolate semi-amargo con leche entera.',                     2300, 30,  8),
  ('Café y Té','Té de Manzanilla',    'Infusión relajante, endulzada sin azúcar.',                 1500, 25,  6),
  -- Salados
  ('Salados',   'Empanada de Pino',    'Masa crujiente con pino y cebolla.',                         2000, 40, 10),
  ('Salados',   'Sándwich de Palta',   'Pan amasado, palta, tomate y pollo.',                       3200, 20,  6),
  ('Salados',   'Hamburguesa Completa','Res, queso, palta, tomate y papas en handlers.',            4500, 15,  5),
  ('Salados',   'Sándwich de Mermelada','Pan blanco, mermelada y mantequilla.',                     2400,  0,  5),
  -- Repostería
  ('Repostería','Marraqueta',          'Pan dulce deiday tradicional.',                             1100, 50, 15),
  ('Repostería','Alfajor de Manjar',   'Dos galletas de chocolate con manjar.',                      1200, 45, 12),
  ('Repostería','Torta de Fresa',      'Porción de torta con crema y fresas.',                      2200, 18,  6),
  ('Repostería','Ensalada de Frutas',  'Frutas de temporada con yogur natural.',                    2500, 12,  5),
  -- Extras
  ('Extras',    'Jugo Natural',        'Naranja exprimida del día.',                                1800, 30,  8),
  ('Extras',    'Yogur Natural',       'Yogur natural sin azúcar agregada.',                        1200, 28, 10),
  ('Extras',    'Agua Mineral 500ml',  'Botella de agua mineral sin gas.',                           1000, 60, 20)
) AS v(categoria, nombre, descripcion, precio, stock, stock_minimo)
WHERE NOT EXISTS (SELECT 1 FROM public.productos p WHERE p.nombre = v.nombre);

-- ---------- CAFÉ INGENIERÍA (especialidad, café de grano) ----------
INSERT INTO public.productos
  (cafeteria_id, categoria_id, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo, unidad)
SELECT
  (SELECT id FROM public.cafeterias WHERE nombre = 'Café Ingeniería'),
  (SELECT id FROM public.categorias WHERE nombre = v.categoria),
  v.nombre, v.descripcion, v.precio, v.stock, v.stock_minimo,
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300',
  true, 'un'
FROM (VALUES
  ('Bebidas Frías','Espresso Doble',    'Doble shot de origen etíope o colombiano.',                  2200, 40, 10),
  ('Bebidas Frías','Flat White',         'Ristretto con leche sedosa y microespuma.',                 3200, 30,  8),
  ('Bebidas Frías','Mocha',              'Espresso, chocolate y leche batida.',                       3400, 25,  8),
  ('Bebidas Frías','Cold Brew',          'Café de grano preparado en frío durante 18 horas.',         3600, 18,  6),
  ('Bebidas Frías','Frappé de Frutilla','Frutilla, leche y café molido.',                            3800, 14,  5),
  ('Café y Té',    'Café de Origen',     'Cosecha rotativa del mes, pregunta por el lote.',           3200, 22,  6),
  ('Repostería',   'Cookie de Chocolate','Galleta casera con pepitas de chocolate.',                 1400, 35, 10),
  ('Repostería',   'Brownie',           'Brownie tibio con chocolate amargo.',                       1900, 20,  6),
  ('Salados',      'Bagel con Queso',   'Bagel de sésamo con queso crema y cebollín.',             2600, 16,  5),
  ('Extras',       'Agua Mineral 500ml','Botella de agua mineral sin gas.',                           1000, 45, 15)
) AS v(categoria, nombre, descripcion, precio, stock, stock_minimo)
WHERE NOT EXISTS (SELECT 1 FROM public.productos p WHERE p.nombre = v.nombre);

-- ---------- BIBLIOTECA CAFÉ (tranquilo, para estudiar) ----------
INSERT INTO public.productos
  (cafeteria_id, categoria_id, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo, unidad)
SELECT
  (SELECT id FROM public.cafeterias WHERE nombre = 'Biblioteca Café'),
  (SELECT id FROM public.categorias WHERE nombre = v.categoria),
  v.nombre, v.descripcion, v.precio, v.stock, v.stock_minimo,
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300',
  true, 'un'
FROM (VALUES
  ('Café y Té',  'Café de Grano',     'Café molido de la casa, servido en taza de cerámica.',      1600, 50, 15),
  ('Café y Té',  'Infusión de Hierbas','Manzanilla, menta y cidrón en bolsa reutilizable.',        1400, 30, 10),
  ('Café y Té',  'Mate',              'Yerba mate ukuranita con bombilla tibia.',                   1800, 20,  6),
  ('Repostería', 'Medialuna de Manteca','Horneada cada mañana, ideal con el café.',                 1700, 40, 12),
  ('Repostería', 'Torta de Chocolate', 'Porción de torta de chocolate con ganache.',                3800,  3,  5),
  ('Repostería', 'Torta de Fresa',    'Porción de torta con crema y fresas de temporada.',          2200, 15,  5),
  ('Repostería', 'Alfajor',           'Alfajor de chocolate con manjar.',                           1200, 25,  8),
  ('Extras',     'Agua Mineral 500ml','Botella de agua mineral sin gas.',                           1000, 40, 15)
) AS v(categoria, nombre, descripcion, precio, stock, stock_minimo)
WHERE NOT EXISTS (SELECT 1 FROM public.productos p WHERE p.nombre = v.nombre);

-- Dejar el catalogo viejo con categoria correcta (los 5 originales)
UPDATE public.productos p
   SET categoria_id = (SELECT id FROM public.categorias WHERE nombre = v.cat)
  FROM (VALUES
    ('Café Americano',          'Café y Té'),
    ('Café Latte',              'Café y Té'),
    ('Croissant de Almendra',  'Repostería'),
    ('Té Verde Matcha Latte',  'Bebidas Frías'),
    ('Torta de Chocolate',      'Repostería')
  ) AS v(nombre, cat)
 WHERE p.nombre = v.nombre
   AND p.categoria_id IS DISTINCT FROM (SELECT id FROM public.categorias WHERE nombre = v.cat);

COMMIT;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN
-- -----------------------------------------------------------------------------
SELECT c.nombre AS cafeteria,
       count(*) FILTER (WHERE p.activo AND p.stock > 0) AS disponibles,
       count(*) FILTER (WHERE p.activo AND p.stock = 0) AS agotados,
       count(*) AS total
  FROM public.productos p
  JOIN public.cafeterias c ON c.id = p.cafeteria_id
 GROUP BY c.nombre
 ORDER BY c.nombre;

-- Debe salir 0 filas: ningun producto sin categoría
SELECT p.nombre, p.categoria_id
  FROM public.productos p
 WHERE p.categoria_id IS NULL;
