# S2-T18 — Validación integrada del panel administrativo

**Rama:** `S2-T18-DiegoC-Validar_flujo_administrativo_e_indicadores`
**Base:** `develop` (`17883ab`)
**Estado de integración:** rama fusionada en `develop` por fast-forward y publicada
(`develop` = `origin/develop` = `17883ab`).
**Fecha:** 2026-10-31
**Alcance:** productos, Dashboard, Wallet y solicitudes de reposición.

---

## 1. Entorno y método

| Elemento | Valor |
|---|---|
| App validada | `app-desktop` (React + Vite) |
| Supabase | Instancia local del desarrollador (`127.0.0.1`) |
| Roles reales en la base | `1 = estudiante`, `2 = empleado`, `3 = dueño` |
| Verificación | Prueba manual en la app corriendo + revisión de código + consultas a Supabase + `npm run build` |
| Verificación manual | Checklist de la sección 5 |

La validación no crea ni modifica datos del usuario. Los resultados marcados
como **validados en vivo** los comprobó el usuario en la aplicación; los
marcados como **no comprobados** se indican con su causa.

---

## 2. Estado de los datos al momento de validar

| Dato | Resultado |
|---|---|
| `productos` | 40 registros: **37 activos y 3 inactivos** |
| Productos inactivos | `Hola` (stock 2), `Introducir producto negativo` (stock 0), `2` (stock 0) |
| `categorias` | 8 registros |
| `cafeterias` | 3 registros |
| `pedidos` | **7 registros** (permite validar indicadores con ventas) |
| `wallets` | **4 registros** |
| `movimientos_wallet` | **28 registros** (permite validar recargas y reconciliación) |
| `solicitudes_stock` | Tabla **creada**, 3 políticas RLS, **0 registros** |
| Usuarios con rol `empleado` | **0** |

Consecuencia: productos activo/inactivo, reactivación, indicadores con ventas y
Wallet **sí se pudieron validar en vivo**. Lo único que quedó sin comprobar es
**solicitudes de reposición**, porque no existe ningún usuario con rol
`empleado` para iniciar sesión con ese perfil.

---

## 3. Resultado por criterio de aceptación

| Criterio | Resultado | Evidencia / observación |
|---|---|---|
| Producto activo e inactivo | ✅ **Validado en vivo** | La base tiene 3 productos inactivos; la tabla los muestra con chip `INACTIVO` y el filtro "Inactivos / Ocultos" los lista. |
| Reactivación | ✅ **Validado en vivo** | El switch **Disponible para la Venta** del diálogo de edición reactiva el producto y persiste `activo: true`. |
| Unidad | ✅ **Validado en vivo** | `unidad` se crea/edita y se muestra junto al stock (`un` y `kg` en la base). |
| Categoría | ✅ **Validado en vivo** | `categoria_id` se crea/edita; se muestra el nombre y se puede filtrar. 8 categorías disponibles. |
| Stock | ✅ **Validado en vivo** | Validación entera, no negativa y no vacía en creación/edición; `ModificarStockDialog` valida lo mismo. |
| Indicadores sin ventas | ✅ Corregido y validado | `getEstadisticas` devuelve ceros y las tarjetas muestran "Sin ventas registradas hoy". Antes el Dashboard fallaba (ver I-01). |
| Indicadores con ventas | ✅ **Validado en vivo** | Con 7 pedidos, el Dashboard suma ventas, pedidos y tiempos, y actualiza los gráficos y "Últimos Pedidos". Criterio único `esPedidoDeVentas` y periodo "hoy". |
| Wallet | ✅ **Validado en vivo** | La recarga aparece una sola vez y el saldo termina en el valor confirmado por la base (4 wallets, 28 movimientos). |
| Acceso a solicitudes | ❌ **No se pudo comprobar** | La tabla ya existe y las políticas RLS están verificadas, pero **no se pudo iniciar sesión como Empleado**: la base local no tiene usuarios con rol `empleado`, así que no se pudo generar una solicitud desde la app. |
| Empleado sin operaciones de Dueño | ⚠️ **Validado por código; no en vivo** | Rutas `/dueno/*` protegidas con `requiredRole="dueño"`; el menú del empleado solo tiene Comandas y Stock; en Stock el diálogo usa `modoSolicitud` y nunca llama `updateStock`. La prueba en vivo quedó bloqueada por la ausencia de usuario `empleado`. |
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
  `develop` (idempotente) y se ejecutó en la base local: tabla creada con sus
  3 políticas RLS.
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

### I-05 (Bloqueante para la prueba) — No hay usuario Empleado en la base local

- **Síntoma:** no se pudo comprobar el flujo de solicitudes de reposición ni el
  bloqueo de operaciones de Dueño para un Empleado.
- **Causa:** la tabla `usuarios` no tiene **ningún** registro con rol
  `empleado` (`rol_id = 2`), por lo que no es posible iniciar sesión con ese
  perfil en la app.
- **Impacto:** la funcionalidad está implementada y la tabla/RLS están
  verificadas, pero **la comprobación funcional de solicitudes queda pendiente**.
- **Acción:** crear un usuario con rol `empleado` (y asignarle cafetería) para
  ejecutar los pasos 5.4 y 5.5 del checklist.

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

### 5.1 Productos — activo/inactivo, reactivación, unidad, categoría, stock ✅ VALIDADO

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

### 5.2 Dashboard — indicadores con y sin ventas ✅ VALIDADO

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

### 5.3 Wallet ✅ VALIDADO

1. En la app móvil, iniciar sesión con un usuario con wallet.
2. Recargar saldo y observar el movimiento.
   - Esperado: aparece **una sola vez** (sin duplicado temporal + real) y el
     saldo se anima hasta el valor confirmado por la base.
3. Simular respuesta lenta o pérdida de red durante la recarga.
   - Esperado: se informa el resultado incierto y la reconciliación evita
     duplicados al refrescar.
4. Verificar que el saldo no se actualiza con un `UPDATE` directo del cliente.

### 5.4 Solicitudes de reposición ❌ NO COMPROBADO — bloqueado por falta de usuario Empleado

1. Crear un usuario con rol `empleado` y asignarle cafetería.
2. Como **Empleado** → **Stock** → **Encargar más stock** sobre un producto.
   - Esperado: mensaje de solicitud registrada.
3. Como **Dueño** → **Solicitudes de Reposición**.
   - Esperado: se ven producto, cantidad, fecha y estado `Pendiente`, solo de la
     cafetería autorizada.
4. Probar los estados de carga, vacío (otra cafetería sin solicitudes) y error
   (detener Supabase).
5. Confirmar que la vista **no** tiene acciones para aprobar/rechazar ni modifica
   inventario.

> Estado actual: la tabla existe y sus 3 políticas RLS están verificadas por SQL,
> pero **no se pudo generar ni visualizar una solicitud desde la app** porque no
> hay usuario `empleado` en la base local.

### 5.5 Empleado no ejecuta operaciones de Dueño ❌ NO COMPROBADO — misma causa

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
productos              -> 40 filas: 37 activas, 3 inactivas (ids 52, 56, 57)
pedidos                -> 7 filas
wallets                -> 4 filas
movimientos_wallet     -> 28 filas
solicitudes_stock      -> tabla creada, 3 políticas RLS, 0 filas
usuarios rol empleado  -> 0 (no se puede iniciar sesión como Empleado)
roles                  -> 1 estudiante, 2 empleado, 3 dueño
npm run build (app-desktop) -> OK (vite, 2089 módulos)
```

---

## 7. Conclusión

- Se corrigieron **dos regresiones reales** del panel administrativo
  (Dashboard y contador del sidebar), ambas provocadas por el cambio de
  contrato de `pedidosService.getAll` en S2-T12.
- Se distribuyó el script faltante de `solicitudes_stock`, se adaptó a los roles
  reales de la base y se ejecutó en la base local (tabla + 3 políticas RLS).
- **Validado en vivo:** productos activo/inactivo (3 inactivos), reactivación,
  unidad, categoría, stock, indicadores sin ventas, indicadores con ventas
  (7 pedidos) y Wallet (4 wallets, 28 movimientos).
- **No comprobado:** solicitudes de reposición y bloqueo de operaciones de Dueño
  para Empleado, porque la base local **no tiene usuarios con rol `empleado`**.
  Queda pendiente crear ese usuario y ejecutar los pasos 5.4 y 5.5.
