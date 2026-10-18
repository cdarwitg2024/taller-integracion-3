# Auditoría y Corrección de Confirmación de Correo y Redirección en Supabase Auth

> **Tarea:** S2-T1 — Diego Vásquez — Auditar confirmación de correo  
> **Fecha:** 2026-10-17  
> **Rama:** `S2-T1-Diego-Vásquez-Auditar-confirmación-de-correo`  
> **Tipo de actividad:** Auditoría técnica, resolución de redirección a `localhost:3000` y soporte de Deep Linking.

---

## 1. Contexto y Descripción del Problema

Al realizar el registro de un nuevo estudiante en la aplicación móvil (`app-mobile`) a través de `supabase.auth.signUp()`, en entornos con confirmación de correo activa (como Supabase Cloud por defecto), el usuario recibe un correo con un enlace de verificación. Al hacer clic en dicho enlace, el navegador del dispositivo o PC redirigía a:

```
http://localhost:3000/#access_token=...&refresh_token=...&type=signup
```

Esto generaba un error de conexión ("No se puede conectar a localhost:3000") en el dispositivo móvil, impidiendo completar la verificación del usuario y bloqueando el acceso posterior a la aplicación con el error de credenciales o correo no confirmado.

---

## 2. Diagnóstico del Origen del Fallo

La auditoría técnica determinó que la causa no residía en un único componente, sino en la **interacción encadenada de tres factores**:

| Componente | Hallazgo / Causa Raíz |
|---|---|
| **Configuración de Autenticación** | `supabase/config.toml` y el panel de Supabase Cloud configuran por defecto `site_url = "http://127.0.0.1:3000"`. Port 3000 no aloja ninguna app web de frontend en este proyecto (aloja la API Express de `backend-node`). |
| **Lógica de Redirect URL (GoTrue)** | GoTrue utiliza un mecanismo de *fallback*: si la petición de registro no incluye `emailRedirectTo`, o si la URL indicada no está en la lista blanca de `additional_redirect_urls`, GoTrue redirige automáticamente al `site_url` del proyecto. |
| **Mobile (`app-mobile`)** | `RegisterScreen.tsx` no enviaba el parámetro `emailRedirectTo` en las opciones de `signUp`. Adicionalmente, el manifiesto de Android (`AndroidManifest.xml`) no tenía declarado el `<intent-filter>` para el esquema `coffeefast://`, por lo que el sistema operativo no sabía cómo abrir la app si se usaba un deep link. |

---

## 3. Cambios Implementados

### 3.1. Configuración de Supabase (`supabase/config.toml`)
Se amplió `additional_redirect_urls` para permitir de forma explícita el esquema de la aplicación móvil y los entornos locales de desarrollo:

```toml
# S2-T1: Permitir esquema deep link de la app móvil (coffeefast://) y entorno local Expo/Metro
additional_redirect_urls = [
  "https://127.0.0.1:3000",
  "coffeefast://**",
  "coffeefast://auth/callback",
  "http://localhost:8081/**",
  "http://127.0.0.1:8081/**"
]
```

### 3.2. Pantalla de Registro (`app-mobile/src/screens/RegisterScreen.tsx`)
1. Se agregó `emailRedirectTo: 'coffeefast://auth/callback'` dentro de las opciones de `supabase.auth.signUp()`.
2. Se diferenció el mensaje presentado al estudiante según si la sesión fue creada de inmediato (sin confirmación previa requerida) o si quedó pendiente de verificación de correo institucional (`@alu.uct.cl`).

```typescript
const { data, error } = await supabase.auth.signUp({
  email: email.trim().toLowerCase(),
  password: password,
  options: {
    emailRedirectTo: 'coffeefast://auth/callback',
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: nombreCompleto.trim(),
      rol: 'estudiante',
    },
  },
});
```

### 3.3. Manifiesto Android (`app-mobile/android/app/src/main/AndroidManifest.xml`)
Se agregó el filtro de intents para capturar el esquema `coffeefast` en `MainActivity`:

```xml
<!-- S2-T1: Soporte de Deep Linking para confirmación de correo y auth callback -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="coffeefast" />
</intent-filter>
```

### 3.4. Captura de Deep Link en la App (`app-mobile/App.tsx`)
Se incorporó el listener de `Linking` de React Native para interceptar URLs con tokens de autenticación (`coffeefast://auth/callback#access_token=...`), establecer la sesión de manera segura con `supabase.auth.setSession()` y notificar al usuario de la confirmación exitosa.

---

## 4. Guía de Configuración en Supabase Cloud

Si el equipo trabaja contra el proyecto remoto alojado en Supabase Cloud (`yrswjmxdpmiyfpclrfmg.supabase.co`):

1. Ir a **Authentication** -> **URL Configuration**.
2. En **Redirect URLs**, agregar:
   - `coffeefast://**`
   - `coffeefast://auth/callback`
3. *(Opcional)* Si para desarrollo rápido no se desea requerir confirmación por correo:
   - Ir a **Authentication** -> **Providers** -> **Email**.
   - Desmarcar la casilla **"Confirm email"** (análogo a `enable_confirmations = false` en `config.toml` local).
