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
- /BotTelegramCoffeFaster - Bot de alertas de stock (Python + FastAPI + Telegram)
- /Microservices - Stack de microservicios vigente (gateway nginx, ms-cafeterias, ms-menus, ms-pedidos, shared)
- /k8s-next - Manifiestos Kubernetes del stack vigente (gateway + 3 microservicios)
- /backend-node - Backend LEGACY (en retiro; ver `docs/README.md`)
- /supabase - Config y Edge Functions de Supabase
- /database - Fixes SQL de Supabase (migraciones y seeds)
- /docs - Documentación del proyecto (con clasificación en `docs/README.md`)

## 📖 Documentación
- **[Índice y clasificación de la documentación](docs/README.md)** — qué está actual,
  qué hay que actualizar y qué quedó obsoleto.
- **[Puesta en marcha del flujo de pedidos](docs/puesta_en_marcha_flujo_pedidos.md)** —
  cómo levantar el entorno, orden de migraciones, cuentas de prueba, endpoints
  y qué se corrigió para que el flujo pago → preparación → retiro por QR funcione
  de punta a punta.
- **[Arquitectura de microservicios](docs/obsoleto/arquitectura-microservicios.md)** — *(OBSOLETO)*
  (archivado en `docs/obsoleto/`) describe la arquitectura previa
  (`backend-node` + `inventario-service`) y su K8s legacy.
- **[Despliegue en Kubernetes](docs/obsoleto/despliegue_kubernetes_backend.md)** — *(OBSOLETO)*
  (archivado en `docs/obsoleto/`) despliegue del backend legacy sobre el extinto `k8s/`.

## ⚠️ Advertencia: seguridad al aplicar manifiestos

> **Nota de estado:** la infraestructura vigente es **`k8s-next/`** (gateway +
> `ms-cafeterias` + `ms-menus` + `ms-pedidos`). Los manifiestos legacy de `k8s/`
> (`backend-node` + `inventario-service`) fueron **eliminados** del repositorio; su
> documentación quedó archivada en `docs/obsoleto/`. La advertencia de abajo aplica a
> **cualquier** árbol que pueda contener Secrets.

**Nunca uses `kubectl apply -R` (ni `--recursive`) sobre carpetas que puedan
contener Secrets.** Un `apply` recursivo no distingue una plantilla de un Secret
real: aplica **todo** lo que encuentra, y en este proyecto ya pasó — un
`kubectl apply -f ... --recursive` sobre el antiguo árbol de manifiestos
sobrescribió el Secret `coffeesecret-supabase` del clúster con los placeholders
de una plantilla.

Reglas al aplicar manifiestos:

1. **Aplica archivo por archivo** o **por subcarpeta cerrada**, nunca por el árbol
   completo:
   ```powershell
   # correcto: archivos o subcarpetas explícitas
   kubectl apply -f k8s-next/gateway/
   kubectl apply -f k8s-next/ms-pedidos/

   # PROHIBIDO: recorre todo el árbol, incluidos Secrets
   kubectl apply -f k8s-next/ --recursive
   ```
2. **No debe haber manifiestos de Secret dentro de los árboles de despliegue.**
   Es intencional: así un `apply` recursivo no tiene nada que pisar. La plantilla
   de referencia vive
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

El Secret debe incluir `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y
`SUPABASE_PUBLISHABLE_KEY`. ms-pedidos las referencia mediante `secretKeyRef`;
el ejemplo anterior debe completarse con la clave publica para ese servicio.
Ver la [matriz de ms-pedidos](docs/seguridad/ms-pedidos-entornos-s2-t14.md).

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

