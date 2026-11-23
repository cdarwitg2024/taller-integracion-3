# D06 · Confirmar de nuevo cuando cambie el total

| Acción | Resultado comprobado |
|---|---|
| Confirmar $11.000 y recibir HTTP 409 sin cobro | El carrito recotiza y muestra $12.000. |
| Cerrar y volver a montar la app tras el 409 | Se restaura el carrito con la reconfirmación pendiente. Tocar Pagar muestra $12.000 y espera la aceptación sin enviar otro POST. |
| Tocar Pagar | Se abre un diálogo con $12.000. Sigue habiendo un solo POST de pago, rechazado por el servidor. |
| Pulsar Rechazar | Se conserva el carrito y no sale otro POST de pago. |
| Volver a tocar Pagar y pulsar Aceptar y pagar | Se envía el nuevo total de $12.000 con otra clave de idempotencia. |

La regresión también cubre una recotización que falla antes de recuperarse.
El flujo de recuperación D08 exige el mismo diálogo cuando cambia el total.
Las pruebas montan App y la pantalla del carrito con transporte simulado.
El requisito se guarda junto con los productos antes de invalidar el intento
anterior. Se conserva para el mismo carrito y se limpia al vaciarlo o cambiar
de cafetería.

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/PagoCotizado.test.tsx __tests__/CompraRecuperada.test.tsx
```
