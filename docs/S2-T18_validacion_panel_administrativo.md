# S2-T18 — Validación integrada del panel administrativo

**Rama:** `S2-T18-DiegoC-Validar_flujo_administrativo_e_indicadores`
**Base:** `develop` (`9892a78`)
**Fecha:** 2026-10-31
**Alcance:** productos, Dashboard, Wallet y solicitudes de reposición.

---

## 1. Entorno y método

| Elemento | Valor |
|---|---|
| App validada | `app-desktop` (React + Vite) |
| Supabase | Instancia local del desarrollador (`127.0.0.1`) |
| Roles reales en la base | `1 = estudiante`, `2 = empleado`, `3 = dueño` |
| Verificación | Revisión de código + consultas REST a Supabase + `npm run build` |
| Verificación manual | Checklist de la sección 5 (la ejecuta el usuario en la app corriendo) |

La validación automática no crea ni modifica datos del usuario. Las pruebas que
requieren ventas, productos inactivos o movimientos de wallet se dejan indicadas
como pasos manuales.

---

## 2. Estado de los datos al momento de validar

| Dato | Resultado |
|---|---|
| `productos` | 37 registros, **0 inactivos**, 36 con unidad `un`, 1 con `kg` |
| Productos con stock 0 | 3 (`Sándwich de Mermelada`, `w`, `DIEGOO`) |
| `categorias` | 8 registros |
| `cafeterias` | 3 registros |
| `pedidos` | **0 registros** |
| `wallets` | **0 registros** |
| `movimientos_wallet` | **0 registros** |
| `solicitudes_stock` | **No existe** (`PGRST205`, HTTP 404) |

Consecuencia: los indicadores se pueden validar en el escenario **sin ventas**
(ceros), pero el escenario **con ventas**, la **reactivación** y la **wallet**
requieren generar datos manualmente.

---

## 3. Resultado por criterio de aceptación

| Criterio | Resultado | Evidencia / observación |
|---|---|---|
| Producto activo e inactivo | ✅ Código validado; ⏳ prueba manual | `Productos.jsx` filtra por `activo`, muestra chip `INACTIVO` y filtro "Inactivos / Ocultos". La base no tiene productos inactivos para probar en vivo. |
| Reactivación | ✅ Código validado; ⏳ prueba manual | El diálogo de edición expone el switch `activo` y `productosService.update` persiste `activo: true`. No hay producto inactivo para reactivar en la base actual. |
| Unidad | ✅ Código validado; ✅ dato real | `unidad` se crea/edita y se muestra junto al stock. Hay 1 producto con `kg`. |
| Categoría | ✅ Código validado; ✅ dato real | `categoria_id` se crea/edita; se muestra el nombre y se puede filtrar. 8 categorías disponibles. |
| Stock | ✅ Código validado; ✅ dato real | Validación entera, no negativa y no vacía en creación/edición; `ModificarStockDialog` valida lo mismo. Hay 3 productos en 0. |
| Indicadores sin ventas | ✅ Corregido y validado | Con 0 pedidos, `getEstadisticas` devuelve ventas 0, pedidos 0 y tiempo 0; las tarjetas muestran "Sin ventas registradas hoy". Antes el Dashboard fallaba (ver I-01). |
| Indicadores con ventas | ✅ Código validado; ⏳ prueba manual | Criterio único `esPedidoDeVentas` (excluye `cancelado`, incluye `entregado/listo/preparando/en_preparacion`) y periodo "hoy". Requiere generar un pedido. |
| Acceso a solicitudes | ⚠️ Bloqueado por base; ✅ corregido en repo | La tabla no existía en la base local. Se agregó el script de creación a `develop` (I-03) y se corrigieron los roles del script (I-04). Falta ejecutarlo. |
| Empleado sin operaciones de Dueño | ✅ Validado | Rutas `/dueno/*` protegidas con `requiredRole="dueño"`; el menú del empleado solo tiene Comandas y Stock; en Stock el diálogo se usa en `modoSolicitud` y nunca llama `updateStock`; crear/editar/eliminar producto solo existe en páginas de Dueño. |
| Documentar incidencias | ✅ | Sección 4. |

---

## 4. Incidencias encontradas

### I-01 (Alta) — Dashboard siempre en estado de error

- **Síntoma:** el Dashboard mostraba "Sin conexión con la base de datos Supabase"
  aunque la base respondiera.
- **Causa:** S2-T12 cambió `pedidosService.getAll` para **exigir** `cafeteriaId`
  (sin fallback fijo), pero `Dashboard.jsx` seguía llamando `getAll()` sin
  argumentos. El servicio lanzaba antes de consultar:
  `No se pudo determinar la cafetería autorizada del empleado.`
- **Corrección:** `Dashboard` recibe `currentUser` (ya se lo pasaba `app.jsx`),
  deriva `cafeteria_id` y llama `getAll({ cafeteriaId })`. Si no hay cafetería,
  muestra un error explícito en vez de un fallo silencioso. El efecto de Realtime
  ahora depende de `cafeteriaId`.
- **Archivo:** `app-desktop/src/pages/dueno/Dashboard.jsx`.

### I-02 (Media) — Contador de pedidos del sidebar siempre en 0

- **Síntoma:** el badge de pedidos activos no reflejaba pedidos pendientes/en
  preparación.
- **Causa:** misma regresión de I-01 en `sidebar.jsx` (`getAll()` sin cafetería);
  el error se ignoraba en silencio y el contador quedaba en 0.
- **Corrección:** el sidebar usa `currentUser.cafeteria_id`, consulta
  `getAll({ cafeteriaId })` y no programa el intervalo si no hay cafetería.
- **Archivo:** `app-desktop/src/components/sidebar.jsx`.

### I-03 (Bloqueante) — Falta `solicitudes_stock` en la base local

- **Síntoma:** la vista de solicitudes mostraba error; PostgREST devolvía
  `PGRST205: Could not find the table 'public.solicitudes_stock'`.
- **Causa:** el script `crear_solicitudes_stock.sql` se creó el 5 de octubre,
  pero quedó **solo** en la rama `origin/S1-T16-Camilodg-Kd8-f` y nunca se
  integró a `develop`. Cada desarrollador tiene su propia base local, así que
  quien no ejecutó ese script no tiene la tabla.
- **Corrección:** se agregó `database/fixes/crear_solicitudes_stock.sql` a
  `develop` (idempotente). **Acción pendiente del desarrollador:** ejecutarlo en
  Supabase → SQL Editor de su base local.
- **Archivo:** `database/fixes/crear_solicitudes_stock.sql`.

### I-04 (Alta) — El script original asumía ids de rol incorrectos

- **Síntoma potencial:** incluso creando la tabla, las políticas RLS habrían
  denegado todo acceso.
- **Causa:** el script original filtraba `u.rol_id IN (4, 6)` (empleado/dueño).
  En esta base los ids reales son `1 = estudiante`, `2 = empleado`, `3 = dueño`.
- **Corrección:** las políticas resuelven el rol por **nombre** con
  `JOIN public.roles r ON r.id = u.rol_id` y `r.nombre IN ('empleado','dueño')`.
  Así el script funciona en cualquier seed. El `UPDATE` queda restringido al
  Dueño, para que un empleado no pueda aprobarse su propia solicitud.

### I-05 (Informativa) — Faltan datos para las pruebas "con ventas"/wallet

- No hay pedidos, wallets ni movimientos en la base local, y no hay productos
  inactivos. No es un defecto de código: son precondiciones de datos.
- **Acción:** seguir los pasos manuales de la sección 5 para generar esos datos.

### I-06 (Observación, no bloqueante) — Productos no se filtra por cafetería del Dueño

- `Productos.jsx` llama `productosService.getAll()` sin `cafeteriaId`, por lo que
  el catálogo muestra productos de las 3 cafeterías. No afecta los criterios de
  S2-T18, pero es inconsistente con el alcance por cafetería que ya usan
  Dashboard, Comandas y Stock.
- **Recomendación:** evaluar en una tarea aparte si el Dueño debe ver solo su
  cafetería o todo el catálogo (comportamiento actual).

### I-07 (Limitación conocida) — RLS de solicitudes valida rol, no cafetería

- La política `SELECT` de `solicitudes_stock` permite leer a empleados/dueños de
  cualquier cafetería; el filtro por cafetería autorizada se aplica en la
  consulta del cliente (`listarPorCafeteria` usa `.eq('cafeteria_id', ...)`).
- Se mantuvo así porque `cafeteria_usuarios` puede estar vacía en las bases
  locales y denegaría toda lectura. No afecta escrituras: el `UPDATE` es solo
  del Dueño y el `INSERT` nace en `pendiente`.

---

## 5. Checklist de validación manual (app corriendo)

### 5.1 Productos — activo/inactivo, reactivación, unidad, categoría, stock

1. Entrar como **Dueño** → **Productos y Stock**.
2. Crear un producto de prueba con categoría, unidad `kg`, stock `5` y mínimo `2`.
   - Esperado: aparece en la tabla con categoría, `5 kg` y estado `ÓPTIMO`.
3. Editar el producto y desactivar el switch **Disponible para la Venta**.
   - Esperado: chip `INACTIVO` y el producto aparece al filtrar **Inactivos**.
4. Volver a editarlo y activar el switch; guardar.
   - Esperado: vuelve a `ÓPTIMO`/`SIN STOCK`/`STOCK BAJO` según su stock.
5. Probar stock inválido: `-1`, `1.5` o vacío.
   - Esperado: mensaje de validación y no se guarda.
6. Probar cambio de unidad y categoría; guardar y recargar.
   - Esperado: se conservan ambos valores.
7. Abrir **Modificar Stock**, ajustar stock/mínimo y guardar.
   - Esperado: la tabla y los KPI de stock se actualizan.

### 5.2 Dashboard — indicadores con y sin ventas

1. Entrar a **Dashboard** sin pedidos del día.
   - Esperado: **Ventas del Día $0**, **Total Pedidos 0**, **Pendientes 0**,
     **Tiempo 0 min**; gráficos en cero y "Sin ventas registradas hoy".
   - Ya no debe aparecer la alerta de conexión (I-01).
2. Crear un pedido desde la app móvil para la cafetería del Dueño y avanzarlo a
   `listo` o `entregado`.
   - Esperado: el Dashboard se actualiza por Realtime; ventas suma el total y
     aparece en "Productos Más Populares" y "Últimos Pedidos".
3. Cancelar un pedido y confirmar que **no** suma a ventas.
4. Verificar que pedidos de otra cafetería no aparecen.

### 5.3 Wallet

1. En la app móvil, iniciar sesión con un usuario con wallet.
2. Recargar saldo y observar el movimiento.
   - Esperado: aparece **una sola vez** (sin duplicado temporal + real) y el
     saldo se anima hasta el valor confirmado por la base.
3. Simular respuesta lenta o pérdida de red durante la recarga.
   - Esperado: se informa el resultado incierto y la reconciliación evita
     duplicados al refrescar.
4. Verificar que el saldo no se actualiza con un `UPDATE` directo del cliente.

### 5.4 Solicitudes de reposición

1. Ejecutar `database/fixes/crear_solicitudes_stock.sql` en el SQL Editor.
2. Como **Empleado** → **Stock** → **Encargar más stock** sobre un producto.
   - Esperado: mensaje de solicitud registrada.
3. Como **Dueño** → **Solicitudes de Reposición**.
   - Esperado: se ven producto, cantidad, fecha y estado `Pendiente`, solo de la
     cafetería autorizada.
4. Probar los estados de carga, vacío (otra cafetería sin solicitudes) y error
   (detener Supabase).
5. Confirmar que la vista **no** tiene acciones para aprobar/rechazar ni modifica
   inventario.

### 5.5 Empleado no ejecuta operaciones de Dueño

1. Con sesión de **Empleado**, abrir directamente `#/dueno/productos` o
   `#/dueno/dashboard`.
   - Esperado: redirección a `/empleado/comandas` (o acceso denegado).
2. Verificar que el menú del empleado solo muestra **Comandas** y **Stock**.
3. En **Stock**, abrir "Encargar más stock" y confirmar que solo registra una
   solicitud; el stock del producto no cambia.
4. Confirmar que el empleado no ve precios ni botones de crear/editar/eliminar.

---

## 6. Evidencia técnica

```text
GET /rest/v1/productos?select=...        -> HTTP 200, 37 filas, 0 inactivas
GET /rest/v1/pedidos?select=...          -> HTTP 200, []
GET /rest/v1/wallets?select=...          -> HTTP 200, []
GET /rest/v1/movimientos_wallet?select=  -> HTTP 200, []
GET /rest/v1/solicitudes_stock?select=id -> HTTP 404 PGRST205 (tabla ausente)
GET /rest/v1/roles?select=*              -> 1 estudiante, 2 empleado, 3 dueño
npm run build (app-desktop)              -> OK (vite, 2089 módulos)
```

---

## 7. Conclusión

- Se corrigieron **dos regresiones reales** del panel administrativo
  (Dashboard y contador del sidebar), ambas provocadas por el cambio de
  contrato de `pedidosService.getAll` en S2-T12.
- Se distribuyó el script faltante de `solicitudes_stock` y se adaptó a los
  roles reales de la base, desbloqueando la validación de solicitudes.
- Los criterios de productos, indicadores sin ventas y permisos de empleado
  quedan cubiertos por código y datos; las pruebas con ventas, reactivación y
  wallet requieren los pasos manuales de la sección 5.
