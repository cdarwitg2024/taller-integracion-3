<!-- Prepara cuentas y cafeterías ficticias E02 para probar compra, retiro y aislamiento entre dos cafeterías en un Supabase local aislado. -->
# E02 — Cuentas y cafeterías de prueba

Documento operativo para un entorno **local y desechable**. No contiene cuentas,
correos, contraseñas ni claves reales. Ningún paso debe ejecutarse contra Supabase
Cloud.

## 1. Alcance y advertencias

- Objetivo: probar compra, retiro y aislamiento entre dos cafeterías con los roles
  reales del esquema (`estudiante`, `empleado`, `dueño`).
- Todo dato creado aquí es ficticio, está marcado con `E02-PRUEBA` o
  `@example.test`, y se elimina al final.
- La contraseña de prueba es explícita y compartida para simplificar el entorno
  local: `E02-solo-local-2026!`. **Nunca debe usarse en Cloud ni en una base con
  datos reales.**
- No se agregan seeds globales ni migraciones automáticas. El fixture se ejecuta
  a mano y su limpieza también.
- Los correos `@example.test` son sintéticos: no reciben mensajes reales.
- Los listados de Auth usan hasta 1000 cuentas por página; es suficiente para este
  entorno local. Si el local supera ese volumen, pagina antes de reutilizar UUID.

## 2. Esquema y roles reales verificados

Inspección local del 13 de noviembre de 2026 sobre
`supabase_db_taller-integracion-3` (PostgreSQL 17):

```sql
SELECT id, nombre FROM public.roles ORDER BY id;
```

| `rol_id` | `nombre` real | Uso en el flujo |
| --- | --- | --- |
| 1 | `estudiante` | Comprador: crea pedidos, consulta los suyos y obtiene su QR. |
| 2 | `empleado` | Operador: KDS, cambios de estado y validación de retiro de su cafetería. |
| 3 | `dueño` | Administración de su cafetería; no recibe la colección global de pedidos. |

La cadena de identidad que usa el código es:

```text
auth.users.id (UUID)
  → public.usuarios.auth_user_id
  → public.usuarios.id
  → public.cafeteria_usuarios (usuario_id, cafeteria_id)
  → cafetería autoritativa
```

### 2.1 Equivalencia de «afiliado»

En el repositorio **no existe** el rol `afiliado`. La búsqueda en código, SQL y
documentación no devuelve ese nombre. El equivalente real es **`empleado`
(`rol_id = 2`)**, afiliado a una cafetería mediante `public.cafeteria_usuarios`.
Este documento usa «empleado/afiliado» solo como sinónimo operativo; el valor que
se guarda es `rol_id = 2`.

### 2.2 Estado del esquema local (limitación importante)

El Supabase local de este repositorio **no tiene todas las tablas del flujo**:

- Existen: `roles`, `usuarios`, `cafeterias`, `productos`, `pedidos`,
  `detalles_pedido`, `logs_validacion_qr`, `anuncios_pedido`,
  `solicitudes_stock`, `categorias`.
- No existen: `cafeteria_usuarios`, `wallets`, `pagos`, `metodos_pago`,
  `movimientos_wallet`.
- `pedidos` no tiene `stock_descontado` en esta base local.
- RLS está deshabilitado en `usuarios`, `pedidos`, `productos` y `cafeterias`
  (solo está activo en las tablas auxiliares).

Por eso el fixture crea un **shim local** de `cafeteria_usuarios` cuando falta. No
se presenta como DDL autoritativo: sirve para validar pertenencia y aislamiento en
local. Si la tabla ya existe, se reutiliza y no se modifica su estructura.

La comprobación de compra/retiro completa por RPC y gateway queda limitada por las
tablas ausentes; las consultas de este documento validan el aislamiento a nivel de
datos y de pertenencia, no RLS.

## 3. Datos ficticios

### 3.1 Cafeterías

| Clave | Nombre ficticio | Estado |
| --- | --- | --- |
| `CF-E02-NORTE` | `[E02-PRUEBA] Cafetería Ficticia Norte` | Activa |
| `CF-E02-SUR` | `[E02-PRUEBA] Cafetería Ficticia Sur` | Activa |

Los nombres son claramente ficticios y llevan el prefijo `[E02-PRUEBA]` para que
la limpieza no dependa de IDs concretos.

### 3.2 Cuentas

Todas las contraseñas locales son `E02-solo-local-2026!`.

| Correo ficticio | Rol real | `rol_id` | Cafetería asociada |
| --- | --- | --- | --- |
| `dueno.norte.e02@example.test` | `dueño` | 3 | Norte |
| `dueno.sur.e02@example.test` | `dueño` | 3 | Sur |
| `comprador.norte.e02@example.test` | `estudiante` | 1 | Sin asociación (no la necesita) |
| `comprador.sur.e02@example.test` | `estudiante` | 1 | Sin asociación (no la necesita) |
| `empleado.norte.e02@example.test` | `empleado` | 2 | Norte |
| `empleado.sur.e02@example.test` | `empleado` | 2 | Sur |

Las cuentas se crean en **Supabase Auth local** (GoTrue). La fila de
`public.usuarios` solo guarda el vínculo `auth_user_id`; no se almacena
`password_hash` porque la credencial vive en Auth.

### 3.3 Matriz de cuentas, roles y pertenencia

| Cuenta | Rol | Pertenencia | Casos permitidos | Casos rechazados |
| --- | --- | --- | --- | --- |
| Dueño Norte | `dueño` (3) | `cafeteria_usuarios` → Norte | Administrar catálogo, stock y configuración de Norte | Pedidos/KDS de Sur; colección global de pedidos |
| Dueño Sur | `dueño` (3) | `cafeteria_usuarios` → Sur | Administrar catálogo, stock y configuración de Sur | Pedidos/KDS de Norte; colección global de pedidos |
| Comprador Norte | `estudiante` (1) | Sin cafetería | Comprar en cualquier cafetería; ver sus pedidos; obtener el QR de sus pedidos | Pedidos y QR de otro comprador |
| Comprador Sur | `estudiante` (1) | Sin cafetería | Comprar en cualquier cafetería; ver sus pedidos; obtener el QR de sus pedidos | Pedidos y QR de otro comprador |
| Empleado Norte | `empleado` (2) | `cafeteria_usuarios` → Norte | Listar pedidos de Norte; cambiar estado; validar retiro en Norte | Pedidos, KDS y retiro de Sur; panel de dueño |
| Empleado Sur | `empleado` (2) | `cafeteria_usuarios` → Sur | Listar pedidos de Sur; cambiar estado; validar retiro en Sur | Pedidos, KDS y retiro de Norte; panel de dueño |

## 4. Procedimiento reproducible

### 4.0 Requisitos

- Docker con el stack local de Supabase levantado (`supabase start`).
- CLI de Supabase, `curl` y `jq`.
- `psql` dentro del contenedor de base de datos (no hace falta el cliente en el
  host).
- Trabajar desde la raíz del repositorio; no usar `--linked` ni el proyecto Cloud.

### 4.1 Cargar variables y validar que el entorno es local

```bash
cd /home/elias/Documentos/taller-integracion-3
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "ABORT: API_URL no es local"; exit 1 ;;
esac
```

`SERVICE_ROLE_KEY` es una credencial local. No la imprimas, no la pegues en
documentos y no ejecutes estos comandos con `set -x`.

### 4.2 Crear las cuentas en Auth local

El siguiente bloque es idempotente: si el correo ya existe en Auth, reutiliza su
UUID. La contraseña solo se envía a la API local.

```bash
PASSWORD_LOCAL='E02-solo-local-2026!'
EMAILS=(
  dueno.norte.e02@example.test
  dueno.sur.e02@example.test
  comprador.norte.e02@example.test
  comprador.sur.e02@example.test
  empleado.norte.e02@example.test
  empleado.sur.e02@example.test
)

buscar_uuid_auth() {
  curl -s "$API_URL/auth/v1/admin/users?page=1&per_page=1000" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    | jq -r --arg e "$1" '.users[]? | select(.email==$e) | .id' | head -n1
}

crear_cuenta_e02() {
  local email="$1" uuid
  uuid="$(buscar_uuid_auth "$email")"
  if [ -z "$uuid" ]; then
    uuid="$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
      -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$email\",\"password\":\"$PASSWORD_LOCAL\",\"email_confirm\":true}" \
      | jq -r '.id')"
  fi
  [ -n "$uuid" ] && [ "$uuid" != "null" ] || { echo "Fallo creando $email"; exit 1; }
  printf '%s' "$uuid"
}

UUID_DUENO_NORTE="$(crear_cuenta_e02 "${EMAILS[0]}")"
UUID_DUENO_SUR="$(crear_cuenta_e02 "${EMAILS[1]}")"
UUID_COMPRADOR_NORTE="$(crear_cuenta_e02 "${EMAILS[2]}")"
UUID_COMPRADOR_SUR="$(crear_cuenta_e02 "${EMAILS[3]}")"
UUID_EMPLEADO_NORTE="$(crear_cuenta_e02 "${EMAILS[4]}")"
UUID_EMPLEADO_SUR="$(crear_cuenta_e02 "${EMAILS[5]}")"
```

Alternativa manual: Authentication → Users → Add user en Supabase Studio local,
marcando el correo como confirmado. Usa los mismos correos ficticios.

### 4.3 Fixture SQL local

El bloque crea el shim de `cafeteria_usuarios` solo si falta, registra si existía
antes y deja cafeterías, usuarios, pertenencias y un producto por cafetería. Es
idempotente: puede ejecutarse dos veces sin duplicar filas.

```bash
TABLA_EXISTIA="$(docker exec supabase_db_taller-integracion-3 psql -U postgres -d postgres \
  -tAc "select case when to_regclass('public.cafeteria_usuarios') is null then 'false' else 'true' end")"
[ -f /tmp/opencode/e02_cafeteria_usuarios_existia ] || echo "$TABLA_EXISTIA" > /tmp/opencode/e02_cafeteria_usuarios_existia

docker exec -i supabase_db_taller-integracion-3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v uuid_dueno_norte="$UUID_DUENO_NORTE" \
  -v uuid_dueno_sur="$UUID_DUENO_SUR" \
  -v uuid_comprador_norte="$UUID_COMPRADOR_NORTE" \
  -v uuid_comprador_sur="$UUID_COMPRADOR_SUR" \
  -v uuid_empleado_norte="$UUID_EMPLEADO_NORTE" \
  -v uuid_empleado_sur="$UUID_EMPLEADO_SUR" <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.cafeteria_usuarios') IS NULL THEN
    CREATE TABLE public.cafeteria_usuarios (
      id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      usuario_id bigint NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
      cafeteria_id bigint NOT NULL REFERENCES public.cafeterias(id) ON DELETE CASCADE,
      UNIQUE (usuario_id, cafeteria_id)
    );
  END IF;
END $$;

INSERT INTO public.cafeterias (nombre, descripcion, hora_apertura, hora_cierre, activa)
SELECT v.nombre, v.descripcion, v.apertura::time, v.cierre::time, true
FROM (VALUES
  ('[E02-PRUEBA] Cafetería Ficticia Norte', 'Datos sintéticos E02. No usar en Cloud.', '07:00', '19:00'),
  ('[E02-PRUEBA] Cafetería Ficticia Sur',  'Datos sintéticos E02. No usar en Cloud.', '10:00', '20:00')
) AS v(nombre, descripcion, apertura, cierre)
WHERE NOT EXISTS (SELECT 1 FROM public.cafeterias c WHERE c.nombre = v.nombre);

INSERT INTO public.usuarios (rol_id, nombre, apellido, email, auth_user_id, activo)
VALUES
  (3, 'Dueño', 'Ficticio Norte', 'dueno.norte.e02@example.test', :'uuid_dueno_norte', true),
  (3, 'Dueño', 'Ficticio Sur', 'dueno.sur.e02@example.test', :'uuid_dueno_sur', true),
  (1, 'Comprador', 'Ficticio Norte', 'comprador.norte.e02@example.test', :'uuid_comprador_norte', true),
  (1, 'Comprador', 'Ficticio Sur', 'comprador.sur.e02@example.test', :'uuid_comprador_sur', true),
  (2, 'Empleado', 'Ficticio Norte', 'empleado.norte.e02@example.test', :'uuid_empleado_norte', true),
  (2, 'Empleado', 'Ficticio Sur', 'empleado.sur.e02@example.test', :'uuid_empleado_sur', true)
ON CONFLICT (email) DO UPDATE
SET rol_id = EXCLUDED.rol_id,
    auth_user_id = EXCLUDED.auth_user_id,
    activo = true;

INSERT INTO public.cafeteria_usuarios (usuario_id, cafeteria_id)
SELECT u.id, c.id
FROM (VALUES
  ('dueno.norte.e02@example.test', '[E02-PRUEBA] Cafetería Ficticia Norte'),
  ('empleado.norte.e02@example.test', '[E02-PRUEBA] Cafetería Ficticia Norte'),
  ('dueno.sur.e02@example.test', '[E02-PRUEBA] Cafetería Ficticia Sur'),
  ('empleado.sur.e02@example.test', '[E02-PRUEBA] Cafetería Ficticia Sur')
) AS v(email, cafeteria)
JOIN public.usuarios u ON u.email = v.email
JOIN public.cafeterias c ON c.nombre = v.cafeteria
WHERE NOT EXISTS (
  SELECT 1 FROM public.cafeteria_usuarios x
  WHERE x.usuario_id = u.id AND x.cafeteria_id = c.id
);

INSERT INTO public.productos (cafeteria_id, nombre, descripcion, precio, stock, stock_minimo, activo)
SELECT c.id, v.producto, 'Producto sintético E02. No usar en Cloud.', v.precio, 20, 2, true
FROM (VALUES
  ('[E02-PRUEBA] Cafetería Ficticia Norte', '[E02-PRUEBA] Café Ficticio Norte', 2500),
  ('[E02-PRUEBA] Cafetería Ficticia Sur',  '[E02-PRUEBA] Café Ficticio Sur', 3000)
) AS v(cafeteria, producto, precio)
JOIN public.cafeterias c ON c.nombre = v.cafeteria
WHERE NOT EXISTS (SELECT 1 FROM public.productos p WHERE p.nombre = v.producto);
SQL
```

## 5. Consultas de verificación

### 5.1 Existencia, roles y pertenencia

```sql
-- Dos cafeterías ficticias.
SELECT id, nombre, activa
FROM public.cafeterias
WHERE nombre LIKE '[E02-PRUEBA]%'
ORDER BY id;

-- Cuentas vinculadas a Auth, rol real y cafetería.
SELECT u.email, u.rol_id, r.nombre AS rol,
       u.auth_user_id IS NOT NULL AS auth_vinculado,
       c.nombre AS cafeteria
FROM public.usuarios u
JOIN public.roles r ON r.id = u.rol_id
LEFT JOIN public.cafeteria_usuarios cu ON cu.usuario_id = u.id
LEFT JOIN public.cafeterias c ON c.id = cu.cafeteria_id
WHERE u.email LIKE '%e02@example.test'
ORDER BY u.email;

-- Cada empleado debe tener exactamente una cafetería.
SELECT u.email, count(cu.cafeteria_id) AS cafeterias
FROM public.usuarios u
LEFT JOIN public.cafeteria_usuarios cu ON cu.usuario_id = u.id
WHERE u.email LIKE 'empleado.%e02@example.test'
GROUP BY u.email
ORDER BY u.email;
```

Resultado esperado: dos cafeterías activas; seis cuentas con
`auth_vinculado = t`; cada empleado con `cafeterias = 1`; los compradores sin
pertenencia.

### 5.2 Compra

Antes de comprar, el producto debe pertenecer a la cafetería elegida:

```sql
SELECT p.id, p.nombre, p.precio, p.stock, c.nombre AS cafeteria
FROM public.productos p
JOIN public.cafeterias c ON c.id = p.cafeteria_id
WHERE p.nombre LIKE '[E02-PRUEBA]%'
ORDER BY c.nombre;
```

Después de una compra real, el pedido y su detalle deben conservar la cafetería y
el precio del producto:

```sql
SELECT pe.id, pe.cafeteria_id = p.cafeteria_id AS misma_cafeteria,
       d.precio_unitario = p.precio AS precio_coincide,
       pe.usuario_id = u.id AS comprador_correcto
FROM public.pedidos pe
JOIN public.detalles_pedido d ON d.pedido_id = pe.id
JOIN public.productos p ON p.id = d.producto_id
JOIN public.usuarios u ON u.id = pe.usuario_id
WHERE u.email LIKE '%e02@example.test';
```

En la base local este flujo completo queda **BLOQUEADO**: `procesar_pago` requiere
`wallets`, `pagos`, `metodos_pago`, `movimientos_wallet` y
`get_current_user_id`, que no están versionados ni presentes. No inventes esas
tablas para esta prueba.

### 5.3 Retiro

Para un pedido listo, el QR debe existir y el empleado debe pertenecer a la
cafetería del pedido:

```sql
SELECT pe.id, pe.estado, pe.qr_token IS NOT NULL AS tiene_qr,
       c.nombre AS cafeteria,
       EXISTS (
         SELECT 1 FROM public.cafeteria_usuarios cu
         JOIN public.usuarios e ON e.id = cu.usuario_id
         WHERE e.email = 'empleado.norte.e02@example.test'
           AND cu.cafeteria_id = pe.cafeteria_id
       ) AS empleado_autorizado,
       pe.usuario_id = (
         SELECT id FROM public.usuarios
         WHERE email = 'comprador.norte.e02@example.test'
       ) AS dueno_correcto
FROM public.pedidos pe
JOIN public.cafeterias c ON c.id = pe.cafeteria_id
WHERE pe.estado = 'listo'
  AND c.nombre LIKE '[E02-PRUEBA]%';
```

El retiro por endpoint (`GET /api/pedidos/:id/qr` y validación del empleado) no se
puede ejecutar en esta base local porque el gateway y los microservicios no están
levantados. La consulta anterior valida las condiciones de datos: estado `listo`,
QR presente, empleado de la misma cafetería y comprador propietario.

### 5.4 Aislamiento propio/ajeno

Las siguientes consultas se ejecutan dentro de una transacción con `ROLLBACK`, de
modo que los pedidos temporales no quedan guardados:

```sql
BEGIN;

INSERT INTO public.pedidos (cafeteria_id, usuario_id, estado, total, qr_token)
SELECT c.id, u.id, 'listo', 2500, gen_random_uuid()::text
FROM public.cafeterias c
JOIN public.usuarios u ON u.email = 'comprador.norte.e02@example.test'
WHERE c.nombre = '[E02-PRUEBA] Cafetería Ficticia Norte';

INSERT INTO public.pedidos (cafeteria_id, usuario_id, estado, total, qr_token)
SELECT c.id, u.id, 'listo', 3000, gen_random_uuid()::text
FROM public.cafeterias c
JOIN public.usuarios u ON u.email = 'comprador.sur.e02@example.test'
WHERE c.nombre = '[E02-PRUEBA] Cafetería Ficticia Sur';

-- Empleado Norte: pedidos de su cafetería (esperado 1).
SELECT count(*) FROM public.pedidos p
JOIN public.cafeterias c ON c.id = p.cafeteria_id
WHERE c.nombre = '[E02-PRUEBA] Cafetería Ficticia Norte'
  AND EXISTS (
    SELECT 1 FROM public.cafeteria_usuarios cu
    JOIN public.usuarios u ON u.id = cu.usuario_id
    WHERE u.email = 'empleado.norte.e02@example.test'
      AND cu.cafeteria_id = p.cafeteria_id
  );

-- Empleado Norte: pedidos de la cafetería ajena (esperado 0).
SELECT count(*) FROM public.pedidos p
JOIN public.cafeterias c ON c.id = p.cafeteria_id
WHERE c.nombre = '[E02-PRUEBA] Cafetería Ficticia Sur'
  AND EXISTS (
    SELECT 1 FROM public.cafeteria_usuarios cu
    JOIN public.usuarios u ON u.id = cu.usuario_id
    WHERE u.email = 'empleado.norte.e02@example.test'
      AND cu.cafeteria_id = p.cafeteria_id
  );

-- Comprador Norte: pedidos propios (esperado 1).
SELECT count(*) FROM public.pedidos p
JOIN public.usuarios u ON u.id = p.usuario_id
WHERE u.email = 'comprador.norte.e02@example.test';

-- Comprador Norte: pedido ajeno (esperado 0).
SELECT count(*) FROM public.pedidos p
JOIN public.usuarios otro ON otro.id = p.usuario_id
WHERE otro.email = 'comprador.sur.e02@example.test'
  AND p.usuario_id = (
    SELECT id FROM public.usuarios
    WHERE email = 'comprador.norte.e02@example.test'
  );

ROLLBACK;
```

Resultados esperados: `1`, `0`, `1`, `0`. El empleado Sur se comporta de forma
simétrica.

### 5.5 Casos rechazados por los endpoints

Estas comprobaciones requieren el gateway local. La tabla deja el resultado
esperado para cuando esté disponible:

| Petición | Actor | Esperado |
| --- | --- | --- |
| `GET /api/pedidos` | Empleado Norte | Solo pedidos de Norte (200) |
| `GET /api/pedidos/:id` de Sur | Empleado Norte | 404 |
| `GET /api/pedidos/cafeteria/:idSur` | Empleado Norte | 403 |
| `GET /api/pedidos/:id/qr` de Sur | Comprador Norte | 404 |
| `GET /api/pedidos/:id/qr` | Empleado o dueño | 404 |
| `GET /api/pedidos/:id/qr` de un pedido entregado/cancelado | Comprador propietario | 409 |
| `GET /api/pedidos` | Dueño | 403 |
| `PATCH /api/pedidos/:id` con `estado: entregado` | Empleado autorizado | 409 (requiere QR) |
| `PATCH /api/pedidos/:id` de Sur | Empleado Norte | 403 |

La autorización real la aplica `ms-pedidos` después de resolver la identidad del
JWT. **No la aplica RLS en esta base local**, porque `pedidos` y `usuarios` tienen
RLS deshabilitado. No interpretes las consultas SQL como una prueba de seguridad
equivalente a RLS.

## 6. Limpieza y reset

El bloque elimina pedidos, productos, pertenencias, usuarios y cafeterías E02,
borra las cuentas Auth y elimina el shim solo si lo creó este procedimiento. Es
idempotente.

```bash
docker exec -i supabase_db_taller-integracion-3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.pedidos p
USING public.cafeterias c
WHERE p.cafeteria_id = c.id AND c.nombre LIKE '[E02-PRUEBA]%';

DELETE FROM public.cafeteria_usuarios cu
USING public.usuarios u
WHERE cu.usuario_id = u.id AND u.email LIKE '%e02@example.test';

DELETE FROM public.cafeteria_usuarios cu
USING public.cafeterias c
WHERE cu.cafeteria_id = c.id AND c.nombre LIKE '[E02-PRUEBA]%';

DELETE FROM public.productos WHERE nombre LIKE '[E02-PRUEBA]%';
DELETE FROM public.usuarios WHERE email LIKE '%e02@example.test';
DELETE FROM public.cafeterias WHERE nombre LIKE '[E02-PRUEBA]%';
SQL

FLAG=/tmp/opencode/e02_cafeteria_usuarios_existia
if [ "$(cat "$FLAG" 2>/dev/null)" = "false" ]; then
  docker exec -i supabase_db_taller-integracion-3 psql -U postgres -d postgres \
    -c 'DROP TABLE IF EXISTS public.cafeteria_usuarios;'
elif [ ! -f "$FLAG" ]; then
  echo "Aviso: falta $FLAG; no se elimina cafeteria_usuarios automáticamente."
fi

for id in $(curl -s "$API_URL/auth/v1/admin/users?page=1&per_page=1000" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq -r '.users[]? | select(.email | test("e02@example.test$")) | .id'); do
  curl -s -o /dev/null -X DELETE "$API_URL/auth/v1/admin/users/$id" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
done
rm -f /tmp/opencode/e02_cafeteria_usuarios_existia
```

Comprobación final:

```sql
SELECT count(*) AS cafeterias_e02 FROM public.cafeterias
WHERE nombre LIKE '[E02-PRUEBA]%';

SELECT count(*) AS usuarios_e02 FROM public.usuarios
WHERE email LIKE '%e02@example.test';

SELECT case when to_regclass('public.cafeteria_usuarios') is null
            then 'false' else 'true' end AS shim_presente;
```

Esperado: `0`, `0`, `false` (si el shim no existía antes). Si la tabla ya existía,
el tercer valor será `true` y solo deben haberse borrado las filas E02.

Para un reset completo del entorno local existe `supabase db reset`, pero **borra
toda la base local**. Úsalo solo si no necesitas los datos actuales.

## 7. Verificación ejecutada

Fecha: 13 de noviembre de 2026. Entorno: Supabase local
(`supabase_db_taller-integracion-3`), sin Cloud.

| Comprobación | Resultado |
| --- | --- |
| Roles reales `1/2/3` (`estudiante`, `empleado`, `dueño`) | PASS |
| Creación idempotente de seis cuentas Auth locales | PASS |
| Dos cafeterías ficticias creadas | PASS |
| Seis `public.usuarios` con `auth_user_id` vinculado | PASS |
| Cuatro pertenencias en `cafeteria_usuarios` (dueño/empleado por cafetería) | PASS |
| Producto ficticio por cafetería | PASS |
| Empleado Norte ve 1 pedido propio y 0 de Sur | PASS |
| Comprador Norte ve 1 pedido propio y 0 ajeno | PASS |
| Pedido listo con QR y empleado autorizado | PASS |
| Limpieza de datos y cuentas Auth | PASS |
| Compra completa por `procesar_pago` | BLOQUEADO: faltan tablas de wallet/pago y `get_current_user_id` |
| Retiro por gateway/endpoint | BLOQUEADO: gateway y microservicios no están levantados |
| Aislamiento por RLS | BLOQUEADO: RLS deshabilitado en `pedidos`/`usuarios`; el aislamiento observado es de datos y de filtros de aplicación |

## 8. Referencias

- [Estado actual](../estado-actual.md)
- [Dependencias SQL de ms-pedidos](dependencias-sql-ms-pedidos.md)
- [Validación QR y entrega](D4_validacion_qr_entrega.md)
- [Seed básico existente](../../database/fixes/seed_datos_basicos.sql)
- [RPC de compra versionada](../../app-mobile/tabla_mobile/rpc_qr.sql)
