# D13 · Verificar compra sin código

Base `cad8bd8`, con D06 y D08 integradas.

| Entorno y paso | Esperado | Observado |
|---|---|---|
| Compose: cotizar y confirmar sin código | Precio vigente sin comisión nueva | Pedido #502, $10.000, descuento $0. |
| Compose: usar la cotización sin código en lugar de la afiliada y confirmar con otra clave | Pedido distinto, precio sin descuento y sin comisión nueva | Pedido #503, $10.000, descuento $0. El saldo pasó de $31.500 a $21.500 y no se añadieron comisiones. |
| Móvil: abrir el carrito sin aplicar un código, pagar y abrir Pedidos | Enviar el total vigente sin código y recuperar el pedido | El POST confirmó $11.000 sin código. Se abrió D13-501 con total $11.000 y descuento $0. |
| Móvil: aplicar NORTE, quitarlo, pagar y abrir Pedidos | Reemplazar los $8.500 de la cotización afiliada y recuperar el pedido sin descuento | El POST confirmó $11.000 sin código. Se abrió D13-502 con total $11.000 y descuento $0. |

Compose usa el gateway real y un doble de Supabase. La prueba móvil monta
App, Carrito y Pedidos con respuestas simuladas. Los IDs de ambos entornos
son independientes y corresponden a pedidos de prueba.

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/PagoCotizado.test.tsx
docker compose -p coffeefast-d13 -f Microservices/compose.c07.yml up --build --abort-on-container-exit --exit-code-from prueba
docker compose -p coffeefast-d13 -f Microservices/compose.c07.yml down
```

Validación local: 328 pruebas móviles, TypeScript y Compose C07/D13.
