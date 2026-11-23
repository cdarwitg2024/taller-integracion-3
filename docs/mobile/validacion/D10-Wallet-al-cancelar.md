# D10 · Actualizar Wallet al cancelar

Pedidos comunica a Wallet el `saldo_nuevo` confirmado de la cuenta tras
cancelar. Wallet usa ese saldo mientras vuelve a consultar el saldo y los
movimientos. Una cancelación rechazada conserva el último saldo confirmado.

| Paso ejecutado | Estado visible |
|---|---|
| Abrir Wallet antes de cancelar el pedido #52 | Saldo $4.900. El pedido registró un cobro de $5.100 con subtotal de $6.000. |
| Confirmar la cancelación y recibir el reembolso de $5.100 | Wallet muestra $10.000 al volver, aunque falle la lectura posterior. |
| Repetir desde el saldo inicial con una cancelación rechazada por HTTP 409 | Wallet sigue mostrando $4.900. |
| Dejar pendiente la consulta al volver a Wallet tras el reembolso y avanzar el reloj tres segundos | Los $10.000 están presentes y tanto el importe como su tarjeta tienen opacidad 1 sin esperar la respuesta. |

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/WalletCancelacion.test.tsx
```

La prueba monta App, Pedidos y Wallet con Supabase y el gateway simulados.
