# C11 — Compras concurrentes con claves distintas

Validación del 23 de noviembre de 2026 en PostgreSQL 15.20 desechable, con Node.js 24.13.0 y las migraciones de `db_CoffeeFaster` del commit `c595eccb70f5d59e82d30ded1c662ce5b80c2d14`. El escenario representa al mismo estudiante confirmando un carrito en dos dispositivos antes de que termine el primer pago.

## Pasos

1. Aplicar V07, V08, V09 y la regla vigente de un uso por comprador y código en una base temporal. Usar el estudiante ficticio `13`, sin pedidos previos en la cafetería `1`, con saldo de $100.000 CLP. Preparar un carrito de $1.000 CLP y el código `CAFE-11` del afiliado `11`. [Escenario E02](../E02-cuentas-cafeterias-prueba.md) · [Reglas del piloto](../../reglas-piloto-afiliados.md)
2. Invocar `procesar_pago` en dos conexiones con la misma identidad autenticada, el mismo carrito y un total aceptado de $850 CLP. Usar las claves de idempotencia `c11-concurrente-a` y `c11-concurrente-b`. Mantener abierta la primera transacción durante ocho segundos y comprobar con `pg_blocking_pids` que la segunda espera a la primera. [Prueba SQL](../../../database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs)
3. Completar las transacciones y revisar ambas respuestas, los pedidos, los movimientos de Wallet y la atribución persistida. [Contrato de confirmación](../../microservicios/validacion/C07-cotizacion-compra-gateway.md)

## Resultados

| Comprobación | Esperado | Observado |
|---|---|---|
| Concurrencia | Dos claves distintas y la segunda conexión espera a la primera. | `pg_blocking_pids` confirmó la espera de `c11_segunda` por `c11_primera`. |
| Primer intento | Pago de $850 CLP, descuento de $150 CLP y atribución con $85 CLP de comisión pendiente. | `c11-concurrente-a` creó el pedido `3` con esos importes y registró la comisión para la afiliación `104`. |
| Segundo intento | `precio_actualizado` con motivo `beneficio_usado`, total de $1.000 CLP, descuento cero y `cobrado: false`. | `c11-concurrente-b` devolvió esos valores y quedó pendiente una nueva confirmación del precio. |
| Persistencia | Un pedido, un débito y un movimiento de comisión. | Se registraron exactamente un pedido, un débito de $850 CLP y una comisión pendiente ligada al pedido `3`. |

En la validación de referencia también pasó `tests/pago_afiliado.cjs` de `db_CoffeeFaster`. Su caso V08 con las claves `a` y `b` cubre la regla original de primera compra por estudiante y cafetería. El caso C11 usa la regla vigente por código.

La prueba SQL usa datos ficticios y una identidad simulada con `SET ROLE authenticated`. La aserción comprueba qué sesión bloquea a la otra y la persistencia de un solo beneficio. En la revisión del PR se observó una espera `transactionid`. Identificar el bloqueo asesor (`advisory`) por comprador queda fuera del alcance de esta aserción. [Revisión del PR #118](https://github.com/cdarwitg2024/taller-integracion-3/pull/118#issuecomment-7118645822)

## Validación HTTP manual con Supabase Auth y gateway

Este apartado registra una ejecución local puntual, fuera de CI, con un script temporal. Se levantó un entorno desechable con GoTrue, PostgREST, PostgreSQL 15 y Nginx. Se usó el código de la rama para cotizar y confirmar. La cuenta se creó para la prueba con datos equivalentes a E02 y se vinculó al estudiante `13`. Dos inicios de sesión independientes emitieron tokens distintos para la misma cuenta. Se usaron dos clientes HTTP desde el equipo local. La comprobación en dos dispositivos con la app móvil queda pendiente.

1. Enviar `POST /api/afiliados/cotizaciones` desde cada sesión para el mismo carrito y el código `CAFE-11`. Ambas cotizaciones devolvieron HTTP 200 y un total de $850 CLP.
2. Enviar ambos `POST /api/pedidos` de forma concurrente con el total aceptado de $850 CLP y las claves `c11-http-a` y `c11-http-b` en el encabezado `Idempotency-Key`. Un disparador temporal de la base de pruebas mantuvo abierta la primera transacción durante ocho segundos. `pg_blocking_pids` confirmó que la otra estaba esperando ese bloqueo.
3. Comparar las respuestas y consultar los registros que quedaron en la base. [Contrato de confirmación](../../microservicios/validacion/C07-cotizacion-compra-gateway.md)

| Comprobación | Esperado | Observado |
|---|---|---|
| Confirmación ganadora | HTTP 201 con el descuento aplicado. | Pedido `1` en estado `pagado`, total de $850 CLP y descuento de $150 CLP. |
| Confirmación que esperó | HTTP 409 que pide aceptar el precio actualizado, sin cobro. | `precio_actualizado`, `beneficio_usado`, total de $1.000 CLP, descuento cero y `cobrado: false`. |
| Persistencia | Un pedido, un débito y una atribución. | Un pedido para el estudiante `13`, un débito de $850 CLP y una comisión pendiente de $85 CLP para la afiliación `104`. |

## Reproducción de la prueba SQL automatizada

Con PostgreSQL 15 de prueba en Docker y el checkout de `db_CoffeeFaster` junto al repositorio, ejecutar desde la raíz. El runner crea y elimina su base temporal. La ejecución local documentada usó `c595ecc`. CI ejecuta la prueba SQL con Node.js 22 y fija `d074ed56aaf3e9c3992b8852a052f9f76d86f5cc`. Durante la revisión se verificó el runner con Node.js 22 y PostgreSQL 15 en ambos commits. [Workflow de CI](../../../.github/workflows/ci-functional.yml) · [Revisión del PR #118](https://github.com/cdarwitg2024/taller-integracion-3/pull/118#issuecomment-7118645822)

```powershell
$env:TEST_POSTGRES_CONTAINER = 'cf-c11-postgres'
$env:DB_COFFEEFASTER_DIR = (Resolve-Path ../db_CoffeeFaster).Path
node database/tests/prueba_limitar_beneficio_por_comprador_y_codigo.cjs
```
