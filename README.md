# CoffeeFast — App de Pedidos para Cafeterías Universitarias

Aplicación full stack para pedidos por adelantado en cafeterías universitarias:
el estudiante pide y paga desde el móvil, la cocina recibe la comanda en tiempo
real (KDS), y el retiro se valida con un código QR. Hay paneles para el dueño
(productos, stock, personal, métricas) y para el empleado (cocina y
preparación).

## Arquitectura

```
                        ┌──────────────────────────────┐
   app-mobile ─────────▶│                              │
   app-desktop ────────▶│          GATEWAY             │  nginx
   (web en k8s) ───────▶│   local: 8080 · clúster: /   │
                        └──────┬───────┬───────┬───────┘
                               │       │       │
                     ┌─────────▼────┐  │  ┌────▼────────┐
                     │ ms-cafeterias│  │  │ ms-pedidos  │   KDS + QR
                     │    :3002     │  │  │   :3005     │
                     └──────┬───────┘  │  └──────┬──────┘
                            │   ┌──────▼───────┐
                            └──▶│  ms-menus    │
                                │   :3003      │
                                └──────┬───────┘
                                       │  POST /api/menus/precios
                                       ▼  (solo red interna)
                                ┌──────────────┐
                                │   SUPABASE   │  PostgreSQL + Auth + Realtime
                                │  local/cloud  │
                                └──────────────┘
```

En el clúster Kubernetes el gateway expone la API pública en
`https://api-cdarwitg.dev.censei.cl` y el frontend web en
`https://coffeefaster-cdarwitg.dev.censei.cl`.

## Tech Stack

| Capa | Tecnología |
|---|---|
| App móvil (estudiantes) | React Native + Expo (SDK 52) |
| App escritorio (dueño/empleado) | React 18 + Vite + Electron + MUI, también publicable como web |
| Microservicios | Node.js + Express (`@coffeefaster/shared` compartido) |
| Gateway | nginx |
| Base de datos | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Bot de notificaciones | Bot Telegram (`BotTelegramCoffeFaster`) |
| Despliegue | Docker Compose (local) + Kubernetes (`k8s-next/`) |

## Estructura del Proyecto

| Ruta | Contenido |
|---|---|
| `app-mobile/` | App móvil Expo para estudiantes (pedir, pagar con saldo, QR de retiro) |
| `app-desktop/` | App escritorio/web para dueño y empleado (admin + KDS + validación QR) |
| `services/` | **Microservicios** `ms-cafeterias`, `ms-menus`, `ms-inventario`, `ms-pedidos` + gateway nginx (docker-compose) |
| `backend-node/` | Servidor Express **legado** (flujo T13) |
| `inventario-service/` | Servicio de inventario **legado** |
| `database/fixes/` | Correcciones SQL aplicadas al schema (RLS, realtime, logs, etc.) |
| `database/cloud-seed/` | Seed idempotente para la Supabase en la nube (demo) |
| `supabase/` | Config local de Supabase (`config.toml`) y edge functions |
| `k8s-next/` | Despliegue en Kubernetes: microservicios, gateway, ingress y frontend web |
| `k8s/` | Manifiestos legados (contienen plantilla de Secret fuera del repo) |
| `BotTelegramCoffeFaster/` | Bot de Telegram para notificaciones del dueño |
| `docs/` | Documentación del proyecto |
| `tools/loadtest/` | Pruebas de carga |

## Puesta en marcha (local)

### 1. Supabase local

```bash
npx supabase start
# REST (kong)          -> http://localhost:54321
# Studio               -> http://localhost:54323
# Anon / publishable   -> setear en apps (ver .env de cada app)
```

> El proyecto también corre en la nube (`https://yvkpmqcynpygqjvaoiwn.supabase.co`).
> Local y nube **no comparten cuentas** (los ids de roles difieren).

### 2. Microservicios

```bash
cd services
cp .env.example .env      # y poner SUPABASE_SERVICE_KEY (service_role)
docker compose up --build
```

| Qué | URL |
|---|---|
| Gateway (lo que usan las apps) | `http://localhost:8080` |
| `GET /api/cafeterias` | `http://localhost:8080/api/cafeterias` |
| `GET /api/menus` | `http://localhost:8080/api/menus` |
| Debug directo | `localhost:3002` (cafeterias) · `3003` (menus) · `3004` (inventario) · `3005` (pedidos) |

Detalles de rutas, reglas de cada servicio y notas de implementación en
[`services/README.md`](services/README.md).

### 3. Aplicaciones

**App escritorio / web** (`app-desktop/`):

```bash
cd app-desktop
npm install
npm run dev          # http://localhost:5173  (web para el navegador)
npm run electron:dev # dentro de Electron
```

Variables de entorno (`app-desktop/.env`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (o `VITE_SUPABASE_PUBLISHABLE_KEY`), `VITE_BACKEND`,
`VITE_CAFETERIA_ID`, y las de Telegram (`VITE_TELEGRAM_WEBHOOK_URL` /
`VITE_BOT_API_URL`).

**App móvil** (`app-mobile/`):

```bash
cd app-mobile
npm install
npm run start        # Expo
```

## Credenciales de Acceso

Todas usan contraseña `123456`. Local y nube no comparten cuentas: cada
ambiente tiene las suyas porque los roles tienen ids distintos.

### App escritorio (web)

| Rol | URL de acceso | Email |
|---|---|---|
| **Dueño** | `http://localhost:5173/login/dueno` | `dueno@coffeefaster.cl` |
| **Empleado** | `http://localhost:5173/login/empleado` | `empleado@coffeefaster.cl` |

> El login valida estrictamente contra Supabase Auth (`signInWithPassword`) y
> después busca el perfil en `usuarios` por `auth_user_id`. No hay modo de
> respaldo: las cuentas deben estar en Auth **y** en `usuarios` con el mismo
> UUID, o el login devuelve "No se encontró el perfil de usuario registrado".

### App móvil

| Ambiente | Rol | Email |
|---|---|---|
| Local | **Estudiante** | `camilo.pago@alu.uct.cl` |
| Nube | **Estudiante** | `camilo@uct.cl` |

### Cuentas de prueba locales (Supabase en Docker)

| Rol | Email | Observación |
|---|---|---|
| Dueño | `dueno@coffeefaster.cl` | panel de administración |
| Empleado / KDS | `empleado@coffeefaster.cl` | cocina + QR |
| Empleado / KDS | `empleado.prueba@ejemplo.cl` | cocina + QR |
| Estudiante | `cliente.prueba@ejemplo.cl` | saldo 30000 |
| Estudiante | `otro.prueba@ejemplo.cl` | saldo 0 |
| Estudiante (móvil) | `camilo.pago@alu.uct.cl` | saldo 50000, registro con dominio `@alu.uct.cl` |

- Roles locales: **1** = estudiante, **2** = empleado, **3** = dueño.
- Para que un empleado pueda mover comandas en el KDS necesita su fila en
  `cafeteria_usuarios` con `gestiona_pedidos_kds = true`.
- El trigger de alta en Auth asigna siempre el rol de estudiante por defecto: si
  creas un dueño/empleado desde el Dashboard, corrige `usuarios.rol_id` a mano.

### Nube (`yvkpmqcynpygqjvaoiwn`)

| Rol | Email |
|---|---|
| Dueño | `dueno@coffeefaster.cl` |
| Empleado / KDS | `empleado@coffeefaster.cl` |
| Estudiante | `camilo@uct.cl` |

- Roles en nube: **4** = empleado, **5** = estudiante, **6** = dueño.
- La nube arranca sin datos de usuarios/pedidos: después de migrar la
  estructura, usa el seed (ver más abajo) para poblar las cuentas demo.

## Seed de la nube (demo)

`database/cloud-seed/seed_cloud_demo.mjs` es un script **idempotente** que solo
hace INSERTs (no borra ni modifica): crea las cuentas en Supabase Auth (Admin
API) y las filas en `usuarios`/`cafeteria_usuarios` con su `auth_user_id`.

```powershell
Set-PSReadLineOption -HistorySaveStyle SaveNothing
$env:CLOUD_SUPABASE_SERVICE_KEY='<service_role cloud>'
$env:DEMO_DUENO_PASSWORD='<demo>'
$env:DEMO_EMPLEADO_PASSWORD='<demo>'
node database\cloud-seed\seed_cloud_demo.mjs
Remove-Item Env:CLOUD_SUPABASE_SERVICE_KEY, Env:DEMO_DUENO_PASSWORD, Env:DEMO_EMPLEADO_PASSWORD
```

Rechaza URLs locales, resuelve los roles por nombre (por eso no importa que los
ids difieran entre local y nube) y nunca imprime claves ni contraseñas.

## Despliegue en Kubernetes

Clúster `student-cdarwitg`, imágenes en Docker Hub bajo `cdarwitg2024/*`.

| Componente | Manifiesto | Host público |
|---|---|---|
| Microservicios + gateway | `k8s-next/ms-*/`, `k8s-next/gateway/` | `https://api-cdarwitg.dev.censei.cl` |
| Ingress de la API | `k8s-next/ingress-api.yaml` | — |
| Frontend web | `k8s-next/frontend.yaml` | — |
| Ingress del frontend | `k8s-next/ingress-frontend.yaml` | `https://coffeefaster-cdarwitg.dev.censei.cl` |

Flujo resumido:

```bash
docker login
docker build -f app-desktop/Dockerfile -t cdarwitg2024/frontend-web:v1.0.0 .   # con --build-arg VITE_* (ver infra)
docker push cdarwitg2024/frontend-web:v1.0.0
kubectl apply -f k8s-next/frontend.yaml
kubectl apply -f k8s-next/ingress-frontend.yaml
kubectl get pods,svc,ingress -n student-cdarwitg
```

Build del frontend (los `VITE_*` van por `--build-arg`; la publishable key es
pública por diseño, la service key jamás entra):

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://yvkpmqcynpygqjvaoiwn.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=<publishable/key> \
  --build-arg VITE_BACKEND=https://api-cdarwitg.dev.censei.cl \
  --build-arg VITE_CAFETERIA_ID=1 \
  -t cdarwitg2024/frontend-web:v1.0.0 -f app-desktop/Dockerfile .
```

Notas:

- Si reconstruyes una imagen, usa un tag **nuevo** (`v1.0.1`, ...): con
  `IfNotPresent` el nodo puede quedarse con la imagen vieja.
- El HTTPS es self-signed (vía `proxy.inf.uct.cl`): hay que aceptar el
  certificado manualmente la primera vez.
- El paso a paso completo está en los README de los microservicios y en
  [`docs/despliegue_kubernetes_backend.md`](docs/despliegue_kubernetes_backend.md).

## Seguridad al aplicar manifiestos

**Nunca uses `kubectl apply -R` (ni `--recursive`)** sobre carpetas que puedan
contener Secrets. Ya pasó y sobrescribió el Secret `coffeesecret-supabase` del
clúster con los placeholders de una plantilla.

1. Aplica archivo por archivo o subcarpeta cerrada, nunca el árbol completo.
2. En `k8s/` y `k8s-next/` **no hay manifiestos de Secret**, a propósito. La
   plantilla con placeholders vive en `docs/secrets/supabase-secret.example.yaml`.
3. El Secret real `coffeesecret-supabase` (claves `SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY`, `SUPABASE_PUBLISHABLE_KEY`) se crea a mano, una vez,
   con `kubectl create secret generic ... ` y **no se versiona**.
4. Nunca pegues credenciales reales en manifiestos, `.env` versionado ni docs.

## RLS y claves

| Clave | Rol | RLS | Quién la usa |
|---|---|---|---|
| `publishable` / `anon` | `anon` | se aplica | `app-mobile`, `app-desktop` |
| `service_role` | `service_role` | **se salta** | microservicios (`services/.env`), Secret del clúster |

`service_role` salta la RLS y por eso **jamás debe salir del backend**: si llega
a un cliente, cualquiera puede leer y escribir la base entera.

Los microservicios entregan el catálogo al cliente; los datos que el cliente
puede ver (stock, inventario) se gobiernan con políticas RLS en Supabase. No
hay dos verdades de la misma fila: `ms-menus` no lee `stock`/`stock_minimo`; eso
es de `ms-inventario`.

## Tests

```bash
npm test --prefix ms-cafeterias
npm test --prefix ms-menus
npm test --prefix backend-node     # suite del servidor legado
```

Los tests de los microservicios mockean `obtenerCliente`, así que no tocan la
base real.

## Limitaciones conocidas

- HTTPS sin certificado válido (self-signed) en ambos hostname del clúster.
- Stock no atómico entre lecturas; lectura de precios desde la base, nunca del
  cliente (corregido del bug original).
- `/api/inventario/*` y `POST /api/menus/precios` no se exponen por el gateway.
- Primera llamada tras el escalado del pod puede tardar unos segundos (arranque
  en frío).
- La app móvil no tiene `react-native-web`: no es desplegable como web.

## Documentación

- [`services/README.md`](services/README.md) — microservicios en local: rutas, reglas, invarianzas.
- [`docs/puesta_en_marcha_flujo_pedidos.md`](docs/puesta_en_marcha_flujo_pedidos.md) — flujo pago → preparación → retiro por QR de punta a punta.
- [`docs/despliegue_kubernetes_backend.md`](docs/despliegue_kubernetes_backend.md) — despliegue del backend en el clúster.
- [`docs/arquitectura-microservicios.md`](docs/arquitectura-microservicios.md) — Ingress, Secrets, réplicas y comunicación interna.
- Otros docs en [`docs/`](docs/): investigaciones por integrante, notificaciones push y por voz, pruebas del flujo de catálogo.

## Integrantes

- **Int 1**: App Móvil (Kotlin / React Native)
- **Int 2**: App Escritorio (React + Electron) + despliegue en K8s
- **Int 3**: Base de Datos (Supabase)
- **Int 4**: Servidor Node.js / microservicios
- **Int 5**: Escáner QR + Dashboard + Integración (KDS)