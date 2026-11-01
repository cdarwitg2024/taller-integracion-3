# S2-T17 - Validar flujo Mobile de disponibilidad y carrito

## Objetivo
Probar de forma integrada las correcciones de disponibilidad, Realtime, detalle de producto, carrito y checkout implementadas en las tareas anteriores.

## Alcance
- Realtime de productos (activación/desactivación/reactivación)
- Cambio de precio
- Sincronización de detalle de producto
- Producto sin disponibilidad / sin stock
- Carrito (persistencia, integridad)
- Bloqueo durante pago
- Revalidación no destructiva antes de pagar
- Respuesta rechazada vs confirmación exitosa
- Franjas de retiro vencidas

## Referencia horaria
Se utiliza `Date()` como referencia horaria explícita (validación de franjas en sesión). No se inventa capacidad backend inexistente.

## Casos de prueba

### 1) Activación y desactivación
- [ ] Desactivar producto desde panel/DB: desaparece del menú sin recargar app (Realtime UPDATE + filtro activo/eliminado)
- [ ] Reactivar producto (pasa de inactivo a activo, sin eliminado_en): vuelve a aparecer en catálogo sin reiniciar app (hook fuerza recarga o agrega sin duplicar)
- [ ] Verificar que no se duplica al reactivar

### 2) Producto sin disponibilidad
- [ ] Producto con stock 0 o inactivo: marcado como no disponible en menú/detalle
- [ ] Intentar agregar al carrito desde UI: respeta estado `available`

### 3) Cambio de precio
- [ ] Actualizar precio por Realtime: se refleja sin recarga completa
- [ ] Verificar que carrito muestra precio al momento de agregar; validación se hace en checkout

### 4) Detalle abierto
- [ ] Abrir detalle mientras producto está activo: sincroniza con cambios (stock/precio/disponibilidad)
- [ ] Si se desactiva mientras detalle abierto: debe reflejar/no permitir agregar

### 5) Carrito
- [ ] Agregar/quitar/cambiar cantidades, persistido en AsyncStorage
- [ ] No mezcla cafeterías (diálogo al intentar mezclar)
- [ ] Carrito intacto si falla validación/rechazo

### 6) Bloqueo durante pago
- [ ] Doble tap en "Proceder al Pago" no genera segundo intento (guard `paying`)
- [ ] Botón deshabilitado mientras procesa

### 7) Revalidación no destructiva antes de pagar
- [ ] Error de consulta a productos: alerta clara, carrito NO se modifica, permite reintentar
- [ ] Producto desactivado/eliminado/cambiado de cafetería: identifica, alerta con detalle, carrito NO se modifica
- [ ] Sin stock suficiente: identifica por producto con stock/solicitado, carrito NO se modifica

### 8) Respuesta rechazada vs confirmación exitosa
- [ ] Saldo insuficiente: muestra total/faltante/saldo, carrito intacto
- [ ] Otro motivo de rechazo: muestra mensaje, carrito intacto
- [ ] Éxito: limpia carrito, muestra datos de pedido/QR

### 9) Franjas vencidas
- [ ] Franja con fin <= hora actual queda deshabilitada
- [ ] Si franja seleccionada vence en sesión, se invalida (limpia selección)
- [ ] Sin franjas disponibles: mensaje y botón deshabilitado
- [ ] Caso cercano al límite probado manualmente

## Evidencia
Registrar: screenshots/logs, producto afectado, estado antes/después, resultado.
