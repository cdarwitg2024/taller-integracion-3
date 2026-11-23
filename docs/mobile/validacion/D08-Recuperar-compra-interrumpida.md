# D08 · Recuperar compra con respuesta interrumpida

Base develop `af80803`, con D07 y D04 integradas. La recuperación requiere la
confirmación idempotente de C07 y la sobrecarga de V08 en PostgreSQL.

**Recuperar compra** reenvía la clave y el cuerpo originales con la sesión de
la misma cuenta. Si V08 ya confirmó, devuelve el resultado guardado. Si el
intento no llegó, puede confirmar con el importe que el comprador aceptó.
La acción es manual. Solo un resultado confirmado muestra el comprobante en
Pedidos y cierra el intento. El flujo anterior conserva la revisión manual
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

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/CompraRecuperada.test.tsx __tests__/RecuperacionIntento.test.tsx
npm test --prefix Microservices/ms-pedidos -- --ci
```

Pasaron 316 pruebas móviles, 150 de ms-pedidos, TypeScript y el escenario
C07 de Compose. La prueba móvil simula el servidor, y Compose usa un doble
de Supabase. No hubo compras reales ni despliegues.
