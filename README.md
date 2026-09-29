# ☕ App de Pedidos para Cafeterías Universitarias

## 📋 Descripción
Aplicación full stack para pedidos por adelantado en cafeterías universitarias.

## 🏗️ Arquitectura
- **Frontend Móvil**: React Native + Expo
- **Frontend Desktop**: React + Vite + Electron + MUI
- **Backend**: Node.js + Express
- **Base de Datos**: Supabase (PostgreSQL)

## 📁 Estructura del Proyecto
- /app-mobile - App Android (React Native + Expo)
- /app-desktop - App Escritorio (React + Electron)
- /backend-node - Servidor Node.js
- /database - Migraciones y seeds de Supabase
- /docs - Documentación del proyecto

## 📖 Documentación
- **[Puesta en marcha del flujo de pedidos](docs/puesta_en_marcha_flujo_pedidos.md)** —
  cómo levantar el entorno, orden de migraciones, cuentas de prueba, endpoints
  y qué se corrigió para que el flujo pago → preparación → retiro por QR funcione
  de punta a punta.

## 👥 Integrantes
- **Int 1**: App Móvil (Kotlin)
- **Int 2**: App Escritorio (React + Electron)
- **Int 3**: Base de Datos (Supabase)
- **Int 4**: Servidor Node.js
- **Int 5**: Escáner + Dashboard + Integración

## 🔐 Credenciales de Acceso (App Escritorio)

| Rol | URL de acceso | Email | Contraseña |
| --- | --- | --- | --- |
| **Dueño** | `http://localhost:5173/login/dueno` | `dueno@coffeefaster.cl` | `123456` |
| **Empleado** | `http://localhost:5173/login/empleado` | `empleado@coffeefaster.cl` | `123456` |

> **Nota**: el login intenta primero con Supabase Auth (si el proyecto está configurado) y si no responde usa un fallback de desarrollo que se activa ÚNICAMENTE en `import.meta.env.DEV` (comando `npm run dev`). Las credenciales de fallback se pueden cambiar con las variables `VITE_DEV_ADMIN_EMAIL`/`VITE_DEV_ADMIN_PASSWORD` y `VITE_DEV_EMPLEADO_EMAIL`/`VITE_DEV_EMPLEADO_PASSWORD` en `app-desktop/.env`.
>
> El usuario **dueño** (`usuarios.id = 1`) todavía no está vinculado en Supabase Auth, así que hoy solo entra por ese fallback de desarrollo.

## 🔐 Credenciales de la App Móvil

| Rol | Email | Contraseña |
| --- | --- | --- |
| **Estudiante** | `camilo.pago@alu.uct.cl` | `pruebapago2026` |

## 🧪 Cuenta de KDS para probar el flujo completo

| Rol | Email | Contraseña |
| --- | --- | --- |
| **Cocina** | `cocina.central@cafeteria.com` | `cocina2026` |

- **Dueño**: panel de administración (productos, stock, personal, métricas y alertas).
- **Empleado**: KDS de cocina (comandas en tiempo real, preparación y validación de retiros por QR).

