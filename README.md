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
- **[Despliegue en Kubernetes](docs/despliegue_kubernetes_backend.md)** — build,
  push y aplicación de `backend-node` e `inventario-service` en el clúster
  `student-cdarwitg`.
- **[Arquitectura de microservicios](docs/arquitectura-microservicios.md)** —
  Ingress, Secrets, réplicas y comunicación interna entre servicios.

## ⚠️ Advertencia: seguridad al aplicar manifiestos

**Nunca uses `kubectl apply -R` (ni `--recursive`) sobre carpetas que puedan
contener Secrets.** Un `apply` recursivo no distingue una plantilla de un Secret
real: aplica **todo** lo que encuentra, y en este proyecto ya pasó — un
`kubectl apply -f k8s/ --recursive` sobrescribió el Secret
`coffeesecret-supabase` del clúster con los placeholders de una plantilla.

Reglas al aplicar manifiestos:

1. **Aplica archivo por archivo** o **por subcarpeta cerrada**, nunca por el árbol
   completo:
   ```powershell
   # correcto: archivos o subcarpetas explícitas
   kubectl apply -f k8s/ingress.yaml
   kubectl apply -f k8s/pedidos/
   kubectl apply -f k8s/inventario/

   # PROHIBIDO: recorre todo el árbol, incluidos Secrets
   kubectl apply -f k8s/ --recursive
   ```
2. **Dentro de `k8s/` no hay ningún manifiesto de Secret.** Es intencional: así
   un `apply` recursivo no tiene nada que pisar. La plantilla de referencia vive
   fuera, en [`docs/secrets/supabase-secret.example.yaml`](docs/secrets/supabase-secret.example.yaml),
   que solo contiene placeholders (`<TU_SUPABASE_URL>`).
3. **El Secret real se crea a mano, una vez, y no se versiona:**
   ```powershell
   kubectl create secret generic coffeesecret-supabase `
     --from-literal=SUPABASE_URL="https://<proyecto>.supabase.co" `
     --from-literal=SUPABASE_SERVICE_KEY="<service key>" `
     -n student-cdarwitg
   ```
4. **Nunca pegues credenciales reales en el repo.** Ni en manifiestos, ni en
   `.env` versionado, ni en documentación. Para revisar o corregir un Secret
   existente, recrea el objeto con `kubectl create secret`; **no** lo apliques
   desde un archivo del repo.

Las claves que espera el Secret son `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, las
mismas que inyectan los Deployments por `envFrom.secretRef`.

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

