# Microservicios de CoffeeFast — entorno local

## Estándar de lenguaje

`ms-cafeterias`, `ms-menus`, `ms-pedidos` y `shared` usan JavaScript con CommonJS (`require` y `module.exports`) sobre Node.js 22. Los servicios HTTP usan Express. Su código ejecutable en `src/` se escribe en archivos `.js` y se ejecuta directamente con Node. CI revisa las extensiones del código fuente y valida su sintaxis.

Se adopta el lenguaje que comparten los tres servicios. Esto mantiene los mismos puntos de entrada, el paquete compartido y las imágenes Docker sin introducir una etapa de compilación. El estándar se aplica a estos microservicios y a `shared`. Las aplicaciones cliente y las funciones de Supabase tienen sus propios entornos.

Revisado el 11 de noviembre de 2026. Las apps utilizan el gateway para las operaciones de pedidos. La activación de compra y cancelación con stock en Cloud se registró el 1 de noviembre. Ver [estado funcional](../../estado-actual.md) y [procedimiento de entrega por digest](../../calidad/ci-cd/CI-CD.md).


Servicios Node/Express sobre Supabase, detrás de un gateway nginx. Todo corre
en Docker contra el Supabase local del host.

```
                    ┌──────────────┐
  apps ────────────▶│   gateway    │  nginx, puerto 8080
                    └──────┬───────┘
                           │  rutea por prefijo
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
 ┌───────────────┐  ┌─────────────┐  ┌───────────────┐
 │ ms-cafeterias │  │  ms-menus   │  │  ms-pedidos   │
 │    :3002      │  │    :3003    │  │     :3005     │
 └───────┬───────┘  └──────┬──────┘  └───────┬───────┘
         │                 │  POST /api/menus/precios
         │                 │  (solo desde la red interna)
         └─────────────────┴─────────────────┘
                           ▼
                  Supabase (en el HOST)
```

## Levantar

```bash
cd Microservices
cp .env.example .env      # y poner SUPABASE_SERVICE_KEY (ver abajo)
docker compose up --build
```

| Qué | URL |
|---|---|
| Gateway (lo que usan las apps) | `http://localhost:8080` |
| `GET /api/cafeterias` | `http://localhost:8080/api/cafeterias` |
| `GET /api/menus` | `http://localhost:8080/api/menus` |
| `GET /api/menus?cafeteria_id=1` | idem, filtrado |
| `POST /api/pedidos` | `http://localhost:8080/api/pedidos` |
| ms-cafeterias directo (debug) | `http://localhost:3002` |
| ms-menus directo (debug) | `http://localhost:3003` |
| ms-pedidos directo (debug) | `http://localhost:3005` |

Parar: `docker compose down`

## Identidad de ms-pedidos

La [matriz Local / Compose / Kubernetes](ms-pedidos-entornos-s2-t14.md)
documenta los dos clientes. Configurar tambien `SUPABASE_PUBLISHABLE_KEY`:
crear/listar pedidos y cancelar usan JWT del usuario, no service_role.

## SUPABASE_SERVICE_KEY es la clave de servidor del proyecto

`SUPABASE_SERVICE_KEY` es el nombre de la **clave de servidor (`service_role`)** 
del proyecto Supabase. No es la clave `publishable`/`anon`.

Se obtiene de:

```bash
supabase status      # -> "service_role key"
```

Por qué los servicios la necesitan y las apps no:

| | Rol | RLS | Quien la usa |
|---|---|---|---|
| `publishable` / `anon` | `anon` | se aplica | `app-mobile`, `app-desktop` |
| `service_role` | `service_role` | **se salta** | estos microservicios |

`service_role` omite RLS: las operaciones con ese cliente requieren autorizacion
de negocio antes de devolver o modificar informacion. Estar detras del gateway
no concede permisos; Compose publica puertos de depuracion. **Esta clave jamas
debe salir del backend.** Los clientes JWT conservan identidad para RLS/RPC.

Por eso:

- Va solo en `Microservices/.env`, que está en `.gitignore`.
- En Kubernetes va en el Secret `coffeesecret-supabase`, no en un manifiesto.
- Los `.example` versionados traen un marcador de posición, nunca una clave.
- Las apps **no** llevan esta clave: siguen con su `publishable`.

## Rutas

Públicas, por el gateway:

| Método | Ruta | Servicio |
|---|---|---|
| GET | `/api/cafeterias` | ms-cafeterias |
| GET | `/api/cafeterias/:id` | ms-cafeterias |
| GET | `/api/menus` | ms-menus |
| GET | `/api/menus/:id` | ms-menus |
| POST | `/api/pedidos` | ms-pedidos |
| GET | `/api/pedidos` | ms-pedidos |
| GET | `/api/pedidos/:id` | ms-pedidos |
| PATCH | `/api/pedidos/:id/estado` | ms-pedidos |
| POST | `/api/pedidos/validar-qr` | ms-pedidos |
| GET | `/api/afiliados/cafeterias/:cafeteriaId/campanas` | ms-pedidos (sesión estudiante) |
| GET | `/api/afiliados/cafeterias/:cafeteriaId/campanas/administracion` | ms-pedidos, listado del dueño |
| GET | `/api/afiliados/cafeterias/:cafeteriaId/campanas?postulables=true` | Reservado para C04; 501 explícito mientras no esté implementado |
| POST | `/api/afiliados/cafeterias/:cafeteriaId/campanas` | ms-pedidos |
| PATCH | `/api/afiliados/cafeterias/:cafeteriaId/campanas/:campanaId` | ms-pedidos |
| GET | `/gateway/health` | nginx (estático) |

Internas, **fuera** del gateway a propósito:

| Método | Ruta | La llama |
|---|---|---|
| POST | `/api/menus/precios` | ms-pedidos (por DNS interno) |

`POST /api/menus/precios` devuelve los precios **leídos de la base**, nunca los
que manda el cliente. Es la corrección del bug de que el cliente enviaba el
precio y el backend se lo creía. El nginx la bloquea con 404:

```bash
curl -X POST localhost:8080/api/menus/precios -d '{}'
# 404 {"error":"Ruta no expuesta por el gateway",...}
```

Para probarla hay que hablarle al servicio directo (`localhost:3003`) o desde
otro contenedor de la red.

## Reglas que sigue cada servicio

- **Un solo recurso.** `ms-cafeterias` expone cafeterias; `ms-menus`, productos;
  `ms-pedidos`, pedidos y afiliados. Cualquier otra ruta responde 404.
- **Sin mocks.** Si Supabase falla, la respuesta es `503` y no hay `data`. Un
  mock en el path esconde la base caída y le devuelve al cliente datos que no
  existen.
- **`/health` no consulta Supabase.** Así una caída de la base no reinicia el
  Pod en bucle. Readiness verifica el proceso, no la base.
- **`shared/` no se duplica.** Va como paquete local `@coffeefaster/shared`
  (`file:../shared`) y aporta el cliente de Supabase, `HttpError` con status,
  `auth` con `getUser(token)` y el cliente HTTP entre servicios (timeout 3 s,
  errores de red → `503`).
- **El catálogo no expone stock.** `ms-menus` nunca lee `stock` ni `stock_minimo`:
  esas columnas pertenecían a `ms-inventario`, que salió del stack.

## Tests

```bash
npm test --prefix ms-cafeterias
npm test --prefix ms-menus
npm test --prefix ms-pedidos
```

Las suites Jest aíslan dependencias como Supabase. CI Functional añade pruebas HTTP de catálogo con PostgREST y PostgreSQL aislado. La resolución de las dependencias de `shared` y los comandos de integración se describen en [CI/CD](../../calidad/ci-cd/CI-CD.md).

## Notas de implementación

**Contexto de build = `Microservices/`, no el servicio.** Cada Dockerfile copia
`shared/` de la carpeta padre. Por eso el `.dockerignore` que cuenta es
`Microservices/.dockerignore`: Docker solo lee el de la raíz del contexto. Los
`.dockerignore` dentro de cada servicio son inertes.

**`shared/` va como directorio real, no symlink.** `npm install` crea un symlink
para `file:../shared`, y con symlink Node resuelve las dependencias de `shared`
en `/usr/src/shared/node_modules` (que no existe) en vez de en las del servicio:
`MODULE_NOT_FOUND` en `@supabase/supabase-js`. El Dockerfile borra el symlink y
copia `shared/` dentro de `node_modules/@coffeefaster/shared`. Por eso cada
servicio declara `@supabase/supabase-js` en sus dependencias: es lo que permite
que se resuelva.

**`proxy_pass` sin barra final.** Con barra, nginx además de reemplazar el
prefijo elimina la parte del URI que coincide, y `/api/cafeterias/1` llegaría al
upstream como `/1`. Sin barra, el URI viaja intacto.

**Rutas internas bloqueadas antes que las públicas.** nginx matchea por prefijo y
gana el más corto, así que `location /api/menus` se comería
`/api/menus/precios`. Por eso la regla de bloqueo usa un ancla de fin de palabra
(`~ ^/api/menus/precios/?$`) y está declarada antes.

## Administración de campañas de afiliados

`ms-pedidos` expone el alta, la edición, el listado administrativo y los cambios de estado del [contrato C02](../../contratos-integracion-afiliados.md) en `/api/afiliados`. El dueño se identifica con su JWT: las RPC `administrar_campana_afiliados` y `listar_campanas_afiliados` usan `public.dueno_campana_id(p_cafeteria_id)`, la función de identidad de V05 que exige usuario y rol activos, y limitan la fila o el listado por cafetería. Los porcentajes y la vigencia quedan fijos desde el inicio; pausar y reanudar conserva condiciones, versión y aceptación.

La migración [administrar_campanas_afiliados.sql](../../../database/fixes/administrar_campanas_afiliados.sql) usa `public.campanas`, la tabla que consume escritorio. Agrega `tasa_descuento_oferta` como columna nullable, crea `siguiente_version_condiciones` y extiende el trigger V05 `proteger_confirmacion_campanas` para que la oferta participe en la inmutabilidad y en la exigencia de nueva versión. No modifica `confirmar_condiciones_campana` ni su restricción de vigencia. Las campañas existentes conservan `NULL` y no se modifica su aceptación. Los estados reales son `borrador`, `pendiente_aceptacion`, `aceptada`, `activa`, `pausada` y `finalizada`; la API deriva `programada` y publica el estado real en `estado_db`. La evidencia de solicitudes, códigos HTTP, SQL y RLS está en [S3-T3 · Administración de campañas de afiliados](../validacion/S3-T3-administracion-campanas-afiliados.md).

## Consulta de campañas vigentes para estudiantes

`GET /api/afiliados/cafeterias/:cafeteriaId/campanas` valida la sesión y llama con su JWT a `listar_oportunidades_campana(p_cafeteria_id)`. Requiere las migraciones `0023` y `0024` del repositorio de BD. La RPC comprueba estudiante activo y filtra cafetería activa, estado `activa` e inicio <= hora de consulta < fin. Devuelve `{"campanas":[]}` cuando no encuentra oportunidades; una RPC ausente o fallida devuelve `503`. No admite parámetros de consulta. El contrato y la evidencia están en [C04](../validacion/S3-T4-consulta-campanas-vigentes.md).
