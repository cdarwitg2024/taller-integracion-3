# S3-T4 / C04 — Consulta de campañas vigentes

## Contrato implementado

`GET /api/afiliados/cafeterias/:cafeteriaId/campanas`, con `Authorization: Bearer <sesion-estudiante>`. Sin cuerpo ni parámetros de consulta. Identificador entero positivo representable con seguridad en JavaScript.

El middleware valida el token con Supabase Auth. El [cliente autenticado](../../../Microservices/ms-pedidos/src/cliente-autenticado.js) usa la clave publishable/anon y el JWT del usuario para ejecutar exclusivamente:

```js
cliente.rpc('listar_oportunidades_campana', { p_cafeteria_id: cafeteriaId });
```

La RPC oficial del repositorio `db_CoffeeFaster`, migraciones `0023` y `0024`, obtiene `auth.uid()` y comprueba usuario y rol estudiante activos. La `0024` exige cafetería activa, campaña con estado `activa` e inicio inclusivo / fin exclusivo. Excluye futuras, pausadas, vencidas, borradores, finalizadas, `pendiente_aceptacion` y `aceptada`. El orden de BD se conserva: `vigencia_desde, id`.

Se contrastó con `supabase/migrations/0024_s3_t4_rpc_campanas_vigentes.sql` y `docs/S3-T4-contrato-bd-cloud.md` del repositorio hermano. La integración de BD reportada en `main` es `07b5a6aaad2a1ea8eb73ae5dbce5af9db02d16f2`. No se copian migraciones al repositorio de aplicación. Las dependencias de identidad y campañas se resuelven en BD; V05 solo interviene si se amplía a estado de solicitudes, fuera de esta consulta.

Se conservan los once campos oficiales devueltos por la RPC, sin convertir tasas o fechas a los alias externos de POST/PATCH. `tipo` identifica el alcance de la campaña (`carrito_completo`); `cafeteria_id` y `cafeteria_nombre` identifican el negocio.

## Evidencia HTTP automatizada

Ejecutado el 17 de noviembre de 2026 en Windows, Node.js **22.23.5**, Jest y Supertest. HTTP de Express real en loopback; Supabase Auth y RPC **simulados**. No demuestra firma de JWT, PostgREST ni filtros SQL ejecutados. La fecha y el resultado de la campaña siguiente son fixtures de la prueba.

Entrada:

```http
GET /api/afiliados/cafeterias/7/campanas
Authorization: Bearer sesion-estudiante
```

Salida comprobada: **HTTP 200**.

```json
{
  "campanas": [{
    "id": 31,
    "nombre": "Semana del café",
    "cafeteria_id": 7,
    "cafeteria_nombre": "Cafetería A",
    "tipo": "carrito_completo",
    "estado": "activa",
    "vigencia_desde": "2026-11-01T00:00:00Z",
    "vigencia_hasta": "2026-12-01T00:00:00Z",
    "tasa_descuento": 12.5,
    "tasa_comision": 8,
    "estado_vigencia": "en_curso"
  }]
}
```

| Caso comprobado | HTTP / resultado |
|---|---|
| RPC devuelve `[]` | `200 {"campanas":[]}` |
| Sin sesión o token rechazado por Auth simulado | `401`, sin llamada RPC |
| ID cero, negativo, decimal, texto o fuera de rango seguro | `400`, sin llamada RPC |
| `?postulables=true`, `?usuario_id=9` o `?cafeteria_id=8` | `400`, sin llamada RPC |
| RPC rechaza cuenta/rol (`42501`) | `403`, `error: estudiante_requerido` |
| RPC rechaza parámetro (`22023`) | `400`, `error: identificador_invalido` |
| Sesión inválida en PostgREST (`PGRST301`, `PGRST303`, `28000`) | `401` |
| RPC inexistente (`PGRST202`), error desconocido o red caída | `503`, sin campañas ni detalles privados |
| RPC devuelve null, objeto o undefined | `503`; no se oculta como lista vacía |

Comando ejecutado desde la raíz, usando Node 22 mediante npm exec y la configuración Jest del servicio:

```powershell
npm exec --yes --package=node@22 -- node Microservices/ms-pedidos/node_modules/jest/bin/jest.js --config Microservices/ms-pedidos/jest.config.js --ci --runInBand --silent
```

Resultado: **4 suites, 162 pruebas aprobadas**, incluidas **21 nuevas** en [oportunidades.test.js](../../../Microservices/ms-pedidos/tests/oportunidades.test.js). Se ejecutaron fuera del sandbox porque las conexiones locales de Supertest dentro de él fallaban con `connect EACCES 127.0.0.1`. La primera ejecución con Node 24 quedó bloqueada por esa restricción; no se considera validación funcional.

## Evidencia HTTP con sesión real en Cloud

Ejecutado el **17 de noviembre de 2026 a las 18:16:54, America/Santiago** (`2026-11-17T21:16:54.510Z`), con Node 22.23.5. El usuario inició sesión manualmente con una cuenta estudiante en Supabase Auth del proyecto `integracion3` (`yvkpmqcynpygqjvaoiwn`). La contraseña se envió directamente desde el navegador a Auth; el JWT se utilizó transitoriamente y no se guardó en archivos ni en esta evidencia.

Se ejecutó la aplicación Express de esta rama en loopback contra **Supabase Auth y PostgREST reales de Cloud**, usando clave pública y JWT estudiantil, sin mocks ni service_role para la consulta.

```http
GET /api/afiliados/cafeterias/1/campanas
Authorization: Bearer <omitido>

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"campanas":[]}
```

| Solicitud real | Resultado |
|---|---|
| GET anterior con JWT estudiantil | `200 {"campanas":[]}` |
| Mismo GET sin Authorization | `401` |
| `GET /api/afiliados/cafeterias/0/campanas` con JWT estudiantil | `400` |

El resultado vacío coincide con el conteo directo de cero campañas en Cloud y la cafetería activa ID 1. Se verificaron la ruta, validación de JWT real, autorización de estudiante en la RPC y formato de respuesta. No se insertaron campañas ficticias, no se reaplicaron migraciones y no se alteraron datos de negocio. La comprobación no pasó por Nginx ni por un servicio desplegado; se ejecutó el código local de esta rama contra Cloud.

## Corrección de integración con C03 y CI

Tras integrar los cambios de administración de `develop`, CI detectó la pérdida de `GET .../campanas/administracion` y expectativas antiguas de `501` para la consulta estudiantil. Se incorporó por fast-forward el commit remoto `95e4278` que restaura la ruta administrativa y se completó la corrección local:

- El listado administrativo conserva `listar_campanas_afiliados`, el JWT del dueño, el mapeo de columnas/alias y la traducción de errores de negocio existente en C03. Un error SQL no reconocido sigue siendo `503`, sin convertir cualquier `42501` de infraestructura en un rechazo de negocio.
- El GET estudiantil conserva exclusivamente `listar_oportunidades_campana` y el contrato oficial de C04.
- Las pruebas unitarias y el runner funcional reemplazan las expectativas del endpoint reservado (`501`) por el rechazo actual de `?postulables=true` (`400`), sin ejecutar la consulta administrativa.

Revalidación del 17 de noviembre de 2026 en Windows con Node 22.23.5:

| Comprobación | Resultado |
|---|---|
| Jest de ms-pedidos, configuración del servicio | 4 suites y **178 pruebas aprobadas**, incluidas las 21 de C04 |
| [Runner funcional de afiliados](../../../.github/scripts/test-afiliados-auth-integration.cjs) | **12 escenarios aprobados**, PostgreSQL 15, GoTrue, PostgREST y Nginx desechables; JWT real y RLS |
| `verify-unit-sensitivity.cjs ms-pedidos` | Defecto funcional detectado en copia temporal |
| Dockerfile de ms-pedidos | Build local aprobado; imagen `coffeefast/ms-pedidos:ci-c04-local`, sin publicación |
| Sintaxis JavaScript y `git diff --check` | Aprobados |

En Windows la primera ejecución del runner funcional finalizó antes de completar Auth y no se contó como aprobada. La ejecución completa utilizó un intervalo de espera en un wrapper de Node, liberado al registrar el resultado final, sin modificar el runner para CI. Se eliminaron los recursos desechables de ambas ejecuciones. Esta revalidación no accedió a Cloud ni a la BD local existente; los checks de GitHub deberán repetirse al publicar los cambios.

## Límites y pendientes

- Filtrado SQL y actualización `0023` → `0024`: evidencia del repositorio de BD, reportada por OpenCode en PostgreSQL 17.11 desechable; no se volvió a ejecutar aquí. Las pruebas HTTP nuevas comprueban delegación y contrato, no sustituyen esa prueba SQL.
- Cloud: nueva inspección directa del 17 de noviembre confirma `0001`–`0024` y las migraciones `20261117175958`/`20261117184822` ya registradas. La RPC existe y su definición coincide con el filtro de `0024`. Hay cero campañas y una cafetería activa (ID 1). No se reaplicaron migraciones ni se insertaron datos.
- Permisos efectivos comprobados en Cloud: `authenticated` tiene EXECUTE; `anon` y `service_role` no. La función es SECURITY DEFINER con `search_path=''` y `campanas` conserva RLS habilitada.
- Sesión real y lista vacía verificadas arriba. No se acredita despliegue del servicio, prueba del gateway ni filtrado de campañas con datos reales en Cloud: la exclusión de pausadas/vencidas se acredita con las pruebas SQL desechables del repositorio de BD y la definición de `0024` inspeccionada en Cloud.
- POST/PATCH y el GET administrativo usan la administración C03 sobre `public.campanas`, con sus propios alias externos. C04 no utiliza esa RPC administrativa ni mezcla sus permisos o mapeos con la lectura estudiantil.

Ver [contrato C02](../../contratos-integracion-afiliados.md) y [operación](../operacion/README.md).
