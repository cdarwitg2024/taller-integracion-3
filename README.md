# CoffeeFast — Sistema de Pedidos para Cafeterías Universitarias

Aplicación full-stack para pedidos anticipados en cafeterías universitarias. Permite a los estudiantes realizar pedidos desde su dispositivo móvil, a los dueños administrar el negocio desde una app de escritorio y a los empleados gestionar la preparación y entrega mediante un sistema KDS con escaneo QR.

## Arquitectura

| Componente | Tecnología |
|---|---|
| App móvil | React Native + Expo |
| App de escritorio (KDS) | React + Vite + Electron + MUI |
| Microservicios (backend vigente) | Node.js / Express — gateway Nginx, ms-cafeterias, ms-menus, ms-pedidos |
| Base de datos | Supabase (PostgreSQL + Auth + Edge Functions) |
| Infraestructura | Docker Compose (local) / Kubernetes (producción) |

## Estructura del repositorio

```
/
├── app-mobile/              # App Android (React Native + Expo)
├── app-desktop/             # App de escritorio (React + Electron)
├── Microservices/           # Stack de microservicios vigente
│   ├── gateway/             # Proxy inverso Nginx
│   ├── ms-cafeterias/       # Servicio de cafeterías y catálogo
│   ├── ms-menus/            # Servicio de menús y productos
│   ├── ms-pedidos/          # Servicio de pedidos y pagos
│   ├── shared/              # Librería interna compartida
│   └── docker-compose.yml   # Orquestación local
├── k8s-next/                # Manifiestos Kubernetes (producción)
├── supabase/                # Edge Functions y configuración de Supabase
├── database/                # Migraciones y scripts SQL
├── BotTelegramCoffeFaster/  # Bot de alertas de stock (Python + FastAPI)
├── backend-node/            # Backend legacy (en retiro; ver docs/README.md)
└── docs/                    # Documentación del proyecto
```

## Requisitos previos

- Node.js 22, la versión usada por CI
- Docker Desktop (para levantar los microservicios localmente)
- Supabase CLI (para desarrollo de Edge Functions o migraciones)
- Expo CLI del proyecto móvil, disponible con `npx expo` después de instalar dependencias
- Variables de entorno configuradas (ver sección siguiente)

## Configuración de variables de entorno

### Microservicios

```bash
cd Microservices
cp .env.example .env
```

Completar en `Microservices/.env`:

```
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_SERVICE_KEY=<service_role key de Supabase>
SUPABASE_PUBLISHABLE_KEY=<anon/publishable key de Supabase>
GATEWAY_PORT=8080
```

### App de escritorio

La configuración Vite carga los `.env` de la **raíz del repositorio**. Completar `.env` en la raíz con las credenciales del proyecto Supabase.

### App móvil

Crear `app-mobile/.env` desde su ejemplo. `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` corresponden al proyecto Supabase. Para un gateway local, configurar `EXPO_PUBLIC_API_URL` con `http://10.0.2.2:8080` en el emulador Android o con la IP del PC y el puerto del gateway en un teléfono físico. Ver [guía móvil](docs/mobile/guias/react-native.md).

## Pasos para ejecutar la aplicación

### 1. Microservicios (backend)

```bash
cd Microservices
docker compose up --build
```

El gateway queda disponible en `http://localhost:8080`. Los microservicios individuales se exponen en los puertos 3002 (ms-cafeterias), 3003 (ms-menus) y 3005 (ms-pedidos) solo para depuración directa.

Para detener:

```bash
docker compose down
```

### 2. App de escritorio (KDS / panel de dueño)

```bash
cd app-desktop
npm ci --legacy-peer-deps
npm run electron:dev
```

Esto levanta Vite en el puerto 5173 y abre la ventana Electron apuntando a ese servidor de desarrollo.

Para construir el instalador:

```bash
npm run electron:build
```

### 3. App móvil

```bash
cd app-mobile
npm ci
npm run android   # dispositivo o emulador Android
# o
npm run start     # abre el servidor Expo para escanear con Expo Go
```

### 4. Bot de Telegram (opcional)

Ver la [guía del bot de Telegram](docs/bot-telegram/integracion/README.md).

## Roles y acceso

Las apps utilizan Supabase Auth. No hay cuentas de demostración integradas. Solicitar las credenciales de prueba por el canal del equipo; no versionar credenciales en el repositorio.

| Rol | Acceso |
|---|---|
| Dueno | Dashboard, gestión de productos, stock y resolución de solicitudes de reposición |
| Empleado | KDS, retiro por QR y solicitudes de reposición |
| Estudiante | App móvil — compra, consulta de pedidos y wallet |

## Despliegue en Kubernetes

Ver [`docs/kubernetes/operacion/DESPLIEGUE.md`](docs/kubernetes/operacion/DESPLIEGUE.md) para el procedimiento completo, requisitos previos y advertencias de seguridad.

> **Importante:** nunca usar `kubectl apply --recursive` sobre el árbol de manifiestos. Aplicar siempre archivo por archivo o por subcarpeta explícita para evitar sobrescribir Secrets del cluster con valores de plantilla.

## Documentación

| Documento | Descripcion |
|---|---|
| [`docs/README.md`](docs/README.md) | Indice y clasificacion de la documentacion |
| [`docs/microservicios/operacion/puesta_en_marcha_flujo_pedidos.md`](docs/microservicios/operacion/puesta_en_marcha_flujo_pedidos.md) | Guia completa para levantar el entorno y ejecutar el flujo de pedidos |
| [`docs/estado-actual.md`](docs/estado-actual.md) | Funcionalidades implementadas y pendientes |
| [`docs/kubernetes/estado-actual.md`](docs/kubernetes/estado-actual.md) | Estado del cluster Kubernetes |

## Ejecutar pruebas

Desde la raíz, con las dependencias instaladas:

```bash
npm test --prefix app-mobile -- --ci --runInBand
npm test --prefix app-desktop
npm test --prefix backend-node -- --ci --runInBand
npm test --prefix Microservices/ms-cafeterias -- --ci
npm test --prefix Microservices/ms-menus -- --ci
npm test --prefix Microservices/ms-pedidos -- --ci
```

Para resolver las dependencias de `shared` y ejecutar catálogo, PostgreSQL y Telegram, consultar [CI/CD](docs/calidad/ci-cd/CI-CD.md) y el [registro de validación](docs/calidad/validacion/revision-pruebas.md).

## Integrantes

| Integrantes |
Ariel Diaz
Diego Cordova
Diego Vasquez
Elias Caranza
Camilo Darwitg
