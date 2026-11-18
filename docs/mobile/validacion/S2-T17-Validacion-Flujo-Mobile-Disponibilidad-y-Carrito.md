# S2-T17 - Validar flujo Mobile de disponibilidad y carrito

## Objetivo
Probar de forma integrada las correcciones de disponibilidad, Realtime, detalle
de producto, carrito y checkout implementadas en las tareas anteriores.

## Resultado
8 de 8 criterios cubiertos por pruebas automatizadas que se ejecutan en CI/local
con `npm test`. Dos defectos reales aparecieron al escribir las pruebas y quedaron
corregidos en esta misma rama.

| # | Criterio | Estado | Prueba |
|---|----------|--------|--------|
| 1 | Activación y desactivación | PASS | `src/hooks/useDisponibilidadProductos.test.js`, `src/utils/productos.test.js` |
| 2 | Producto sin disponibilidad | PASS | `src/utils/productos.test.js`, `src/components/ProductCard.test.js` |
| 3 | Cambio de precio | PASS | `src/hooks/useDisponibilidadProductos.test.js`, `src/utils/productos.test.js` |
| 4 | Detalle abierto | PASS | `src/utils/productos.test.js` |
| 5 | Carrito | PASS | `src/context/CartContext.test.js`, `src/screens/CartScreen.test.js` |
| 6 | Bloqueo durante pago | PASS | `src/screens/CartScreen.test.js` |
| 7 | Respuesta rechazada | PASS | `src/utils/resultadoPago.test.ts` |
| 8 | Confirmación exitosa | PASS | `src/utils/resultadoPago.test.ts`, `src/screens/CartScreen.test.js` |

## Cómo se ejecuta
```bash
cd app-mobile
npx tsc --noEmit   # 0 errores
npm test           # 7 suites, 27 tests, todos PASS
```

## Casos cubiertos

### 1) Activación y desactivación
- El hook se suscribe a `UPDATE`, `INSERT` y `DELETE` filtrados por
  `cafeteria_id`, y libera el canal al desmontar (sin suscripciones duplicadas).
- Un `UPDATE` con `activo: false` o `eliminado_en` saca el producto del menú.
- Un producto que no estaba en la lista (reactivado) pide recargar el catálogo,
  así entra una sola vez y sin duplicados.

### 2) Producto sin disponibilidad
- `stock: 0` deja `available: false` en la lista del menú.
- `ProductCard` deshabilita el botón, muestra "No disponible" y no llama a
  `onAdd` aunque se lo presione.

### 3) Cambio de precio
- El `UPDATE` de Realtime transporta `precio` y el menú lo aplica sin recargar
  el catálogo (mismo camino que el stock).
- El total del carrito se recalcula con el precio vigente en cada render.

### 4) Detalle abierto
- El detalle se deriva de la lista viva por `id`, no de una copia del producto.
  Si cambia stock/precio, el detalle abierto muestra el valor nuevo; si el
  producto se desactiva, el detalle se cierra.

### 5) Carrito
- Persistencia en AsyncStorage: recupera el carrito guardado, persiste cambios
  y vaciado, y no pisa lo guardado antes de hidratar.
- Render: ítems, cantidades y total (`2 x 2000 + 3500 = 7500`).
- No mezcla cafeterías: guard por `cartCafeteria` en `App.tsx` (verificado por
  lectura, ver "No ejecutado").

### 6) Bloqueo durante pago
- Sin franja seleccionada el botón está deshabilitado.
- Con `paying` el botón queda deshabilitado y en estado de carga.
- Guard de reentrada `if (paying) return` en `handleCheckout` (`App.tsx`).

### 7) Respuesta rechazada
- `saldo_insuficiente` se clasifica aparte y conserva total, faltante y saldo.
- Otro motivo queda como rechazo simple con su mensaje.
- `ok: true` sin `pedido_id` válido o sin montos **no** confirma el pago.
- Un 2xx sin `pedido` es resultado incierto, no rechazo (carrito intacto).

### 8) Confirmación exitosa
- Una respuesta completa se clasifica como confirmada con `pedido_id`, total y
  saldo restante.
- El checkout envía una sola solicitud con la franja elegida.

## Defectos encontrados y corregidos en esta rama
1. **El precio no viajaba por Realtime.** El hook solo emitía
   `id/stock/activo/eliminadoEn` y el menú solo parcheaba stock. Un cambio de
   precio no se veía hasta recargar. Ahora el payload incluye `precio` y el
   menú lo aplica.
2. **El detalle abierto era un snapshot.** Se guardaba el objeto del producto al
   presionarlo, así que stock/precio quedaban congelados y el overlay seguía
   ofreciendo "Agregar" sobre un producto ya desactivado. Ahora se guarda el
   `id` y el producto se deriva de la lista.

## No ejecutado (y por qué)
- **Realtime contra Supabase real:** el host del proyecto no resuelve DNS desde
  este entorno (`getent hosts yrswjmxdpmiyfpclrfmg.supabase.co` → sin
  resultado), así que no se pudo abrir un canal real ni escribir en la base.
  Los tests disparan los mismos callbacks de `postgres_changes` sobre un
  cliente falso, que es el contrato que consume la app.
- **Emulador:** `adb devices` sin dispositivos conectados; no se corrió la app
  ni se hicieron capturas. No se agregaron flows de Maestro porque el menú no
  carga sin backend.
- **Pago contra backend real:** `POST /api/pedidos` no se invocó. Lo verificado
  es la clasificación de la respuesta y el estado del botón.
- **Mezcla de cafeterías:** el guard existe en `App.tsx` (`addToCart`, aviso
  "Tu carrito es de otra cafetería"), pero vive dentro del componente y no se
  cubrió con prueba.
- **Franjas vencidas:** pertenece a `S2-T16`, que no está en `develop`; no se
  valida en esta rama.

## Evidencia
```
PASS src/utils/resultadoPago.test.ts
  ✓ saldo insuficiente se rechaza con los montos para mostrar
  ✓ otro motivo de rechazo no se confunde con saldo insuficiente
  ✓ una confirmación completa se acepta
  ✓ ok sin pedido_id válido no confirma el pago
  ✓ ok sin los montos no confirma el pago
  ✓ una respuesta sin pedido es resultado incierto, no rechazo
PASS src/utils/productos.test.js
  ✓ desactivar saca el producto del menú
  ✓ eliminado_en también lo saca del menú
  ✓ reactivar un producto que no estaba pide recargar la lista
  ✓ stock 0 lo deja sin disponibilidad
  ✓ un cambio de precio se refleja sin recargar
  ✓ el detalle abierto sigue la lista viva y se cierra si el producto sale
PASS src/hooks/useDisponibilidadProductos.test.js
  ✓ se suscribe a UPDATE, INSERT y DELETE de la cafetería
  ✓ un UPDATE de stock y precio llega al menú
  ✓ un UPDATE que desactiva viaja con activo: false
  ✓ un INSERT pide recargar la lista
  ✓ al desmontar libera el canal
PASS src/context/CartContext.test.js
  ✓ recupera el carrito guardado al abrir la app
  ✓ persiste los cambios del carrito
  ✓ vaciar el carrito también se persiste
PASS src/components/ProductCard.test.js
  ✓ un producto disponible se puede agregar
  ✓ un producto sin disponibilidad no se puede agregar
PASS src/screens/CartScreen.test.js
  ✓ muestra ítems, total y cantidad del carrito
  ✓ sin franja seleccionada el pago está bloqueado
  ✓ con franja elegida, pagar envía una sola solicitud
  ✓ mientras se paga el botón queda bloqueado y en carga

Test Suites: 7 passed, 7 total
Tests:       27 passed, 27 total
```
