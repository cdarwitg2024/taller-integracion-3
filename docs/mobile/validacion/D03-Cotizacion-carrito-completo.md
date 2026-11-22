# D03 · Integrar cotización de carrito completo

Base `1fccbd7`, con D02, C07 y D07 integradas.

La pantalla consulta `POST /api/afiliados/cotizaciones` con el JWT del
comprador. Envía cafetería, identificadores y cantidades, con el código solo
si se aplicó. Muestra los tres importes de C07 sin recalcularlos. Quitar el
código vuelve a consultar el importe vigente y la revisión de D02 descarta
respuestas atrasadas al editar o cambiar el carrito.

Al confirmar una cotización sin código, el pedido lleva `total_aceptado` con
el importe mostrado y la cabecera `Idempotency-Key` de D07. C07 revalida ese
total antes del cobro. Ante `409 precio_actualizado`, el carrito se vuelve a
cotizar y espera otra confirmación manual con una clave nueva.
Si la recotización falla, el pago queda bloqueado y se ofrece **Reintentar
cotización**. El bloqueo sigue activo al salir y volver a la pantalla.

El pago con código sigue deshabilitado. Sin cotización válida, la compra sin
código conserva el contrato anterior y el resumen identifica la estimación
local. Una confirmación C07 rechazada por flag apagado no se vuelve a intentar
por el flujo anterior.

## Evidencia

La prueba monta CartScreen y CartProvider reales y simula Auth y el transporte
del gateway. El producto local vale $9.000 para distinguir la estimación de los
importes devueltos por el servidor.

| Paso ejecutado | Subtotal | Descuento | Total |
|---|---:|---:|---:|
| Abrir el carrito con sesión y sin código | $10.000 | $0 | $10.000 |
| Escribir NORTE y pulsar Aplicar | $10.000 | $1.500 | $8.500 |
| Pulsar Quitar después de que el servidor cambia el precio | $11.000 | $0 | $11.000 |

También se comprueba el JWT y el cuerpo de cada POST, que escribir sin
aplicar no consulta el código, que cambiar de cafetería descarta una
respuesta atrasada y que HTTP 422/503 retiran los importes cotizados.

La prueba de pago monta App y CartScreen reales. Tras quitar el código, la
pantalla muestra $11.000 con un precio local de $2.500. Al tocar el botón,
el POST envía el total aceptado de $11.000 con clave y recibe una confirmación
C07. Otro caso simula un 409: muestra $12.000 tras recotizar y solo envía ese
importe cuando el comprador vuelve a confirmar.
La variante `409 → 503` verifica que un nuevo toque no hace otro POST.
Reintentar la cotización recupera $12.000 y solo la confirmación manual
siguiente envía ese monto con una clave nueva.

Validación local con Node 22.19.0: 310 pruebas móviles aprobadas (siete
de D03), dos integraciones optativas omitidas, TypeScript y exportación
Android correctos. No se realizaron compras reales ni pruebas en dispositivo.

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/CotizacionCarrito.test.js __tests__/PagoCotizado.test.tsx
```

Para comprobarlo en Android, apuntar la app a un gateway local con
`HABILITAR_CONFIRMACION_AFILIADA=true` en `ms-afiliados`, V06 disponible,
una sesión de comprador y un código elegible de la misma cafetería. Abrir
el carrito, aplicar el código y quitarlo. Comparar los tres importes con cada
respuesta. El flag viene apagado por defecto y devuelve HTTP 503.
Para ensayar el pago cotizado en un entorno desechable, habilitar el mismo flag
en `ms-pedidos` y usar la RPC de confirmación compatible con C07.
