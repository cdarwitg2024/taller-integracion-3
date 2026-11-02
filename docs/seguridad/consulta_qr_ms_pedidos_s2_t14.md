# Alineación de Consulta QR Mobile con ms-pedidos (S2-T14)

> **Tarea:** S2-T14 — Diego Vásquez — Alinear consulta QR Mobile con ms-pedidos  
> **Fecha:** 2026-10-30  
> **Rama de trabajo:** `S2-T14-Diego-Vásquez-Alinear-consulta-QR-Mobile-con-ms-pedidos`  
> **Módulo:** `app-mobile` / `Microservices/ms-pedidos` / `Gateway`  
> **Tipo de actividad:** Integración de cliente HTTP autenticado, eliminación de contrato legacy, manejo de estados de error y documentación de flujo.

---

## 1. Contexto y Requerimiento

La tarea **S2-T14** tiene como objetivo:
> *"Actualizar el flujo Mobile encargado de obtener información QR para utilizar el contrato autenticado vigente de ms-pedidos, eliminando dependencias incompatibles con contratos legacy cuando corresponda."*

Anteriormente, la aplicación móvil realizaba un `fetch` sin cabeceras de autorización hacia `${API_URL}/api/pedidos/:id/qr` esperando un objeto legacy `{ success: true, data: { qr_image } }`. Además, ante cualquier fallo (incluyendo 401 o 404), la aplicación degradaba silenciosamente a un QR local con el token crudo almacenado, ocultando los rechazos de autorización del backend.

---

## 2. Arquitectura de Consulta End-to-End

### Flujo: Mobile → Cliente HTTP → Gateway/Backend → Respuesta QR

```
+-----------------------------------------------------------------------------------+
|                            App Mobile (React Native)                              |
| 1. Usuario toca pedido activo en Mis Pedidos (PedidosScreen.js).                  |
| 2. Se verifica que el estado sea activo ('pendiente', 'en_preparacion', 'listo'). |
| 3. Invoca apiGet('/api/pedidos/:id/qr') desde backendClient.ts.                   |
| 4. backendClient obtiene JWT vigente: supabase.auth.getSession().                 |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTPS (Authorization: Bearer <JWT>)
                                          v
+-----------------------------------------------------------------------------------+
|                                API Gateway (Nginx)                                |
| - Recibe /api/pedidos/:id/qr.                                                     |
| - Enruta hacia http://ms-pedidos:3005/api/pedidos/:id/qr.                         |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTP Proxy pass (Forward JWT)
                                          v
+-----------------------------------------------------------------------------------+
|                           Microservicio: ms-pedidos                               |
| 1. Middleware auth.exigirAuth: Valida firma y expiración del JWT de Supabase.     |
|    -> Si no hay token o es inválido: Responde HTTP 401 Unauthorized.              |
| 2. Valida rol y pertenencia: Solo el estudiante dueño puede obtener el QR.        |
|    -> Si rol no es estudiante o pedido es ajeno: Responde HTTP 404 Not Found.     |
| 3. Valida estado del pedido:                                                      |
|    -> Si es 'entregado' o 'cancelado': Responde HTTP 409 Conflict.                |
| 4. Si todo es válido:                                                             |
|    -> Responde HTTP 200 { "qr_token": "uuid-..." }                                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | JSON Response
                                          v
+-----------------------------------------------------------------------------------+
|                        Retorno y Renderizado en Mobile                            |
| - HTTP 200: Renderiza <QrCode value={qr_token} size={190} /> en dispositivo.      |
| - HTTP 401: Visualiza error "Sesión no autorizada o expirada". Sin QR.           |
| - HTTP 404: Visualiza error "Pedido no encontrado o ajeno". Sin QR.               |
| - HTTP 409: Bloquea QR. Informa estado no disponible para entrega.                |
| - HTTP 0 (Red/Offline): Solo si es pedido activo, permite credencial local        |
|   advirtiendo explícitamente "Modo sin conexión: credencial de respaldo".        |
+-----------------------------------------------------------------------------------+
```

---

## 3. Matriz de Códigos de Respuesta y Comportamiento Mobile

| Código HTTP | Causa en Backend (`ms-pedidos`) | Comportamiento en `PedidosScreen.js` | ¿Muestra QR? |
| :---: | :--- | :--- | :---: |
| **200 OK** | Usuario autenticado, estudiante dueño y pedido activo. | Recibe `{ qr_token }` y renderiza el componente nativo `<QrCode />`. | **SÍ** (Autorizado) |
| **401 Unauthorized** | Token ausente, firma inválida o sesión expirada. | Lanza `ApiError(status: 401)`. Muestra banner de sesión requerida. | **NO** (Bloqueado) |
| **404 Not Found** | Pedido inexistente, rol no autorizado o usuario ajeno. | Lanza `ApiError(status: 404)`. Muestra banner de acceso no autorizado. | **NO** (Bloqueado) |
| **409 Conflict** | Pedido terminal (`entregado` o `cancelado`). | Lanza `ApiError(status: 409)`. Informa que el QR ya no está disponible. | **NO** (Terminal) |
| **0 (Error de red)** | Backend inaccesible, timeout de 5s o sin conectividad. | Detecta `status === 0`. Únicamente si el pedido es activo degrada a local con aviso offline. | **SÍ** (Modo Contingencia) |

---

## 4. Criterios de Aceptación Verificados

1. **La solicitud utiliza el JWT de la sesión:**
   La función `apiGet` en `backendClient.ts` obtiene `data.session.access_token` de Supabase Auth y lo inyecta como cabecera `Authorization: Bearer <token>`.
2. **Utiliza el endpoint vigente definido para el flujo:**
   Se utiliza `GET /api/pedidos/:id/qr` y se procesa el contrato `{ qr_token: string }` de `ms-pedidos`, retirando el acoplamiento legacy a `data.qr_image`.
3. **Se diferencia 401 de 404 y de error de red:**
   `obtenerQrDesdeBackend` inspecciona `ApiError.status`:
   - `401`: Sesión expirada / no autorizada.
   - `404`: Pedido ajeno / rol no autorizado.
   - `0`: Falla de red / timeout.
4. **Pedidos terminales no presentan un QR utilizable cuando no corresponde:**
   Si `!esActivo(item.estado)` (`entregado` o `cancelado`), la app ni siquiera solicita el QR y muestra la boleta o recibo. Si el backend responde 409, el QR se bloquea.
5. **Un fallback no oculta errores de autorización:**
   Ante respuestas 401 y 404, el componente **nunca** cae al token local; despliega un banner de error explícito de autorización.
6. **Documentación del flujo:**
   Documentado en este archivo `docs/seguridad/consulta_qr_ms_pedidos_s2_t14.md`.
