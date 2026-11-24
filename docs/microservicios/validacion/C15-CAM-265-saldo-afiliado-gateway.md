# C15 / CAM-265 — Saldo y retiro simulado por gateway

El 19 de noviembre de 2026 se validó la consulta de saldo con sesiones reales de Supabase Auth en un entorno local desechable. **La consulta pasó.** El retiro simulado con comprobante e idempotencia queda pendiente de V13 y V14. [C15 en Linear](https://linear.app/camilodarwitg/issue/CAM-265/c15-integrar-saldo-y-retiro-por-el-gateway)

## Entorno

- Windows, Node.js 24.13.0 y Docker Desktop. Se ejecutó `ms-pedidos` con los cambios locales de C15 sobre `ed8d0e3`.
- Nginx temporal en `127.0.0.1:56808` y `ms-pedidos` en el puerto `56305`. Se reutilizó la configuración del gateway con los destinos ajustados para la prueba.
- Supabase desechable `coffeefaster_c15_v12`, con API en `127.0.0.1:56321`, Auth y PostgREST. Se aplicaron las migraciones de la copia del commit [884f256 de db_CoffeeFaster](https://github.com/Diego24Vas/db_CoffeeFaster/commit/884f25698e76df7d50a08b8a0d0a81a1059733e9), incluida `20261118211348_consulta_saldo_afiliado.sql`.

## Pasos y resultados

1. Crear dos cuentas confirmadas en Auth y vincularlas a usuarios activos con rol `estudiante`.
2. Cargar para el primer estudiante dos comisiones de prueba, una pendiente por $500 y otra disponible por $1.000, más un retiro histórico de $300 insertado como dato de prueba. Mantener al segundo estudiante sin movimientos de afiliación.
3. Consultar `GET /api/afiliados/saldo` por Nginx sin sesión y con el JWT de cada estudiante. Para cada sesión, comparar los campos con `POST /rest/v1/rpc/consultar_saldo_afiliado` usando ese mismo JWT.
4. Repetir la consulta autenticada con `?estudiante_id=2` y comprobar el rechazo. Verificar `Cache-Control: no-store` en las respuestas exitosas.

| Caso | Esperado | Observado |
|---|---|---|
| Estudiante con movimientos | `200`, pendiente $500, disponible $700 y retirado $300 | `200`, `{"pendiente_clp":500,"disponible_clp":700,"retirado_clp":300}`. Coincidió con la RPC. |
| Estudiante sin movimientos | `200` con los tres importes en cero | `200`, `{"pendiente_clp":0,"disponible_clp":0,"retirado_clp":0}`. Coincidió con la RPC. |
| Sin sesión | `401` | `401`. |
| Sesión válida con ID de estudiante en la URL | `400` | `400` con ambas sesiones. |
| Respuesta exitosa | `Cache-Control: no-store` | Cabecera verificada para ambas cuentas. |

## Comprobaciones complementarias

- `npm test --prefix Microservices/ms-pedidos -- --ci --silent` pasó 191 pruebas en Node.js 24. La suite [saldo-afiliado.test.js](../../../Microservices/ms-pedidos/tests/saldo-afiliado.test.js) usa Supabase simulado.
- La prueba SQL oficial `tests/saldo_afiliado.cjs` de V12 pasó en PostgreSQL 17.11 desechable. El gateway con Auth y PostgREST se comprobó en la corrida local descrita arriba.

## Prueba de saldo y retiro del 24 de noviembre de 2026

En Windows con Node.js 22.23.5, el runner creó un entorno desechable con Nginx,
`ms-afiliados`, Supabase Auth, PostgREST y PostgreSQL. Aplicó V12, V13 y V14
desde `db_CoffeeFaster` y usó los datos desechables de A06/A10. La suite de
`ms-afiliados` pasó sus 51 pruebas. No se hicieron operaciones en Cloud.

Desde la raíz, con Docker activo, dependencias instaladas y las migraciones
en `../db_CoffeeFaster/supabase/migrations` (o `COFFEEFAST_DB_MIGRATIONS`):

```powershell
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
```

| Solicitud al gateway | HTTP | Respuesta observada |
|---|---:|---|
| `GET /api/afiliados/saldo` con sesión del estudiante | 200 | `{"pendiente_clp":0,"disponible_clp":1050,"retirado_clp":450}` |
| `POST /api/afiliados/retiros` con `{"monto_clp":1050,"clave_idempotencia":"retiro-c15"}` | 200 | `{"monto_clp":1050,"estado":"confirmado","referencia":"293da000-f4f1-45fd-bf22-242607882759","destino":"Cuenta de prueba CoffeeFast (destino ficticio)","disponible_clp":0}` |
| Mismo POST, clave y sesión, con saldo ya agotado | 200 | Cuerpo idéntico al primer POST. |
| Mismo POST y clave con `monto_clp: 1` | 409 | `conflicto_idempotencia` |
| Mismo POST con otro estudiante sin saldo | 422 | `saldo_insuficiente` |
| Mismo POST sin sesión / con sesión de dueño | 401 / 403 | Falta el encabezado de autorización / `estudiante_requerido`. |
| `GET /api/afiliados/saldo` después del reintento | 200 | `{"pendiente_clp":0,"disponible_clp":0,"retirado_clp":1500}` |

PostgreSQL registró una sola fila para el estudiante de prueba y la clave
`retiro-c15`. El runner imprime las solicitudes y respuestas sin los JWT.
[Contrato C15](../../contratos-integracion-afiliados.md#saldo-y-retiro-por-el-gateway-c15).
