# D09 · Mostrar total cobrado en historial

V08 guarda el importe debitado en `pedidos.total` y el subtotal de cada línea
en `detalles_pedido.subtotal`. El historial obtiene el descuento como la
diferencia entre esos importes guardados. Si faltan subtotales históricos,
se omite el descuento. El precio vigente del producto no se consulta.

| Paso en la prueba | Resultado |
|---|---|
| Abrir el comprobante del pedido #52 con débito simulado de $5.100 | Total pagado $5.100 y descuento $900. |
| Cambiar el precio del café de $2.000 a $9.900 y volver a abrir Pedidos | El detalle conserva el total cobrado de $5.100 y el descuento de $900. |
| Recibir una actualización de estado sin los detalles de compra | El descuento histórico sigue visible. |

La prueba monta Pedidos con Supabase simulado. Se puede reproducir desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/PedidosScreen.test.js
```
