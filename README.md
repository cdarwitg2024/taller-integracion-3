# ☕ App de Pedidos para Cafeterías Universitarias

## 📋 Descripción
Aplicación full stack para pedidos por adelantado en cafeterías universitarias.

## 🏗️ Arquitectura
- **Frontend Móvil**: Kotlin (Android)
- **Frontend Desktop**: React + Electron + MUI
- **Backend**: Node.js + Express
- **Base de Datos**: Supabase (PostgreSQL)

## 📁 Estructura del Proyecto
- /app-mobile - App Android
- /app-desktop - App Escritorio (React + Electron)
- /backend-node - Servidor Node.js
- /database - Migraciones y seeds de Supabase
- /docs - Documentación del proyecto

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

- **Dueño**: panel de administración (productos, stock, personal, métricas y alertas).
- **Empleado**: KDS de cocina (comandas en tiempo real, preparación y validación de retiros por QR).
