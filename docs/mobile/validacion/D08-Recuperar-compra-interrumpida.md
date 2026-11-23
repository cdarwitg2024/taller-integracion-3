# D08 · Recuperar compra con respuesta interrumpida

Base develop `6ed64ca`, con D07 y D04 integradas. La recuperación requiere la
confirmación idempotente de C07 y la sobrecarga de V08 en PostgreSQL.

**Recuperar compra** reenvía la clave y el cuerpo originales con la sesión de
la misma cuenta. Si V08 ya confirmó, devuelve el resultado guardado. Si el
intento no llegó, puede confirmar con el importe que el comprador aceptó.
La acción es manual. Solo un resultado confirmado muestra el comprobante en
Pedidos. El comprobante se publica para la cuenta compradora antes de
limpiar el intento. Si falla esa escritura, el comprobante sigue visible y
se mantiene la protección local. El flujo anterior conserva la revisión manual
porque su RPC no interpreta la clave.

En `ms-pedidos`, V08 recibe la confirmación antes de consultar catálogo,
recupera primero el resultado anterior y valida compras nuevas en SQL.
El adaptador reconoce `pago_estado: pagado` aunque el pedido siga pendiente
de preparación. Esta adaptación coincide con parte del cambio de V10.

## Evidencia reproducible

| Paso | Estado verificado |
|---|---|
| Confirmar $2.500 | El servidor simulado guarda el pedido #501 y deja $7.500 de saldo. Se pierde la respuesta. |
| Pulsar Recuperar compra | Repite exactamente la clave y el cuerpo. El servidor devuelve #501. |
| Abrir el comprobante | Pedidos muestra #501. Quedan un pedido, un débito y el intento local invalidado. |
| Fallar la invalidación local después de recuperar | Pedidos sigue mostrando #501 y el intento queda pendiente. |
| Fallar el diagnóstico del intento después de perder la respuesta | El aviso permite revisar Pedidos y el manejador termina sin propagar la excepción. |
| Recuperar un envío que se perdió y recibir `409 precio_actualizado` con `cobrado: false` | Invalida el intento y muestra $3.000 tras recotizar. Solo un nuevo toque envía ese total con otra clave. |
| Perder la respuesta durante la recuperación o recibir un 409 sin confirmación del cobro | La clave y el cuerpo originales quedan guardados. |
| Recuperar y recibir `422 saldo_insuficiente` con `cobrado: false` | Invalida el rechazo guardado y avisa que se debe recargar la Wallet. Solo otro toque manual envía la compra con una clave nueva. |
| Recibir saldo insuficiente sin confirmación de que no hubo cobro | Conserva el intento y la clave originales. |

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/CompraRecuperada.test.tsx __tests__/RecuperacionIntento.test.tsx
npm test --prefix Microservices/ms-pedidos -- --ci
```

En la revisión de D08 pasaron 323 pruebas móviles, 151 de ms-pedidos y
TypeScript. La validación original de esta rama incluyó C07 en Compose.
La prueba móvil simula el servidor y Compose usa un doble de Supabase.
Queda pendiente probar en dispositivo con V08 aplicada a PostgreSQL.
