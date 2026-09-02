# MS Notificaciones Push (FCM)

## 1. Propósito

Microservicio responsable de enviar notificaciones Push al estudiante
mediante Firebase Cloud Messaging (FCM) cuando un pedido cambia al
estado `Listo`.

**Trazabilidad SRS:** FR-07 y BR-07. El SRS establece que el Push se
dispara automática y exclusivamente al cambiar el pedido a `Listo`.

## 2. Arquitectura interna

``` text
KDS / API Principal
        |
        | HTTPS / REST
        v
MS Notificaciones Push
        |
        | consulta/obtención de token FCM
        v
Supabase PostgreSQL
        |
        | token FCM
        v
MS Notificaciones Push
        |
        | HTTPS / FCM API
        v
Firebase Cloud Messaging
        |
        | Push
        v
App Móvil del Estudiante
```

### Componentes internos

-   **NotificationController:** recibe las solicitudes del
    microservicio.
-   **NotificationService:** valida que el evento corresponda a un
    pedido en estado `Listo` y prepara el mensaje.
-   **FCMClient:** encapsula la comunicación con Firebase Cloud
    Messaging.
-   **TokenRepository:** obtiene el token FCM asociado al usuario desde
    Supabase/PostgreSQL.
-   **AuditLogger:** registra el intento de envío y su resultado, de
    acuerdo con NFR-08.

## 3. Endpoints mock

### POST `/notificaciones/push`

Envía una notificación Push a un estudiante.

**Request:**

``` json
{
  "pedido_id": "PED-001",
  "usuario_id": "USR-001",
  "titulo": "Pedido listo",
  "mensaje": "Tu pedido está listo para retirar"
}
```

**Respuesta 200:**

``` json
{
  "ok": true,
  "pedido_id": "PED-001",
  "estado": "Listo",
  "mensaje": "Notificación enviada"
}
```

**Regla:** si el pedido no está en `Listo`, el envío debe rechazarse.

### POST `/notificaciones/token`

Registra o actualiza el token FCM asociado a un usuario.

**Request:**

``` json
{
  "usuario_id": "USR-001",
  "token_fcm": "mock-fcm-token-001",
  "plataforma": "android"
}
```

**Respuesta 200:**

``` json
{
  "ok": true,
  "mensaje": "Token FCM registrado"
}
```

## 4. Errores mock

-   `400 Bad Request`: datos incompletos.
-   `404 Not Found`: usuario/pedido no encontrado.
-   `409 Conflict`: pedido no está en estado `Listo`.
-   `502 Bad Gateway`: FCM no disponible.

## 5. Relación con el SRS

-   **FR-07:** envío automático de Push al estudiante vía FCM.
-   **BR-07:** Push únicamente al cambiar a `Listo`.
-   **NFR-08:** registrar transacciones relevantes en logs
    estructurados.
