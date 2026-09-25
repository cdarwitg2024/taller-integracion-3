-- ============================================================
-- Seed mínimo de datos reales para Supabase
-- ============================================================
-- PREREQUISITO: los roles ya existen en la BD real con ids:
--   estudiante = 1, empleado = 2, dueño = 3
-- (NO se vuelven a insertar si ya existen; este script es idempotente).
--
-- Para que el backend (backend-node, que usa service_role) responda en:
--   * POST /auth/register  -> tabla `usuarios` (rol_id + password_hash bcrypt)
--   * POST /auth/login     -> bcrypt.compare contra usuarios.password_hash
--   * GET  /cafeterias     -> tabla `cafeterias` (activa = true)
--   * GET  /cafeterias/:id/productos -> tabla `productos` (activo = true)
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor (o psql a la BD del proyecto)
-- ============================================================

-- 1) Roles: solo si faltan (los 3 son los que la BD real ya tiene)
INSERT INTO public.roles (nombre)
SELECT v.nombre
FROM (VALUES ('estudiante'), ('empleado'), ('dueño')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.nombre = v.nombre);

-- 2) Usuario de prueba (dueño) — password = password123
--    hash bcrypt generado con SALT_ROUNDS 10 (backend-node)
INSERT INTO public.usuarios
  (rol_id, nombre, apellido, email, telefono, password_hash, foto_url, activo, ultima_conexion)
SELECT
  (SELECT id FROM public.roles WHERE nombre = 'dueño'),
  'María', 'González', 'maria.gonzalez@cafeteria.com', NULL,
  '$2b$10$XenVhwjPCHfnhZmkPN4Jyevc7gDFxD2cWGKlL6ODsyql5lf2C9eNi',
  NULL, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.email = 'maria.gonzalez@cafeteria.com');

-- 3) Cafeterías (con casting explícito ::time para hora_apertura y hora_cierre)
INSERT INTO public.cafeterias (nombre, descripcion, hora_apertura, hora_cierre, telefono, imagen_url, activa, campus_id)
SELECT 
  c.nombre, 
  c.descripcion, 
  c.hora_apertura::time, 
  c.hora_cierre::time, 
  c.telefono, 
  c.imagen_url, 
  c.activa, 
  c.campus_id
FROM (VALUES
  ('Cafetería Central', 'Cafetería principal del campus universitario, ubicada en el edificio central. Ambiente amplio con WiFi y zona de estudio.', '07:00:00', '20:00:00', NULL::text, 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400', true, NULL::integer),
  ('Café Ingeniería', 'Especializada en café de especialidad y snacks saludables. Ubicada en la facultad de Ingeniería.', '08:00:00', '18:00:00', NULL::text, 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400', true, NULL::integer),
  ('Biblioteca Café', 'Cafetería tranquila dentro de la biblioteca central. Ideal para sesiones de estudio largas.', '08:00:00', '22:00:00', NULL::text, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', true, NULL::integer)
) AS c(nombre, descripcion, hora_apertura, hora_cierre, telefono, imagen_url, activa, campus_id)
WHERE NOT EXISTS (SELECT 1 FROM public.cafeterias x WHERE x.nombre = c.nombre);

-- 4) Productos (cafeterías referenciadas por NOMBRE, no por id)
INSERT INTO public.productos (cafeteria_id, categoria_id, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo)
SELECT
  (SELECT id FROM public.cafeterias WHERE nombre = c.cafeteria_nombre),
  NULL, c.nombre, c.descripcion, c.precio, c.stock, c.stock_minimo, c.imagen_url, c.activo
FROM (VALUES
  ('Cafetería Central', 'Café Americano', 'Café negro clásico, preparado con granos 100% arábica de origen colombiano.', 2500, 50, 10, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300', true),
  ('Cafetería Central', 'Croissant de Almendra', 'Croissant artesanal relleno de crema de almendra tostada.', 3500, 20, 5, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300', true),
  ('Café Ingeniería', 'Café Latte', 'Espresso suave con leche vaporizada y arte latte.', 3000, 40, 8, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300', true),
  ('Biblioteca Café', 'Té Verde Matcha Latte', 'Latte de matcha ceremonial japonés con leche de avena.', 3500, 25, 6, 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=300', true)
) AS c(cafeteria_nombre, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo)
WHERE NOT EXISTS (SELECT 1 FROM public.productos p WHERE p.nombre = c.nombre);

-- 5) Asociación María (dueña) -> las cafeterías
INSERT INTO public.cafeteria_usuarios (cafeteria_id, usuario_id)
SELECT c.id, u.id
FROM public.cafeterias c, public.usuarios u
WHERE u.email = 'maria.gonzalez@cafeteria.com'
  AND c.nombre IN ('Cafetería Central', 'Café Ingeniería', 'Biblioteca Café')
  AND NOT EXISTS (SELECT 1 FROM public.cafeteria_usuarios x WHERE x.cafeteria_id = c.id AND x.usuario_id = u.id);