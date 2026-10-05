# Microservicios de CoffeeFast — entorno local

Servicios Node/Express sobre Supabase, detrás de un gateway nginx. Todo corre
en Docker contra el Supabase local del host.

```
                    ┌──────────────┐
  apps ────────────▶│   gateway    │  nginx, puerto 8080
                    └──────┬───────┘
                           │  rutea por prefijo
              ┌────────────┴─────────────┐
              ▼                          ▼
      ┌───────────────┐          ┌───────────────┐
      │ ms-cafeterias │          │   ms-menus    │
      │    :3002      │          │     :3003     │
      └───────┬───────┘          └───────┬───────┘
              │                          │  POST /api/menus/precios
              │                          │  (solo desde la red interna)
              └────────────┬─────────────┘
                           ▼
                  Supabase (en el HOST)
```

## Levantar

```bash
cd services
cp .env.example .env      # y poner SUPABASE_SERVICE_KEY (ver abajo)
docker compose up --build
```

| Qué | URL |
|---|---|
| Gateway (lo que usan las apps) | `http://localhost:8080` |
| `GET /api/cafeterias` | `http://localhost:8080/api/cafeterias` |
| `GET /api/menus` | `http://localhost:8080/api/menus` |
| `GET /api/menus?cafeteria_id=1` | idem, filtrado |
| ms-cafeterias directo (debug) | `http://localhost:3002` |
| ms-menus directo (debug) | `http://localhost:3003` |

Parar: `docker compose down`

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

`service_role` salta la RLS. Es lo correcto acá porque los servicios son la
capa de confianza del backend: corren detrás del gateway, no se exponen al
usuario final, y sus consultas no dependen de que exista una política de RLS
para cada tabla nueva. La contraprestada es que **esta clave jamás debe salir del
backend**: si llega a un cliente, cualquiera puede leer y escribir la base
entera saltándose la RLS.

Por eso:

- Va solo en `services/.env`, que está en `.gitignore`.
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

- **Un solo recurso.** `ms-cafeterias` expone cafeterias; `ms-menus`, productos.
  Cualquier otra ruta responde 404.
- **Sin mocks.** Si Supabase falla, la respuesta es `503` y no hay `data`. Un
  mock en el path esconde la base caída y le devuelve al cliente datos que no
  existen.
- **`/health` no consulta Supabase.** Así una caída de la base no reinicia el
  Pod en bucle. Readiness verifica el proceso, no la base.
- **`shared/` no se duplica.** Va como paquete local `@coffeefaster/shared`
  (`file:../shared`) y aporta el cliente de Supabase, `HttpError` con status,
  `auth` con `getUser(token)` y el cliente HTTP entre servicios (timeout 3 s,
  errores de red → `503`).
- **Stock es de ms-inventario.** `ms-menus` nunca lee `stock` ni `stock_minimo`:
  el catálogo y el inventario no pueden tener dos verdades de la misma fila.

## Tests

```bash
npm test --prefix ms-cafeterias
npm test --prefix ms-menus
```

Mockean `obtenerCliente`, así que no tocan la base real.

## Notas de implementación

**Contexto de build = `services/`, no el servicio.** Cada Dockerfile copia
`shared/` de la carpeta padre. Por eso el `.dockerignore` que cuenta es
`services/.dockerignore`: Docker solo lee el de la raíz del contexto. Los
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