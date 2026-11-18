# S2-T19 - Incidencias Mobile encontradas en pruebas integradas

> **Evidencia de una revisión anterior.** Las cuentas, resultados y entorno del cuerpo corresponden a esa prueba, no al Cloud actual. Para arquitectura y pendientes ver [estado vigente](../../estado-actual.md). Clasificado el 1 de noviembre de 2026.


Fecha: 2026-10-31
Rama actual: S2-T19-Elias-Corregir-incidencias-Mobile
Base revisada: develop

## 1) Franjas de retiro vencidas
- [x] **CRÍTICO** - CartScreen corregido para validar vencimiento de franjas
- [x] Deshabilitar franjas con fin <= referencia horaria
- [x] Limpiar selección si la franja seleccionada vence
- [x] Validar en checkout con referencia fresca
- [x] Mostrar mensaje si no hay franjas disponibles
- [x] Añadir referencia horaria explícita (Date())
- [x] Agregar util `src/utils/franjas.js` y tests `src/utils/franjas.test.js`
- [x] Actualizar cada segundo para marcar vencidas (`setInterval` 1000 ms)
- [x] Cubierto por tests (12:14:59 / 12:15:00 / 12:15:01)
- [x] Cubierto a nivel de pantalla: franja vencida deshabilitada, selección
      limpiada al vencer con la pantalla abierta, mensaje sin franjas
      disponibles y checkout con referencia fresca (`src/screens/CartScreen.test.js`)

**Estado:** Corregido y probado en rama S2-T19-Elias-Corregir-incidencias-Mobile

## 2) Reactivación de productos vía Realtime
- [x] Hook fuerza recarga al pasar de inactivo/eliminado a activo (S2-T14)
- [x] **RIESGO** - Fallback añadido: si no viene `payload.old` y pasa a activo sin eliminado, se fuerza recarga
- [x] Añadir fallback: si UPDATE pasa a activo sin eliminado y no hay `payload.old` -> forzar recarga
- [x] Se mantiene lógica de recarga + filtrado para evitar duplicados
- [x] Cubierto por tests del hook: suscripción a UPDATE/INSERT/DELETE, UPDATE
      normal, UPDATE sin `payload.old` -> recarga, INSERT -> recarga,
      DELETE -> id eliminado y liberación del canal al desmontar
      (`src/hooks/useDisponibilidadProductos.test.js`)

**Estado:** Corregido y probado

## 3) Revalidación carrito antes de pagar
- [x] Consulta productos por IDs antes de checkout (S2-T15)
- [x] Diferencia error de consulta vs producto no disponible/desactivado/sin stock
- [x] Carrito intacto en errores
- [x] Libera `paying` correctamente
- [x] No modifica validación transaccional del backend
- [x] **Verificado:** si RLS (o un borrado) hace que el producto no venga en el
      resultado, se trata como desactivado y el pago se bloquea; el carrito no
      se modifica. La lógica se extrajo a `src/utils/revalidacionCarrito.ts`
      para poder probarla (`evaluarDisponibilidad` + `mensajeProblemas`).
- [x] Cubierto por tests: producto ausente, de otra cafetería, inactivo,
      eliminado, stock insuficiente, stock justo y carrito vacío
      (`src/utils/revalidacionCarrito.test.ts`)

**Estado:** OK y probado

## 4) Bloqueo durante pago
- [x] Guard `paying` para evitar doble tap
- [x] Botón deshabilitado mientras procesa
- [x] `setPaying(false)` en todos los paths (revalidación con error, problemas
      de disponibilidad, excepción y `finally`)
- [x] Cubierto por tests: botón bloqueado y en carga con `paying`, y una sola
      solicitud por toque (`src/screens/CartScreen.test.js`). El guard de
      reentrada vive en `App.tsx`; no se hizo prueba E2E de doble tap.

**Estado:** OK y probado a nivel de componente; doble tap no E2E.

## Verificación ejecutada
```bash
cd app-mobile
npm ci
npm test -- --runInBand   # 5 suites, 28 tests, todos PASS
npx tsc --noEmit          # 0 errores
```

Suites: `franjas.test.js`, `revalidacionCarrito.test.ts`,
`useDisponibilidadProductos.test.js`, `CartScreen.test.js`, `App.test.tsx`.

### Verificación UI (Expo Go + Supabase local)
- Franjas: a las 12:15:45 la franja `12:00 - 12:15` estaba deshabilitada;
  seleccioné `12:15 - 12:30` y a las 12:30:10 el chip y el pago quedaron
  deshabilitados automáticamente.
- Revalidación: desactivé `Té Verde` en la base y el checkout mostró
  “Hay cambios en la disponibilidad”; el carrito siguió con 3 productos.
- Error de consulta: revoqué `SELECT` a `authenticated` y el checkout mostró
  “No se pudo verificar disponibilidad”; el carrito siguió intacto. El grant
  se restauró.
- Realtime: con el menú abierto, desactivar `Croissant de Almendra` lo sacó de
  la lista (5 -> 4 productos) y reactivarlo lo devolvió (4 -> 5) sin reabrir
  la pantalla.

## Notas
- Solo se documenta, sin push.
- La UI se probó contra Supabase local y emulador Android, no contra el
  Supabase remoto (el host del proyecto no resuelve DNS en este entorno).
- El doble tap del pago no se probó E2E; el guard está en `App.tsx` y el test
  de componente cubre el botón bloqueado/cargando.
