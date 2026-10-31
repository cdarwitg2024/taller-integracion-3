# S2-T15 - Validación flujo integrado y recuperación del KDS

**Responsable:** Ariel Díaz  
**Rama:** `S2-T15-Ariel-Díaz-Validar-Flujo-Integrado-Recuperación-KDS`  
**Fecha:** 2026-10-31  

## 1. Objetivo

Validar el flujo integrado del KDS tras las correcciones S2-T7 a S2-T14: autenticación con Supabase, unificación de alcance por cafetería, carga/polling/Realtime, búsqueda local, transiciones de estado con bloqueo por pedido, indicador de retiro próximo, manejo de errores/recuperación y respeto a rechazos del backend sin escritura alternativa.

## 2. Archivos y funciones principales involucrados

| Archivo | Función / Componente | Rol |
|---|---|---|
| `src/pages/auth/Login.jsx` | Login KDS/empleado | Autenticación con Supabase Auth (email/password). |
| `src/service/usuarios.js` | `login()`, `getPerfilSesion()`, `fetchPerfilYCafeteria()` | Obtiene perfil, rol y `cafeteria_id` desde `usuarios` + `roles`. Al refrescar sesión se incluye `cafeteria_id`. |
| `src/service/supabase.js` | Cliente Supabase | Configura cliente con `VITE_SUPABASE_URL` y clave anon/publicable. |
| `src/pages/empleado/Comandas.jsx` | Componente principal KDS | Orquesta carga, polling, Realtime, filtrado por búsqueda, bloqueo por pedido (`procesando`), recuperación ante errores. |
| `src/services/pedidosService.js` | `getAll()`, `updateEstado()`, `getById()`, `ordenarPedidos()` | Carga filtrada por `cafeteria_id` (estricto), validación de transiciones, cambio de estado vía backend con fallback controlado. |
| `src/services/backendApi.js` | `cambiarEstadoPedido()`, `validarQr()`, `request()` | Cliente HTTP centralizado. Obtiene `access_token` desde `supabase.auth.getSession()`, añade `Authorization: Bearer <token>`. Exige sesión válida y trata 401 como error de autenticación. |
| `src/services/kdsRealtime.js` | `suscribir()` | Suscripción a `postgres_changes` filtrando por `cafeteria_id` del empleado, canal por cafetería. Ignora pedidos ajenos. |
| `src/services/vozKdsService.js` | Voz KDS | Avisos de voz (integrado). |
| `src/components/KdsTopBar.jsx` | Barra superior | Conexión, voz, escaneo QR y **búsqueda local** por código/ID. |
| `src/components/PedidoCard.jsx` | Tarjeta de comanda | Botón con bloqueo por pedido (`procesando`), indicador "RETIRAR EN X MIN" para pedidos `listo` próximos. |
| `src/components/KanbanColumn.jsx` | Columnas Kanban | Render por estado. |
| `src/utils/dateUtils.js` | `minutosHastaRetiro()`, `origenRetiroPedido()` | Cálculo para indicador de retiro próximo. |

## 3. Recorrido completo de una operación del KDS

### Flujo: Login → KDS → carga

1. **Login** (`Login.jsx`): Usuario ingresa credenciales. Se autentica con `supabase.auth.signInWithPassword()`.
2. **Perfil** (`usuarios.login()`): Obtiene perfil desde `usuarios` con `roles`, busca cafetería asignada (`cafeteria_usuarios` o relación) y construye `usuarioFinal` con `cafeteria_id`, `rol`, etc.
3. **Sesión persistida**: `supabase.auth.getSession()` mantiene sesión JWT. Al refrescar página, `usuarios.getPerfilSesion()` revalida y **ahora incluye `cafeteria_id`** (fix S2-T9).
4. **Navegación**: Redirige a `/empleado/comandas` (KDS).
5. **Carga inicial** (`Comandas.jsx`): `fetchPedidos()` llama `pedidosService.getAll({ cafeteriaId: cafeteriaIdEmpleado })`. `pedidosService` exige `cafeteriaId` numérico y filtra `eq('cafeteria_id', cid)`. Se ordena con `ordenarPedidos()`.
6. **Realtime**: Se suscribe con `cafeteriaIdEmpleado`. Solo recibe INSERT/UPDATE de esa cafetería. Ignora ajenos.
7. **Polling respaldo**: Cada 10s vuelve a llamar `getAll` con mismo `cafeteriaId`. Si falla, **no borra** comandas ya visibles.

### Flujo: Búsqueda

1. Usuario escribe en buscador (`KdsTopBar`).
2. `Comandas.jsx` filtra **localmente** sobre `pedidosOrdenados` por `codigo_pedido` o `id/rawId` (`toLowerCase().includes()`).
3. Al borrar, restaura lista completa. **Sin peticiones al backend**.

### Flujo: Transición de estado (pendiente → en_preparacion → listo)

1. Click en botón de acción (`PedidoCard`).
2. `Comandas.jsx.handleCambiarEstado(id, nuevoEstado, e)`:
   - Verifica `procesando.has(key)`. Si ya está en proceso, **ignora** (evita doble clic).
   - Añade ID a `Set procesando`, deshabilita botón y muestra `PROCESANDO...`.
   - Llama `pedidosService.updateEstado(id, nuevoEstado)`.
3. `pedidosService.updateEstado()`:
   - Valida transición con `esTransicionValida()`.
   - **Intenta primero vía backend**: `backendApi.cambiarEstadoPedido(id, nuevoEstado)`. Éste obtiene JWT con `supabase.auth.getSession()` y envía `Authorization: Bearer <token>`.
   - Si backend responde OK, refresca con `getById()` y retorna pedido actualizado.
   - **Si backend rechaza con 401/403/409 o error UNAUTHORIZED**: **NO hace fallback a Supabase**. Propaga el error.
   - Solo si es error "no disponible" ajeno a rechazo, intenta fallback a UPDATE directo en Supabase.
4. Al éxito: `actualizarPedidoRealTime()` actualiza estado/orden. Al error: se libera del `Set procesando` en `finally`, botón vuelve a habilitarse, se muestra feedback con `setErrorComandas()`. **Otras comandas siguen operativas**.
5. Realtime/polling sincronizan estado.

## 4. Pruebas realizadas

### 4.1 Login → KDS → carga
- [x] Login con `cocina.central@cafeteria.com` / `cocina2026` lleva a `/empleado/comandas`.
- [x] Carga inicial muestra columnas con pedidos de **única cafetería** del empleado.
- [x] Al refrescar página (`F5`) **no** aparece error "Este empleado no tiene cafetería asociada" (corregido en `getPerfilSesion`).
- [x] Loading finaliza correctamente.

### 4.2 Alcance de cafetería
- [x] `pedidosService.getAll` exige `cafeteriaId` válido y filtra por él. Sin fallback a cafetería fija.
- [x] `kdsRealtime` requiere `cafeteriaId`, filtra INSERT/UPDATE por `cafeteria_id`, ignora pedidos ajenos.
- [x] Si no hay `cafeteria_id`, no se suscribe a Realtime y se muestra error claro.
- [x] Pedido creado con `cafeteria_id` distinto **no aparece** en KDS. Pedido con misma cafetería **sí aparece/actualiza** por Realtime.

### 4.3 Búsqueda
- [x] Búsqueda funciona mientras se escribe (filtrado local).
- [x] Encuentra por `codigo_pedido` (parcial).
- [x] Encuentra por `id/rawId`.
- [x] Limpiar buscador restaura lista completa.
- [x] Sigue funcionando tras actualizaciones Realtime/polling.
- [x] **No realiza consultas globales** fuera del conjunto ya autorizado.

### 4.4 Transiciones y bloqueo por pedido
- [x] Botón se deshabilita y muestra `PROCESANDO...` al pulsar.
- [x] Doble clic rápido **solo envía 1 petición** (verificado en Network).
- [x] Otras comandas **permanecen operativas** mientras una está en proceso.
- [x] Se libera en **éxito o error** (`finally`).
- [x] Indicador "RETIRAR EN X MIN" aparece solo para pedidos `listo` próximos, se actualiza cada 60s.

### 4.5 Sesión inválida / JWT
- [x] `backendApi` obtiene token de sesión Supabase. Si no hay sesión, lanza error claro.
- [x] Peticiones protegidas envían `Authorization: Bearer <access_token>`.
- [x] 401 se trata como error de autenticación, **no como éxito**.
- [x] Sin credenciales hardcodeadas.

### 4.6 Rechazos backend sin escritura alternativa
- [x] 401/403/409 → **NO** hace fallback a Supabase directo.
- [x] Error de red/no disponible ajeno a rechazo **puede** usar fallback con precaución, pero rechazos del backend se respetan.
- [x] Interfaz conserva **último estado confirmado**.
- [x] Usuario recibe feedback del rechazo (alerta/console).
- [x] Camino válido identificado: `backendApi.cambiarEstadoPedido()` → `PATCH /api/pedidos/:id/estado` con JWT.

### 4.7 Recuperación ante interrupción temporal
- [x] Con Network en `Offline` y comandas ya visibles: **no desaparecen** las tarjetas.
- [x] Polling falla sin limpiar estado; aparece alerta `warning` con botón `Reintentar` si aplica.
- [x] Carga inicial con fallo: spinner se quita, muestra error con opción a reintentar (diferenciado de "sin pedidos").
- [x] Al volver online, con `Reintentar` o siguiente poll se recupera sin refrescar página.
- [x] Promesas rechazadas manejadas con `catch`.

## 5. Conclusión

El flujo integrado del KDS funciona correctamente: autenticación → carga filtrada por cafetería → Realtime/polling → búsqueda local → transiciones con bloqueo individual → recuperación ante errores → **respeto estricto a rechazos del backend** sin escritura alternativa. El alcance, el JWT y la autoridad del backend quedan unificados. 
