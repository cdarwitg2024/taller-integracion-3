# Implementación y Verificación del Flujo de Confirmación de Cuenta (S2-T2)

> **Tarea:** S2-T2-Diego Vásquez — Corregir flujo de confirmación de cuenta  
> **Fecha:** 2026-10-17  
> **Rama:** `S2-T2-Diego-Vásquez-Corregir-flujo-de-confirmación-de-cuenta`  
> **Objetivo:** Implementar los cambios necesarios del lado de la aplicación y coordinar cualquier configuración externa necesaria para conseguir el ciclo completo **Registro → Correo → Confirmación → Login sin crear manualmente usuarios**.

---

## 1. Resumen Ejecutivo

Con las correcciones de esta tarea, se logra la independencia total de inserciones manuales de cuentas (scripts `seed_manual.sql` o manipulación directa de base de datos). Un estudiante puede:

1. **Registrarse** con su correo institucional `@alu.uct.cl` en la aplicación móvil.
2. **Recibir el correo** de confirmación enviado por Supabase GoTrue.
3. **Confirmar su cuenta** abriendo el enlace en su móvil mediante Deep Link (`coffeefast://auth/callback`) o en un navegador web.
4. **Iniciar sesión** de inmediato en la aplicación móvil (`LoginScreen`) con su correo y contraseña.
5. Contar automáticamente con su perfil en `public.usuarios` y su billetera en `public.wallets` (saldo $0) gracias a triggers de base de datos `SECURITY DEFINER`.

---

## 2. Cambios Implementados en la Aplicación Móvil

### 2.1. Soporte Robusto de Deep Linking y PKCE (`app-mobile/App.tsx`)
* Se amplió el listener de `Linking` para analizar tanto parámetros de consulta (`?code=...`) como fragmentos de hash (`#access_token=...`).
* Se añadió compatibilidad con el flujo **PKCE** mediante `supabase.auth.exchangeCodeForSession(code)` para proyectos Supabase modernos.
* Se agregó gestión y visualización de errores (`error`, `error_description`) mediante alertas amigables en caso de enlaces expirados o tokens no válidos.

```typescript
// S2-T2: Soporte para PKCE y flujo implícito en Deep Linking
if (code) {
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (!exchangeError && data?.session) {
    setSession(data.session);
    Alert.alert('¡Cuenta confirmada!', 'Tu correo institucional ha sido verificado exitosamente.');
  }
}
```

### 2.2. Opción de Reenvío de Confirmación en Login (`app-mobile/src/screens/LoginScreen.tsx`)
* Cuando un estudiante intenta iniciar sesión y su correo aún no ha sido verificado (`Email not confirmed`), la interfaz activa un botón interactivo: **"Reenviar enlace de confirmación"**.
* Utiliza `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: 'coffeefast://auth/callback' } })`.
* Esto otorga autonomía al usuario sin requerir asistencia de administradores si el correo expiró o se extravió.

### 2.3. Validación de Usuarios Preexistentes (`app-mobile/src/screens/RegisterScreen.tsx`)
* Con la protección contra enumeración de correos en Supabase, si una cuenta ya existe, `signUp()` devuelve `identities: []`. Se incorporó la detección para informar al estudiante que su cuenta ya existe e invitarlo a iniciar sesión.

---

### 2.4. Automatización de Base de Datos (`db_CoffeeFaster/supabase/migrations/0009_sincronizacion_auth_usuarios_wallet.sql`)
* Se consolidó la migración SQL (en el repositorio `db_CoffeeFaster`, rama `develop`) que garantiza la creación encadenada:
  1. `AFTER INSERT ON auth.users` $\rightarrow$ ejecuta `public.handle_new_auth_user()` e inserta en `public.usuarios`.
  2. `AFTER INSERT ON public.usuarios` $\rightarrow$ ejecuta `public.crear_wallet_automatica()` e inserta en `public.wallets`.
  3. Establece políticas RLS limpias sin recursión infinita (error 42P17).

---

## 3. Guía de Configuración Externa en Supabase Cloud

Para que el ciclo funcione en la nube (`yrswjmxdpmiyfpclrfmg.supabase.co`):

1. **Authentication → URL Configuration:**
   * En **Redirect URLs**, registrar:
     * `coffeefast://**`
     * `coffeefast://auth/callback`
     * `http://localhost:8081/**` (para desarrollo local Expo)

2. **Authentication → Providers → Email:**
   * Asegurar que **Confirm email** esté marcado para exigir la verificación por correo.
   * Verificar que el servidor SMTP tenga cupo disponible o esté configurado un servicio como Resend/SendGrid.

3. **Authentication → Email Templates → Confirm signup:**
   * El botón del mensaje debe contener:
     ```html
     <a href="{{ .ConfirmationURL }}">Confirmar tu cuenta</a>
     ```

---

## 4. Matriz de Verificación del Flujo

| Paso | Acción del Usuario | Respuesta del Sistema | Estado |
|---|---|---|---|
| **1. Registro** | Ingresar nombre y correo `@alu.uct.cl` en `RegisterScreen` | Cuenta creada en `auth.users`, perfil en `usuarios`, billetera en `wallets`. Alerta: "¡Verifica tu correo!". | ✅ Verificado |
| **2. Correo** | GoTrue emite email de confirmación | El correo llega a la bandeja institucional con enlace seguro. | ✅ Verificado |
| **3. Confirmación** | Clic en el enlace desde el móvil o navegador | GoTrue registra `email_confirmed_at = NOW()` y redirige a `coffeefast://auth/callback`. Deep link establece la sesión con alerta de éxito. | ✅ Verificado |
| **4. Login** | Ingreso en `LoginScreen` con correo y contraseña | Autenticación válida HTTP 200, carga de catálogo y acceso completo a la app. | ✅ Verificado |
| **5. Autonomía** | Intento de login previo a confirmar | Mensaje de advertencia claro con opción interactiva "Reenviar enlace de confirmación". | ✅ Verificado |
