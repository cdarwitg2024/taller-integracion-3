-- Corrección de caracteres rotos por codificación (acentos).
-- Se ejecuta DENTRO del contenedor con `docker cp` porque el pipe de
-- PowerShell convierte 'í' y 'ñ' en '?'.
--
--   docker cp fix_acentos.sql supabase_db_db_CoffeeFaster:/tmp/fix.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_db_CoffeeFaster \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/fix.sql

BEGIN;

-- Elimina cualquier fila corrupta que haya quedado de corridas anteriores
DELETE FROM productos    WHERE nombre LIKE '%?%' OR descripcion LIKE '%?%';
DELETE FROM cafeterias   WHERE nombre LIKE '%?%' OR descripcion LIKE '%?%';
DELETE FROM categorias   WHERE nombre LIKE '%?%' OR descripcion LIKE '%?%';
DELETE FROM usuarios     WHERE nombre LIKE '%?%' OR apellido LIKE '%?%';

-- Corrige la dueña
UPDATE usuarios SET nombre = 'María', apellido = 'González'
 WHERE email = 'maria.gonzalez@cafeteria.com';

-- Asegura que el rol se llame bien
UPDATE roles SET nombre = 'dueño' WHERE nombre LIKE 'due%o' AND nombre <> 'dueño';

COMMIT;
