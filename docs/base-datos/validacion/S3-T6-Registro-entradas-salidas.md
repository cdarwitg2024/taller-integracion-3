# S3-T6 / CAM-228 — Registro independiente de entradas y salidas

Fecha: 17 de noviembre de 2026 (UTC). Resultado: **50/50 casos aprobados**.

Archivo de evidencia opcional: eliminarlo no afecta la migración ni las pruebas de estructura. No se incorpora ningún seed o runner de datos de prueba al repositorio.

## Entorno

- PostgreSQL 17.12 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
- Node v22.23.5; Supabase CLI 2.117.0.
- Contenedor dedicado sin red: `cf-s3t6-postgres`. Base temporal: `cf_equivalencias_test_278654_1794941590850`. Ambos eliminados al terminar.
- Migración: `20261117184822_crear_grupos_equivalentes.sql`. SHA-256: `a0fdcd7b8dd8402427e449bfda437336277aedba497aa34d6c5aff3508758544`.
- Aplicación ensayada como propietario sin superusuario (`cf_eq_owner`) con BYPASSRLS y privilegios por defecto amplios.
- Esquema histórico completo previo a S3-T6. Auth se adapta localmente mediante `auth.uid()`/`auth.jwt()`/`auth.role()`; las pruebas usan roles SQL reales, no validan GoTrue o JWT HTTP.
- Datos ficticios solo en la base desechable: dueños 1 y 2 asignados a cafeterías 1 y 2; estudiante 3; empleado 4 asignado a cafetería 1. UUID terminados en el ID con 12 dígitos.
- Productos iniciales 41 (cafetería 1, precio 10000, stock 20), 42 (cafetería 2, precio 9000, stock 30), 43 (cafetería 1, precio 2500, stock 10). Ninguno tenía grupo antes de la migración.
- No se aplicó SQL a Cloud ni a la base de desarrollo.

## Casos ejecutados

### 01. Fallo de migración revierte catálogo, columna e índice

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('catalogo_ausente',to_regclass('public.grupos_equivalentes') IS NULL,
    'columna_ausente',NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='productos' AND column_name='grupo_equivalente_id'),
    'indice_ausente',to_regclass('public.productos_grupo_equivalente_idx') IS NULL);
```

Salida esperada:

```json
{"catalogo_ausente":true,"columna_ausente":true,"indice_ausente":true}
```

Salida observada:

```json
{"catalogo_ausente":true,"columna_ausente":true,"indice_ausente":true}
```

### 02. Productos anteriores conservan NULL sin precio o stock alterados

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('productos',count(*),'sin_clasificar',bool_and(grupo_equivalente_id IS NULL)) FROM productos;
```

Salida esperada:

```json
{"productos":3,"sin_clasificar":true}
```

Salida observada:

```json
{"productos":3,"sin_clasificar":true}
```

### 03. Catálogo vacío: la migración no carga datos de ejemplo

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('filas',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"filas":0}
```

Salida observada:

```json
{"filas":0}
```

### 04. No añade funciones ni modifica RLS de productos

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('rls_catalogo',relrowsecurity) FROM pg_class WHERE oid='public.grupos_equivalentes'::regclass;
```

Salida esperada:

```json
{"rls_catalogo":true}
```

Salida observada:

```json
{"rls_catalogo":true}
```

### 05. Backend crea combinación canónica

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
WITH g AS (INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES('cafe_americano','vaso_250_ml') RETURNING *) SELECT row_to_json(g) FROM g;
```

Salida esperada:

```json
{"id":1,"tipo":"cafe_americano","presentacion":"vaso_250_ml"}
```

Salida observada:

```json
{"id":1,"tipo":"cafe_americano","presentacion":"vaso_250_ml"}
```

### 06. Combinación duplicada rechazada

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''cafe_americano'',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23505"}
```

Salida observada:

```json
{"sqlstate":"23505"}
```

### 07. Mismo tipo permite otra presentación

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
WITH g AS (INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES('cafe_americano','vaso_350_ml') RETURNING tipo,presentacion) SELECT row_to_json(g) FROM g;
```

Salida esperada:

```json
{"tipo":"cafe_americano","presentacion":"vaso_350_ml"}
```

Salida observada:

```json
{"tipo":"cafe_americano","presentacion":"vaso_350_ml"}
```

### 08. Misma presentación permite otro tipo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
WITH g AS (INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES('te_negro','vaso_250_ml') RETURNING tipo,presentacion) SELECT row_to_json(g) FROM g;
```

Salida esperada:

```json
{"tipo":"te_negro","presentacion":"vaso_250_ml"}
```

Salida observada:

```json
{"tipo":"te_negro","presentacion":"vaso_250_ml"}
```

### 09. Código no canónico: ["Cafe","vaso_250_ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''Cafe'',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 10. Código no canónico: [" cafe","vaso_250_ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES('' cafe'',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 11. Código no canónico: ["cafe__americano","vaso_250_ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''cafe__americano'',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 12. Código no canónico: ["café","vaso_250_ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''café'',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 13. Código no canónico: ["","vaso_250_ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES('''',''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 14. Código no canónico: ["cafe","250 ml"]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''cafe'',''250 ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 15. Código no canónico: ["cafe",""]

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''cafe'','''')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23514"}
```

Salida observada:

```json
{"sqlstate":"23514"}
```

### 16. Tipo NULL rechazado

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(NULL,''vaso_250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23502"}
```

Salida observada:

```json
{"sqlstate":"23502"}
```

### 17. Presentación demasiado larga rechazada

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''cafe'',repeat(''a'',81))'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"22001"}
```

Salida observada:

```json
{"sqlstate":"22001"}
```

### 18. Lectura global autenticada: dueño A

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT json_build_object('grupos',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"grupos":3}
```

Salida observada:

```json
{"grupos":3}
```

### 19. El cliente dueño A no crea grupos

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''otro'',''250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 20. Lectura global autenticada: dueño B

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT json_build_object('grupos',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"grupos":3}
```

Salida observada:

```json
{"grupos":3}
```

### 21. El cliente dueño B no crea grupos

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''otro'',''250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 22. Lectura global autenticada: estudiante

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
SELECT json_build_object('grupos',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"grupos":3}
```

Salida observada:

```json
{"grupos":3}
```

### 23. El cliente estudiante no crea grupos

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''otro'',''250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 24. Lectura global autenticada: empleado

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
SELECT json_build_object('grupos',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"grupos":3}
```

Salida observada:

```json
{"grupos":3}
```

### 25. El cliente empleado no crea grupos

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $caso$ BEGIN BEGIN EXECUTE 'INSERT INTO grupos_equivalentes(tipo,presentacion) VALUES(''otro'',''250_ml'')'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 26. Dueño no reinterpreta el catálogo global

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE grupos_equivalentes SET presentacion=''vaso_500_ml'' WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 27. authenticated sin UID no lee el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated;
SELECT json_build_object('grupos',count(*)) FROM grupos_equivalentes;
```

Salida esperada:

```json
{"grupos":0}
```

Salida observada:

```json
{"grupos":0}
```

### 28. anon no lee el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE anon;
DO $caso$ BEGIN BEGIN EXECUTE 'SELECT * FROM grupos_equivalentes'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 29. Backend no puede editar el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE grupos_equivalentes SET presentacion=''vaso_500_ml'' WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 30. Backend no puede borrar el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'DELETE FROM grupos_equivalentes WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 31. Backend no puede vaciar el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET ROLE service_role;
DO $caso$ BEGIN BEGIN EXECUTE 'TRUNCATE grupos_equivalentes'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 32. Dueño asigna grupo a su producto

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
WITH p AS (UPDATE productos SET grupo_equivalente_id=1 WHERE id=41 RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":41,"grupo_equivalente_id":1}
```

Salida observada:

```json
{"id":41,"grupo_equivalente_id":1}
```

### 33. Otro dueño no modifica producto ajeno

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
WITH p AS (UPDATE productos SET grupo_equivalente_id=NULL WHERE id=41 RETURNING id) SELECT json_build_object('filas',count(*)) FROM p;
```

Salida esperada:

```json
{"filas":0}
```

Salida observada:

```json
{"filas":0}
```

### 34. Estudiante no modifica equivalencia

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
WITH p AS (UPDATE productos SET grupo_equivalente_id=NULL WHERE id=41 RETURNING id) SELECT json_build_object('filas',count(*)) FROM p;
```

Salida esperada:

```json
{"filas":0}
```

Salida observada:

```json
{"filas":0}
```

### 35. Grupo inexistente rechazado por FK

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE productos SET grupo_equivalente_id=999999 WHERE id=41'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23503"}
```

Salida observada:

```json
{"sqlstate":"23503"}
```

### 36. No se traslada producto a otra cafetería

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE productos SET cafeteria_id=2 WHERE id=41'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"42501"}
```

Salida observada:

```json
{"sqlstate":"42501"}
```

### 37. Empleado conserva permiso previo sobre su cafetería

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
WITH p AS (UPDATE productos SET grupo_equivalente_id=1 WHERE id=43 RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":43,"grupo_equivalente_id":1}
```

Salida observada:

```json
{"id":43,"grupo_equivalente_id":1}
```

### 38. Grupo global se comparte entre cafeterías con dueños autorizados

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
WITH p AS (UPDATE productos SET grupo_equivalente_id=1 WHERE id=42 RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":42,"grupo_equivalente_id":1}
```

Salida observada:

```json
{"id":42,"grupo_equivalente_id":1}
```

### 39. Recarga conserva grupo y presentación exactos

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT json_build_object('grupo',g.id,'tipo',g.tipo,'presentacion',g.presentacion) FROM productos p JOIN grupos_equivalentes g ON g.id=p.grupo_equivalente_id WHERE p.id=41;
```

Salida esperada:

```json
{"grupo":1,"tipo":"cafe_americano","presentacion":"vaso_250_ml"}
```

Salida observada:

```json
{"grupo":1,"tipo":"cafe_americano","presentacion":"vaso_250_ml"}
```

### 40. Join de comparación no incluye otra presentación o tipo

Estado: **APROBADO**.

Entrada SQL:

```sql
BEGIN;
    INSERT INTO productos(id,cafeteria_id,nombre,precio,stock,grupo_equivalente_id)
      SELECT 65,1,'Otro tamaño',10000,1,id FROM grupos_equivalentes WHERE tipo='cafe_americano' AND presentacion='vaso_350_ml';
    INSERT INTO productos(id,cafeteria_id,nombre,precio,stock,grupo_equivalente_id)
      SELECT 66,1,'Otro tipo',10000,1,id FROM grupos_equivalentes WHERE tipo='te_negro';
    SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003'; SELECT json_build_object('ids',jsonb_agg(id ORDER BY id)) FROM productos WHERE grupo_equivalente_id=1;
    ROLLBACK;
```

Salida esperada:

```json
{"ids":[41,42,43]}
```

Salida observada:

```json
{"ids":[41,42,43]}
```

### 41. Grupo referenciado no se borra ni desde propietario SQL

Estado: **APROBADO**.

Entrada SQL:

```sql
DO $caso$ BEGIN BEGIN EXECUTE 'DELETE FROM grupos_equivalentes WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23503"}
```

Salida observada:

```json
{"sqlstate":"23503"}
```

### 42. ID generado no se reemplaza directamente

Estado: **APROBADO**.

Entrada SQL:

```sql
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE grupos_equivalentes SET id=999 WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"428C9"}
```

Salida observada:

```json
{"sqlstate":"428C9"}
```

### 43. FK impide regenerar el ID de un grupo referenciado

Estado: **APROBADO**.

Entrada SQL:

```sql
DO $caso$ BEGIN BEGIN EXECUTE 'UPDATE grupos_equivalentes SET id=DEFAULT WHERE id=1'; EXCEPTION WHEN OTHERS THEN PERFORM set_config('s3t6.estado',SQLSTATE,false); RETURN; END; RAISE EXCEPTION 'Se permitió la operación'; END $caso$;
    SELECT json_build_object('sqlstate',current_setting('s3t6.estado'));
```

Salida esperada:

```json
{"sqlstate":"23503"}
```

Salida observada:

```json
{"sqlstate":"23503"}
```

### 44. Se permite desclasificar sin borrar el producto

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
WITH p AS (UPDATE productos SET grupo_equivalente_id=NULL WHERE id=43 RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":43,"grupo_equivalente_id":null}
```

Salida observada:

```json
{"id":43,"grupo_equivalente_id":null}
```

### 45. Alta antigua sin grupo sigue funcionando

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
WITH p AS (INSERT INTO productos(id,cafeteria_id,nombre,precio,stock) VALUES(61,1,'Alta sin grupo',1500,5) RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":61,"grupo_equivalente_id":null}
```

Salida observada:

```json
{"id":61,"grupo_equivalente_id":null}
```

### 46. Alta con grupo existente funciona

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
WITH p AS (INSERT INTO productos(id,cafeteria_id,nombre,precio,stock,grupo_equivalente_id) VALUES(62,1,'Alta con grupo',1800,5,1) RETURNING id,grupo_equivalente_id) SELECT row_to_json(p) FROM p;
```

Salida esperada:

```json
{"id":62,"grupo_equivalente_id":1}
```

Salida observada:

```json
{"id":62,"grupo_equivalente_id":1}
```

### 47. Borrado previo del producto no borra el catálogo

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
WITH p AS (DELETE FROM productos WHERE id IN (61,62) RETURNING id) SELECT json_build_object('filas',count(*)) FROM p;
```

Salida esperada:

```json
{"filas":2}
```

Salida observada:

```json
{"filas":2}
```

### 48. Cotización V06 anterior conserva sus importes

Estado: **APROBADO**.

Entrada SQL y sesión emulada:

```sql
SET SESSION AUTHORIZATION cf_eq_authenticator; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT row_to_json(c) FROM cotizar_carrito_afiliado(1,'[{"producto_id":41,"cantidad":1}]') c;
```

Salida esperada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"sin_codigo"}
```

Salida observada:

```json
{"subtotal":10000,"descuento_afiliado":0,"total":10000,"comision":0,"motivo":"sin_codigo"}
```

### 49. Clasificar no cambia precio ni stock de los productos

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('productos',count(*),'stock',sum(stock),'precio',sum(precio)) FROM productos;
```

Salida esperada:

```json
{"productos":3,"stock":60,"precio":21500}
```

Salida observada:

```json
{"productos":3,"stock":60,"precio":21500}
```

### 50. Índice parcial de referencia existe y es válido

Estado: **APROBADO**.

Entrada SQL:

```sql
SELECT json_build_object('valido',indisvalid,'parcial',indpred IS NOT NULL) FROM pg_index WHERE indexrelid='public.productos_grupo_equivalente_idx'::regclass;
```

Salida esperada:

```json
{"valido":true,"parcial":true}
```

Salida observada:

```json
{"valido":true,"parcial":true}
```

## Comprobaciones adicionales

El rollback fallido conservó exactamente los productos anteriores. Tras la migración, el contenido anterior de cada producto permaneció idéntico y solo apareció la nueva columna NULL. Las políticas RLS de productos y el número de funciones de aplicación permanecieron idénticos. Al finalizar los casos se volvió a comparar cada campo previo de los productos: sin cambios de precio, stock ni otros atributos. Se verificó una cotización V06 idéntica antes y después.

La revisión independiente del modelo por Camilo está pendiente. La selección de la interfaz corresponde a S3-T7/S3-T8 y el endpoint de comparación a A15.
