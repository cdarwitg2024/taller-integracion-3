# S3-T3 · Administración de campañas de afiliados en ms-pedidos

Implementación del módulo de afiliados de `ms-pedidos` para crear, editar, activar y pausar campañas. Sigue el [contrato C02](../../contratos-integracion-afiliados.md) y las [reglas del piloto](../../reglas-piloto-afiliados.md).

## Alcance

| Método | Ruta | Operación |
|---|---|---|
| POST | `/api/afiliados/cafeterias/:cafeteriaId/campanas` | Crea una campaña programada con los dos descuentos, la comisión y la vigencia |
| PATCH | `/api/afiliados/cafeterias/:cafeteriaId/campanas/:campanaId` | Edita campos antes del inicio o cambia el estado con `{"pausada":true}` / `{"pausada":false}` |

Ambas rutas exigen `Authorization: Bearer <sesion>`. `ms-pedidos` no confía en un `cafeteria_id` del cuerpo: toma el identificador de la ruta, crea un cliente de Supabase con el JWT del usuario y llama a la RPC `administrar_campana_afiliados`. La RPC es `SECURITY DEFINER`, comprueba `auth.uid()` y `es_dueno_cafeteria(p_cafeteria_id)`, y bloquea la fila por `id` y `cafeteria_id` antes de escribir.

## Archivos

- `Microservices/ms-pedidos/src/modules/afiliados/afiliados.routes.js`: validación del cuerpo, llamada a la RPC y traducción de errores a HTTP.
- `Microservices/ms-pedidos/src/cliente-autenticado.js`: cliente de Supabase con el JWT del usuario (`SUPABASE_PUBLISHABLE_KEY` o `SUPABASE_ANON_KEY`). También lo reutiliza `pedidos.service.js`, que antes duplicaba esa construcción.
- `Microservices/ms-pedidos/src/app.js`: monta `/api/afiliados`.
- `Microservices/ms-pedidos/tests/afiliados.test.js`: pruebas de rutas con Supertest y RPC simulada.
- `database/fixes/administrar_campanas_afiliados.sql`: tabla `campanas_afiliados`, RLS y RPC.
- `database/fixes/prueba_administrar_campanas_afiliados.sql`: prueba reproducible en PostgreSQL desechable.
- `Microservices/gateway/nginx.conf` y `k8s-next/gateway/nginx.conf`: exponen `/api/afiliados` hacia `ms-pedidos:3005`.

## Evidencia HTTP

Ejecutado el 15 de noviembre de 2026 en Windows con Node.js 22.23.5, la línea usada por CI, y repetido con Node.js 24.13.0; npm 11.6.2. Comando:

```powershell
npm test --prefix Microservices/ms-pedidos -- --ci
```

Resultado: **3 suites y 141 pruebas aprobadas**. La suite `afiliados.test.js` aporta 10 pruebas. Las respuestas siguientes son las verificadas por Supertest con la sesión del dueño y la RPC simulada:

| Caso | Solicitud | HTTP | Respuesta |
|---|---|---|---|
| Alta | `POST /api/afiliados/cafeterias/7/campanas` con `{"nombre":"Semana del café","descuento_normal_pct":15,"descuento_oferta_pct":5,"comision_pct":10,"inicio":"2099-12-01T08:00:00-03:00","fin":"2099-12-15T20:00:00-03:00"}` | 201 | `{"id":31,"cafeteria_id":7,"estado":"programada"}` |
| Edición previa al inicio | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"descuento_normal_pct":12}` | 200 | `{"id":31,"descuento_normal_pct":12}` |
| Pausa | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"pausada":true}` | 200 | `{"id":31,"estado":"pausada"}` |
| Reanudación | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"pausada":false}` | 200 | `{"id":31,"estado":"activa"}` |
| Dueño ajeno edita | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"descuento_normal_pct":12}` y sesión de otra cafetería | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Dueño ajeno activa | Misma ruta con `{"pausada":false}` y sesión de otra cafetería | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Porcentajes fijados | `PATCH` con `{"descuento_normal_pct":12}` después del inicio | 409 | `{"error":"porcentajes_fijados"}` |
| Campaña finalizada | `PATCH` con `{"pausada":false}` después del término | 409 | `{"error":"campana_finalizada"}` |
| Sin sesión | `POST` o `PATCH` sin `Authorization` | 401 | Error de autenticación del middleware compartido |
| Cuerpo inválido | `PATCH` con `{"cafeteria_id":8}` | 422 | `{"error":"campana_invalida"}`; la RPC no se invoca |

## Evidencia SQL

Ejecutado el 15 de noviembre de 2026 en un contenedor desechable `postgres:15`. El repositorio debe montarse y el comando debe ejecutarse con `/repo` como directorio de trabajo; de lo contrario falla el `\i` que carga la migración:

```powershell
# Desde la raíz del repositorio en PowerShell.
docker run -d --rm --name cf-s3t3-pg -e POSTGRES_PASSWORD=test -v "${PWD}:/repo" postgres:15
Start-Sleep -Seconds 5
docker exec -w /repo cf-s3t3-pg psql -U postgres -v ON_ERROR_STOP=1 -f database/fixes/prueba_administrar_campanas_afiliados.sql
$code = $LASTEXITCODE
docker rm -f cf-s3t3-pg
if ($code -ne 0) { throw "La prueba SQL falló con código $code" }
```

El script crea cafeterías, usuarios, roles y la función `es_dueno_cafeteria` con la misma lógica de `gestion_promociones_cafeteria.sql`, aplica la migración y ejecuta los casos. Salió con código 0 y estos datos de entrada/salida:

| Entrada | Salida |
|---|---|
| `administrar_campana_afiliados(7, NULL, '{"nombre":"Semana del café","descuento_normal_pct":15,"descuento_oferta_pct":5,"comision_pct":10,"inicio":"2099-12-01T08:00:00-03:00","fin":"2099-12-15T20:00:00-03:00"}')` | Campaña `1` con `estado = programada` |
| `administrar_campana_afiliados(7, 1, '{"descuento_normal_pct":12}')` | `descuento_normal_pct = 12` |
| `administrar_campana_afiliados(7, 1, '{"pausada":true}')` | `estado = pausada` |
| Sesión del dueño de la cafetería 8 sobre la campaña de la cafetería 7, con `{"nombre":"Ajena"}` y `{"pausada":false}` | `sin_acceso_cafeteria` (`insufficient_privilege`) |
| Sesión de un empleado de la cafetería 7 sobre la misma campaña | `sin_acceso_cafeteria` (`insufficient_privilege`) |
| `administrar_campana_afiliados(7, 1, '{"descuento_normal_pct":20}')` después del inicio | `porcentajes_fijados` |
| `administrar_campana_afiliados(7, 1, '{"pausada":false}')` dentro de la vigencia | `estado = activa`, con el descuento `12` conservado |
| `administrar_campana_afiliados(7, 1, '{"pausada":false}')` después del término | `campana_finalizada` |

## Dependencias y pendientes

- La migración requiere `public.es_dueno_cafeteria(bigint)`, creada por `database/fixes/gestion_promociones_cafeteria.sql`.
- Se usa una tabla `campanas_afiliados` separada de `campanas` (condiciones de carrito completo) porque C02 define dos descuentos y otro ciclo de estado. La integración con el esquema definitivo de V05 queda pendiente.
- No se implementó el listado `GET /campanas?postulables=true` ni los avisos a afiliados; corresponden a las tareas de solicitudes y vigencia.
- La prueba SQL simula `auth.uid()` mediante `request.jwt.claim.sub`. Falta la prueba integrada con Supabase Auth, RLS y el gateway en un entorno desechable.
- No se aplicó SQL en Cloud ni se desplegó en Kubernetes para esta tarea.
