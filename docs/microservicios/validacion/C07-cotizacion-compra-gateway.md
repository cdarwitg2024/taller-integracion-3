# C07 · Cotización y confirmación por el gateway

[CAM-184](https://linear.app/camilodarwitg/issue/CAM-184/c07-integrar-cotizacion-y-compra-por-el-gateway) usa el contrato [C02](../../contratos-integracion-afiliados.md). `POST /api/afiliados/cotizaciones` llama a `cotizar_carrito_afiliado` con el JWT del comprador. Devuelve subtotal, descuento y total en CLP, o `422` con el motivo de inelegibilidad de V06.

`POST /api/pedidos` selecciona la confirmación cuando el cuerpo incluye `total_aceptado`. Una petición con solo `Idempotency-Key` conserva el flujo anterior, que todavía usa la RPC de tres parámetros sin aplicar esa clave. La confirmación está deshabilitada por defecto y responde `503 confirmacion_afiliada_no_disponible`. La compra móvil vigente, que puede enviar solo el código, conserva la firma de tres parámetros, el cobro sin descuento afiliado y la respuesta `{ok, pedido}`.

La cotización también está deshabilitada por defecto y devuelve `503 cotizacion_afiliada_no_disponible`. El Compose desechable habilita ambos endpoints con `HABILITAR_CONFIRMACION_AFILIADA=true` en `ms-afiliados` y `ms-pedidos`. Al confirmar, el servicio comprueba la cuenta activa y la pertenencia de los productos a la cafetería. La clave identifica el mismo intento con el mismo cuerpo. Para aceptar un total actualizado, el cliente envía una clave nueva. La RPC recibe el JWT del comprador y resuelve la revalidación y los reintentos.

## Contrato provisional de Supabase

C07 llama a la sobrecarga de `procesar_pago` con `p_cafeteria_id`, `p_items`, `p_franja_retiro`, `p_codigo` (nullable), `p_total_aceptado` y `p_clave_idempotencia`. V08 devuelve `ok: true`, `pago_estado: "pagado"` y el estado operativo del pedido, que al comprar es `pendiente`. El gateway valida el pago y devuelve HTTP 201 con `pedido_id`, `estado: "pagado"`, `total_pagado` y `descuento_afiliado`. Para reconfirmar, la RPC devuelve `error: "precio_actualizado"` con `motivo`, `total_actualizado` y `descuento_afiliado`. Los rechazos de negocio de V08 usan `{ ok:false, motivo, cobrado:false }`: `clave_reintento_en_conflicto` responde 409 y `saldo_insuficiente` responde HTTP 422 con `{ error:"saldo_insuficiente", cobrado:false }`. El gateway conserva la forma anterior basada en `error` para las variantes ya desplegadas.

[V08](https://linear.app/camilodarwitg/issue/CAM-176/v08-registrar-afiliacion-dentro-del-pago) y [V15](https://linear.app/camilodarwitg/issue/CAM-264/v15-verificar-reversion-de-la-compra-afiliada-ante-un-fallo) figuran pendientes en Linear. La firma nueva se simuló en la prueba HTTP. La compatibilidad con la firma definitiva y la reversión en PostgreSQL quedan pendientes de esas tareas. La app móvil que confirme con código debe enviar también el total aceptado y la clave.

## Prueba en Compose

Desde la raíz, ejecutar con Docker Desktop y el motor Linux activos.

```powershell
docker compose -f Microservices/compose.c07.yml up --build --abort-on-container-exit --exit-code-from prueba
docker compose -f Microservices/compose.c07.yml down
```

El escenario usa Node 22 y el Nginx del repositorio. Las solicitudes entran por el gateway y pasan por los dos microservicios. El doble de Auth, RPC y precios legacy usa datos ficticios en memoria dentro de la red de Compose.

- La cotización de $10.000 aplica $1.500 de descuento y el pedido cobra $8.500.
- Al pausar la campaña entre la cotización y la confirmación, el gateway devuelve `409` con $10.000 para reconfirmar. El escenario compara saldo, pedidos y comisiones antes y después.
- El escenario verifica los rechazos sin cobro por falta de stock (`409`), Wallet inexistente (`422`) y precio por línea desactualizado (`409`). Este último conserva el total informado por V08 y omite el descuento si la RPC no lo entrega.
- El fallo de V15 se simula después de preparar el pedido y el débito. El gateway devuelve `503` y el estado del doble conserva su saldo de $50.000 y sus colecciones vacías. Al quitar la falla, el siguiente intento registra el pedido y una comisión de $850.
- Los reintentos afiliado y sin código devuelven cada uno su pedido original. Reutilizar una clave con un total distinto devuelve `409`. El escenario también comprueba que la compra legacy sigue llegando a la RPC de tres parámetros.

El 20 de noviembre de 2026, Docker Compose 5.1.1 en Windows ejecutó el escenario con código de salida 0. Los reintentos devolvieron los IDs ficticios 501 y 502, respectivamente. El saldo quedó en $50.000 tras el `409` y el `503`, en $41.500 tras la compra afiliada y en $31.500 tras la compra sin código con clave. Con Node 22.23.5 en Windows también pasaron 131 pruebas de `ms-pedidos` y 49 de `ms-afiliados`.

Tras integrar `develop` en la rama del PR #90, el escenario de Compose volvió a terminar con código 0. La cobertura incluyó la petición móvil vigente con solo el código, la campaña futura, la cuenta inactiva, el producto de otra cafetería, el saldo insuficiente, los permisos de cotización y las respuestas RPC malformadas. Con Node 22.23.5 pasaron 133 pruebas de `ms-pedidos` y 49 de `ms-afiliados`. La confirmación y la reversión en PostgreSQL con la RPC definitiva de V08/V15 siguen pendientes.

## Verificación de V10 con la RPC de V08

El 22 de noviembre de 2026 se probó el flujo con Node 22.23.1, PostgREST 16.6
y PostgreSQL 17.12. Se llamaron las rutas HTTP de `ms-afiliados` y
`ms-pedidos` con JWT de prueba. PostgREST ejecutó las RPC de V06 y V08
sobre una base desechable. Se usaron dobles de Auth y del catálogo de
`ms-menus`. La CLI de Supabase no pudo iniciar el stack por un error del
espacio de usuarios de Podman.

Con el adaptador anterior, una cotización de 3.206 CLP con descuento de
361 CLP terminó en HTTP 503 pese a persistir el cobro de 2.845 CLP y una
comisión pendiente de 285 CLP. V08 devolvió `estado: "pendiente"` para
el pedido y `pago_estado: "pagado"` para el pago. El adaptador corregido
devolvió HTTP 201 al repetir la misma clave y recuperó el mismo pedido.
Una nueva compra afiliada devolvió HTTP 201 y persistió los mismos importes.
La compra sin código cobró 3.206 CLP y quedó sin movimiento de comisión.
También se verificaron los HTTP 409 por total actualizado o clave en
conflicto y el HTTP 422 por saldo insuficiente.

La prueba SQL permanente se ejecuta desde `db_CoffeeFaster` con
`npm run test:pago-afiliado`. La regresión HTTP del adaptador está en
[`pedidos.test.js`](../../../Microservices/ms-pedidos/tests/pedidos.test.js).

El 23 de noviembre, tras integrar `develop` en V10, pasaron C07 con su
fixture y las doce suites SQL de `db_CoffeeFaster` en PostgreSQL 17.12.
Un ensayo local de `ms-pedidos` con Auth simulado, PostgREST 12.2.3 y
la RPC real comprobó que los tres rechazos preservan saldo, stock,
pedidos, pagos y movimientos. Repetir un pago confirmado con la misma
clave devolvió el mismo pedido y conservó el débito original.
