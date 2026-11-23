# D11 · Cotizaciones fuera de orden en el carrito

Base `develop` en `cad8bd8`, con D05 y D06 integradas. Se controló el
orden de llegada de las respuestas en pruebas con transporte simulado.
El fallo no se reprodujo. Las protecciones existentes conservaron los
importes de la revisión actual, por lo que la entrega añade regresiones.

| Escenario ejecutado | Resultado |
|---|---|
| Aplicar NORTE y quitarlo antes de recibir la cotización. Resolver primero la solicitud sin código ($12.000) y después la anterior ($8.500). | Pagar mientras se espera la respuesta vigente no envía un pedido. Tras llegar ambas respuestas, la vista conserva $12.000 y el POST envía ese total sin código. |
| Cambiar el producto con una consulta anterior pendiente, en la misma cafetería y en otra. | Conserva los $12.000 de la última cotización. Mantiene el código en la misma cafetería y lo retira al cambiar de cafetería. |
| Aumentar de una unidad a dos y luego a tres. Resolver primero la consulta de tres y después la de dos. | Conserva $15.000 de la última cotización y confirma tres unidades por ese monto. |
| Simular HTTP 409 por cambio de total y recotizar. | El diálogo muestra el nuevo importe. Rechazar conserva el carrito. Aceptar envía el total actualizado con una clave nueva. |

Para reproducir desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/PagoCotizado.test.tsx src/screens/CotizacionCarrito.test.js
```
