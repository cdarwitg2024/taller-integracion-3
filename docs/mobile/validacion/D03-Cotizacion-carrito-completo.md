# D03 · Integrar cotización de carrito completo

Base `7952432`, con D02 y C07 integradas.

La pantalla consulta `POST /api/afiliados/cotizaciones` con el JWT del
comprador. Envía cafetería, identificadores y cantidades, con el código solo
si se aplicó. Muestra los tres importes de C07 sin recalcularlos. Quitar el
código vuelve a consultar el importe vigente y la revisión de D02 descarta
respuestas atrasadas al editar o cambiar el carrito.

D03 solo consume cotizaciones. El pago con código queda deshabilitado hasta
integrar la confirmación móvil con total aceptado. La compra sin código sigue
disponible. Si C07 no responde con una cotización válida, el resumen identifica
la estimación local y permite quitar el código.

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

Validación local con Node 22.19.0: 270 pruebas móviles aprobadas (cuatro
de D03), dos integraciones optativas omitidas, TypeScript y exportación
Android correctos. No se realizaron compras reales ni pruebas en dispositivo.

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/CotizacionCarrito.test.js
```

Para comprobarlo en Android, apuntar la app a un gateway local con
`HABILITAR_CONFIRMACION_AFILIADA=true` en `ms-afiliados`, V06 disponible,
una sesión de comprador y un código elegible de la misma cafetería. Abrir
el carrito, aplicar el código y quitarlo. Comparar los tres importes con cada
respuesta. El flag viene apagado por defecto y devuelve HTTP 503.
