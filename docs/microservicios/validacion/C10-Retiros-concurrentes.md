# C10 / CAM-252 — Retiros concurrentes sobre el mismo saldo

[Tarea CAM-252 en Linear](https://linear.app/camilodarwitg/issue/CAM-252/c10-probar-retiros-concurrentes)

El 25 de noviembre de 2026 se probaron dos retiros de $700 y $600 CLP contra
un saldo de $1.000 CLP. El gateway confirmó uno y PostgreSQL conservó únicamente
el retiro confirmado. La prueba admite que gane cualquiera de las solicitudes.

## Entorno y reproducción

En Windows, con Docker Desktop, Node.js 22 y las dependencias de
`ms-afiliados` instaladas, ejecutar desde la raíz. El runner levanta y elimina
PostgreSQL 15, Supabase Auth, PostgREST y Nginx desechables y ejecuta el
servicio real. Usa el checkout vecino de `db_CoffeeFaster` en
`c595eccb70f5d59e82d30ded1c662ce5b80c2d14` para instalar V12, V13 y V14.
Se puede indicar otra ruta a sus migraciones mediante `COFFEEFAST_DB_MIGRATIONS`.
La ejecución es local y usa cuentas ficticias.

El job `mobile-afiliaciones` de [CI Functional](../../../.github/workflows/ci-functional.yml)
ejecuta C10 en un paso propio con las migraciones fijadas por el workflow.

```powershell
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --c10
```

## Pasos

1. Crear una cuenta de estudiante y otra de dueño en Auth, vincular sus UUID a
   los usuarios internos y asignar el dueño a la cafetería ficticia Norte (ID 7).
   El runner adapta el patrón de cuentas y pertenencias de E02 a su esquema
   desechable. Crear una campaña para Norte y aprobar por C05 la solicitud del
   estudiante 6. [Datos E02](../../base-datos/E02-cuentas-cafeterias-prueba.md)
2. Cargar una comisión disponible de $1.000 CLP asociada a un pedido entregado.
   Consultar `GET /api/afiliados/saldo` con la sesión del estudiante.
3. Enviar ambos `POST /api/afiliados/retiros` en paralelo con esa misma sesión
   y las claves distintas `c10-a` y `c10-b`. Un trigger temporal del entorno
   de prueba mantiene abierta la primera inserción durante cinco segundos.
   Consultar `pg_blocking_pids` para comprobar que una llamada a V14 espera a
   la otra antes de que termine la primera transacción.
4. Comparar ambos resultados HTTP y el comprobante contra el saldo final de V12
   y las filas del estudiante en `retiros_afiliado`. [Prueba C10](../../../.github/scripts/test-retiros-concurrentes-c10.cjs) · [Contrato C15 y referencia a V14](../../contratos-integracion-afiliados.md#saldo-y-retiro-por-el-gateway-c15) · [Validación C15](C15-CAM-265-saldo-afiliado-gateway.md)

## Resultado observado

| Comprobación | Esperado | Observado |
|---|---|---|
| Saldo inicial | $1.000 CLP disponibles y $0 retirados. Cada solicitud cabe por separado y las dos suman $1.300 CLP. | HTTP 200 con $1.000 disponibles y $0 retirados. |
| Concurrencia | PostgreSQL observa una llamada a V14 esperando a la otra. | PID 405 esperó al PID 187 por `transactionid`. |
| Confirmación | Una sola respuesta HTTP 200, por $700 o $600 CLP, con comprobante. | `c10-a` confirmó $700 CLP con referencia `8ed427ee-0e60-4f07-8119-e77a7f3da9ca` y saldo posterior de $300 CLP. |
| Rechazo | HTTP 422 con `saldo_insuficiente` para la otra solicitud. | `c10-b` recibió HTTP 422 con `saldo_insuficiente`. |
| Conciliación | Saldo final igual a saldo inicial menos el retiro confirmado. Una sola fila persistida con la misma referencia y los mismos importes. | V12 devolvió $300 CLP disponibles y $700 retirados. PostgreSQL registró una fila para `c10-a` con el mismo comprobante, $700 retirados y $300 de saldo posterior. |

Los identificadores de sesión de PostgreSQL y el comprobante corresponden a la
corrida con Node.js 22.23.5. Una corrida previa con Node.js 24.13.0 produjo los
mismos importes y estados HTTP. Con Node.js 22.23.5 también pasaron las 66
pruebas de `ms-afiliados` mediante `npm test --prefix Microservices/ms-afiliados -- --ci --silent`.

## Revalidación del 27 de noviembre de 2026

En Windows con Node.js 22.23.5, Docker Desktop y el checkout de migraciones
`c595ecc`, PostgreSQL observó al PID 405 esperando al PID 185 por
`transactionid`. `c10-a` confirmó $700 CLP (HTTP 200) con la referencia
`6fc22599-2198-48d1-b91e-e2471b107ba0`. `c10-b` recibió HTTP 422
`saldo_insuficiente`. V12 devolvió $300 CLP disponibles y $700 CLP retirados.
Se comprobó una sola fila con esa referencia, ese monto y ese saldo posterior.
También pasaron las 66 pruebas de `ms-afiliados` con Node.js 22.23.5.
