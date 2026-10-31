# S2-T17 - Validación flujo completo del KDS

**Responsable:** Ariel Díaz  
**Rama:** `S2-T17-Ariel-Díaz-Probar-Flujo-Completo-KDS`  
**Fecha:** 2026-10-31  

## 1. Objetivo

Realizar una prueba integrada y end-to-end del flujo del KDS (Kitchen Display System) después de implementar todas las correcciones S2-T1 a S2-T16. Este test cubre todo el ciclo de vida de un pedido desde el login hasta la entrega, incluyendo estados, transiciones, indicadores visuales, búsqueda, manejo de errores y recuperación.

## 2. Precondiciones

- Servidor Supabase corriendo con base de datos poblada (pedidos, usuarios, cafeterías).
- Aplicación frontend (`app-desktop`) corriendo en `http://localhost:5173/`.
- Cuenta de test: `cocina.central@cafeteria.com` / `cocina2026`.

## 3. Escenarios de prueba

### 3.1 Login y carga inicial del KDS

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Entrar con `cocina.central@cafeteria.com` / `cocina2026` | Redirigir a `/empleado/comandas` (KDS). |
| 2 | Verificar que el top bar muestra "CoffeeFast - KDS Cocina Central". | Header correcto. |
| 3 | Esperar a que carguen las columnas (Pendiente, En Preparación, Listos para Retiro). | Pedidos visibles según `cafeteria_id` del empleado. |
| 4 | Revisar `console` o DevTools -> Network: primera carga usa `getAll` con `cafeteriaId`. | Sin errores "no cafetería asociada". |
| 5 | Presionar F5 (refrescar). | **No** debe salir error de cafetería. `getPerfilSesion` trae `cafeteria_id` (fix S2-T9). |

### 3.2 Realtime y actualizaciones automáticas

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Tener pedidos en diferentes estados. | Columna "En Preparación" y "Listos para Retiro" con conteo. |
| 2 | Simular cambio de estado desde backend o otro cliente. | Realtime suscriptor actualiza UI al instante (sin refresh). |
| 3 | Verificar que pedidos de **otra cafetería** NO aparecen. | Solo pedidos de la cafetería asociada al empleado. |

### 3.3 Transiciones de estado y bloqueo por pedido

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Seleccionar un pedido en "Pendiente" y click en "COMENZAR PREPARACIÓN". | Botón pasa a `PROCESANDO...`, se deshabilita. |
| 2 | Doble click rápido sobre ese mismo botón. | **Sólo se envía 1 petición** (verificar en Network). |
| 3 | Mientras esa comanda está procesando, intentar cambiar otro pedido distinto. | **Sigue operativa**, no se bloquea. |
| 4 | Esperar a que la petición termine. | Botón vuelve a habilitarse con etiqueta original. |
| 5 | Si falla la petición: error en consola, botón se libera (`finally`), se muestra feedback al usuario. | Estado conservado, usuario informado. |

### 3.4 Indicador de retiro próximo (S2-T8)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Tener un pedido en estado `listo` con `franja_retiro` próxima (hasta 15 min). | Aparece chip naranja `RETIRAR EN X MIN`. |
| 2 | Esperar ~60 seg sin tocar nada. | El número baja solo (ej. de `RETIRAR EN 14 MIN` a `RETIRAR EN 13 MIN`). |
| 3 | Si el pedido NO está en `listo` o ya pasó el tiempo: **no** debe aparecer indicador. | Lógica correcta por `minutosHastaRetiro()`. |

### 3.5 Búsqueda local por código (S2-T13)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | En el buscador del KdsTopBar escribir parte del `codigo_pedido` de alguna tarjeta. | Las columnas se filtran en tiempo real, mostrando solo la(s) que coincidan. |
| 2 | Borrar el texto del buscador. | Vuelven a aparecer **todas** las comandas. |
| 3 | No hacer peticiones nuevas al backend al escribir. | Filtrado 100% local sobre `pedidosOrdenados`. |

### 3.6 Estados de error y desconexión (S2-T16)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Poner Network en `Offline` (DevTools) con comandas visibles. | Alerta: "Conexión en tiempo real interrumpida. Las comandas se mantienen...". No se borran tarjetas. |
| 2 | Volver a `Online`. | Alerta desaparece, Realtime se recupera. |
| 3 | Forzar error 401/403/409 al cambiar estado. | Alerta específica: sesión vencida, sin permisos, conflicto de estado. No se hace escritura alternativa. |
| 4 | Error de red genérico. | Alerta: "Sin conexión al backend. Verifique su red e inténtelo nuevamente.". |

### 3.7 Filtro de franjas y hora de retiro (S2-T7)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Tener un pedido con `franja_retiro` = `HH:MM-HH:MM` cercana al momento actual. | Ordenamiento prioriza `franja_retiro` (hora inicio) > `hora_retiro` > creado+en 15 min. |
| 2 | Revisar columna "Listos para Retiro": los pedidos con franja válida deben aparecer primero/al lado. | Prioridad estricta según `aInstanteRetiro()`. |

### 3.7 Flujo completo end-to-end

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Login → Ver KDS con pedidos. |
| 2 | Esperar a que Realtime traiga novedades. |
| 3 | Cambiar estado de una comanda (validar bloqueo por pedido). |
| 4 | Usar buscador para filtrar. |
| 5 | Ver indicador de retiro próximo en un pedido `listo`. |
| 6 | Probar offline/online. |
| 7 | Probar error 401/403/409 en cambio de estado. |
| 8 | Cerrar sesión y volver a entrar. |

## 4. Resumen de cobertura

| Característica | Estado |
|----------------|--------|
| Login + perfil con `cafeteria_id` | ✅ S2-T9 |
| Carga inicial filtrada por cafetería | ✅ S2-T12 |
| Realtime con filtro por cafetería | ✅ S2-T12 |
| Indicador "RETIRAR EN X MIN" + actualización cada 60s | ✅ S2-T8 |
| Bloqueo por pedido (evitar doble clic) | ✅ S2-T11 |
| Búsqueda local sin consultas backend | ✅ S2-T13 |
| Errores HTTP 401/403/409 con feedback | ✅ S2-T16 |
| Errores de red con feedback diferenciados | ✅ S2-T16 |
| Recuperación ante offline/polling fallo | ✅ S2-T10 |
| Sin fallback silencioso a cafetería fija | ✅ S2-T12 |

## 5. Cómo ejecutar la prueba

1. Iniciar servidores: `npm run dev` en `app-desktop`.
2. Entrar con cuenta de test.
3. Abrir DevTools -> Console para ver logs de validación.
4. Abrir DevTools -> Network para verificar peticiones (solo 1 por acción, sin doubles).
5. Probar cada escenario en el orden que se indique.

## 6. Conclusión

Al completar estos escenarios se verifica que el KDS funciona como sistema integrado: autenticación, alcance por cafetería, tiempo real, estado de operaciones, búsqueda, indicadores visuales, manejo de errores y recuperación. Todo está centralizado en el cliente HTTP con JWT, sin escrituras alternativas ante rechazos, y con feedback claro al usuario en cada caso.