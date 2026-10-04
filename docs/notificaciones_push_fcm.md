# Notificaciones push (FCM) — Backend listo, pendiente el lado móvil

Estado actual: **el backend ya está completo y probado**. Falta únicamente que el
equipo de `app-mobile` registre el token FCM del dispositivo y configure su
proyecto de Firebase.

---

## 1. Qué hace el backend

| Pieza | Archivo | Qué hace |
|---|---|---|
| Envío a FCM | `backend-node/src/modules/notificaciones/fcm.service.js` | API HTTP v1 de Firebase con `fetch` y firma RS256 del service account usando el `crypto` de Node (**sin dependencias nuevas**). |
| Lógica de negocio | `backend-node/src/modules/notificaciones/notificaciones.service.js` | Decide el mensaje, envía a todos los dispositivos del usuario y desactiva los tokens que FCM da por muertos. |
| Tokens | `backend-node/src/modules/notificaciones/dispositivos.service.js` | Alta/actualización/baja de tokens en la tabla `dispositivos`. |
| Endpoints | `backend-node/src/modules/notificaciones/notificaciones.routes.js` | Rutas bajo `/api/notificaciones` (todas exigen JWT). |
| Disparo | `backend-node/src/modules/pedidos/pedidos.service.js` | Al final de `updateEstado()` se notifica si el estado nuevo es `En preparación` o `Listo`. |

### Los dos eventos que disparan notificación

| Transición | Evento interno | Mensaje |
|---|---|---|
| `En preparación` (el KDS envía `preparando`) | `en_preparacion` | "Tu pedido está en preparación" — *El pedido #X en <cafetería> ya entró a la cocina. Te avisaremos cuando esté listo.* |
| `Listo` | `listo` | "Tu pedido está listo para retirar" — *Pasa a retirar tu pedido #X en <cafetería>.* |

> No se notifica en otras transiciones (ej. `Retirado` o `Cancelado`).

### Garantías de diseño

1. **La notificación nunca rompe el pedido.** Se dispara *después* de que el estado
   quedó guardado, y va envuelto en `try/catch`. Si FCM está caído, el KDS igual
   recibe `200` y el pedido queda en su estado (probado en
   `tests/notificaciones.test.js`).
2. **Un token inválido no tumba el lote.** Se usa `Promise.allSettled`: si un
   dispositivo falla, los demás reciben su notificación.
3. **Los tokens muertos se limpian solos.** Cuando FCM responde
   `UNREGISTERED` / `INVALID_ARGUMENT` / `SENDER_ID_MISMATCH`, ese token se marca
   `activo = false` y no se vuelve a intentar.
4. **El usuario se toma del JWT**, nunca del body: nadie puede registrar un token
   en nombre de otra cuenta.

---

## 2. Endpoints (todos requieren `Authorization: Bearer <jwt>`)

### Registrar el token (lo llama la app al iniciar sesión)

```http
POST /api/notificaciones/registro
Content-Type: application/json
Authorization: Bearer <jwt>

{ "token": "<token fcm>", "plataforma": "android" }
```

Respuesta `201`:

```json
{
  "ok": true,
  "mensaje": "Dispositivo registrado correctamente",
  "dispositivo": { "id": 1, "plataforma": "android", "activo": true, "ultima_conexion": "..." }
}
```

Registrar dos veces el mismo token **no lo duplica**: lo actualiza. Si el token ya
pertenecía a otro usuario (logout y login con otra cuenta), se reasigna.

### Desregistrar el token (logout)

```http
DELETE /api/notificaciones/registro
{ "token": "<token fcm>" }
```

Marca `activo = false` (no borra la fila).

### Diagnóstico

```http
GET  /api/notificaciones/estado   -> { "ok": true, "modo": "simulacion|real", "fcm_configurado": false, "eventos": ["en_preparacion","listo"] }
POST /api/notificaciones/prueba   -> envía una notificación de prueba a tus propios dispositivos
```

---

## 3. Modo simulación (estado actual)

Mientras no haya credenciales de Firebase, el servicio **no rompe nada**: registra
el envío en el log y responde `ok: true`.

```
[fcm:simulacion] token=fcm-toke…123456 | "Tu pedido está en preparación" - "..." | data={"tipo":"pedido_en_preparacion",...}
```

`GET /api/notificaciones/estado` devuelve `modo: "simulacion"`, así que la app
sabe que el backend está vivo aunque todavía no envíe push de verdad.

## 4. Cómo activar el envío real

Tres variables de entorno en `backend-node/.env` (también acepta el prefijo
`FIREBASE_`):

| Variable | Valor |
|---|---|
| `FCM_PROJECT_ID` | Project ID del proyecto de Firebase |
| `FCM_CLIENT_EMAIL` | `xxx@project.iam.gserviceaccount.com` de la service account |
| `FCM_PRIVATE_KEY` | Clave privada completa del JSON, con `\n` en los saltos de línea |

Con las tres, `modo` cambia a `real` y los envíos salen a Firebase.

> Estas credenciales **no** se versionan: viven solo en el `.env` local y en el
> Secret de Kubernetes cuando se despliegue.

---

## 5. Lo que le toca hacer al equipo móvil

`app-mobile` es un proyecto Expo con carpetas nativas (`android/`, `ios/`) ya
generadas, así que puede pedir un token FCM nativo.

1. **Crear el proyecto de Firebase** y registrar la app Android con el
   package name actual.
2. **Instalar la dependencia**: `npx expo install expo-notifications`.
3. **Poner `google-services.json`** en `app-mobile/android/app/` (hoy no existe) y
   declararlo en `app-mobile/app.json`:

   ```json
   { "expo": { "android": { "googleServicesFile": "./android/app/google-services.json" } } }
   ```

4. **Pedir el token FCM nativo** (¡no el de Expo!):

   ```js
   import * as Notifications from 'expo-notifications';
   import Constants from 'expo-constants';

   const { status } = await Notifications.requestPermissionsAsync();
   if (status !== 'granted') return;

   const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();
   // fcmToken.data es el token que espera el backend
   ```

   > **Importante:** si usan `getExpoPushTokenAsync()`, el token empieza
   > por `ExponentPushToken[...]` y **este backend no lo puede usar** (habla
   > directamente con FCM). Hay que usar `getDevicePushTokenAsync()`.

5. **Enviarlo al backend** después de iniciar sesión:

   ```js
   await fetch(`${API_URL}/api/notificaciones/registro`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
     body: JSON.stringify({ token: fcmToken.data, plataforma: Platform.OS })
   });
   ```

6. **Probar**: con la app abierta, `POST /api/notificaciones/prueba`. En el KDS,
   marcar un pedido como *En preparación* y luego *Listo*.

### Código de ejemplo para el servicio en la app

`app-mobile/src/services/notificaciones.js` (sugerencia de contrato, no
implementado):

```js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getToken } from './session';

const BASE = 'https://<backend>/api/notificaciones';

export async function registrarTokenPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const { data } = await Notifications.getDevicePushTokenAsync();
  const token = data.data ?? data;   // según la versión de expo-notifications

  await fetch(`${BASE}/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
    body: JSON.stringify({ token, plataforma: Platform.OS })
  });
  return token;
}

export async function desregistrarTokenPush() {
  const token = await Notifications.getDevicePushTokenAsync();
  await fetch(`${BASE}/registro`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
    body: JSON.stringify({ token: token.data.data ?? token.data })
  });
}
```

---

## 6. Base de datos

**No hubo que crear nada**: la tabla `dispositivos` ya existía con las columnas
exactas que hacen falta.

| Columna | Tipo | Uso |
|---|---|---|
| `id` | bigint PK | |
| `usuario_id` | bigint FK → `usuarios.id` | Dueño del token |
| `token_fcm` | varchar **NOT NULL** | Token del dispositivo |
| `plataforma` | varchar | `android` / `ios` |
| `activo` | boolean | `false` = token desregistrado o inválido |
| `ultima_conexion` | timestamp | Última vez que la app reportó el token |
| `creado_en` | timestamp | Alta |

> Nota: el servicio anterior `src/services/dispositivos.js` consultaba esta tabla
> como `DISPOSITIVOS` en mayúsculas y por eso nunca funcionó; fue reemplazado por
> el módulo `notificaciones`.

## 7. Pruebas

`backend-node/tests/notificaciones.test.js` — 15 pruebas:

- registro con JWT (y rechazo sin token, y que el usuario se toma del JWT);
- no duplica token; desregistro propio y rechazo del ajeno;
- modo simulación sin credenciales;
- notificación de prueba (con y sin dispositivos);
- disparo automático en `En preparación` y en `Listo`, y que **no** dispare en `Retirado`;
- token `UNREGISTERED` → se desactiva solo;
- un token caído no impide enviar a los demás;
- el pedido **igual queda en su estado** aunque FCM esté caído.

Suite completa del backend: **51/51 pruebas en verde**.

```bash
cd backend-node
npx jest                      # todas
npx jest tests/notificaciones.test.js
```

## 8. Lo que NO está hecho (a propósito)

- **No** se tocó `app-mobile` (es tarea del equipo móvil) ni se creó un tercer
  microservicio: la notificación vive dentro del backend de pedidos porque el
  evento nace ahí.
- **No** hay trigger a nivel de base de datos. Hoy todas las transiciones pasan
  por `PATCH /api/pedidos/:id/estado`, así que el hook del backend las cubre
  todas. Si algún día otro servicio escribe el estado directo en la BD, habría
  que mover el disparo a un trigger de Postgres.
- **No** hay reintentos asíncronos (cola/outbox): si FCM falla, el aviso se
  pierde, pero el pedido nunca se queda sin actualizar. Es suficiente para el
  alcance del taller; un outbox con reintento sería el siguiente paso.
