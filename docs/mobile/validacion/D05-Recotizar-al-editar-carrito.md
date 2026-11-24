# D05 · Actualizar cotización cuando cambie el carrito

Base develop `0192fe5`, con D03 integrada. Al editar el carrito cambia su
revisión y D03 pide otra cotización. Solo se acepta la respuesta de la
revisión vigente. Si ese carrito ya tuvo cotización, una solicitud fallida
mantiene el pago bloqueado hasta que el comprador vuelva a cotizar con éxito.
Durante la confirmación se bloquean las ediciones del carrito.

| Paso ejecutado en la prueba | Estado resultante |
|---|---|
| Abrir el carrito con una unidad y pulsar dos veces aumentar | Se solicitan dos y tres unidades. El importe previo deja de mostrarse como cotizado. |
| Tocar Pagar con ambas solicitudes pendientes | No se envía ningún pedido. |
| Entregar primero la respuesta de tres unidades ($15.000), luego la de dos ($10.000) | La pantalla conserva $15.000. |
| Confirmar y tratar de aumentar mientras se comprueba el stock | La edición queda bloqueada. Al terminar la comprobación, el POST envía tres unidades y `total_aceptado: 15000`. |
| Cambiar la cantidad y responder 503 a la nueva cotización | La pantalla ofrece reintentar la cotización. Otro toque de pago no envía un pedido. |

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/PagoCotizado.test.tsx
```

Se montan App y los componentes del carrito con Auth, stock y transporte
simulados. Las respuestas diferidas hacen reproducible su orden sin compras
reales ni cambios en Supabase Cloud.
