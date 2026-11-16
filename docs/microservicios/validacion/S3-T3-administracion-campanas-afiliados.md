# S3-T3 · Administración de campañas de afiliados en ms-pedidos

Implementación corregida el 16 de noviembre de 2026 para administrar campañas del [contrato C02](../../contratos-integracion-afiliados.md) y las [reglas C01](../../reglas-piloto-afiliados.md) sobre `public.campanas`, la tabla que consume escritorio. Reemplaza el diseño provisional de `campanas_afiliados`; no crea otra tabla, no duplica datos y no elimina registros existentes.

La referencia de esquema es la definición V05 de `db_CoffeeFaster`: migraciones `0018_crear_esquema_campanas.sql`, `0019_asegurar_aceptacion_campanas.sql` y la identidad de `0021_autorizar_solicitudes_afiliacion.sql` (`u.activo AND r.activo`). La prueba SQL reproduce esas definiciones; no usa un trigger simplificado.

## Alcance

| Método | Ruta | Operación |
|---|---|---|
| GET | `/api/afiliados/cafeterias/:cafeteriaId/campanas` | Listado administrativo del dueño, limitado a su cafetería |
| POST | `/api/afiliados/cafeterias/:cafeteriaId/campanas` | Crea una campaña con los dos descuentos, la comisión y la vigencia |
| PATCH | `/api/afiliados/cafeterias/:cafeteriaId/campanas/:campanaId` | Edita condiciones o cambia el estado con `{"pausada":true}` / `{"pausada":false}` |

Las tres rutas exigen `Authorization: Bearer <sesion>`. `ms-pedidos` no acepta un `cafeteria_id` del cuerpo: toma el identificador de la ruta, crea un cliente de Supabase con el JWT del usuario y llama a una RPC `SECURITY DEFINER`. La RPC usa `public.dueno_campana_id(p_cafeteria_id)`, la misma función de identidad de V05, y limita la fila o el listado por cafetería. No se usa `service_role` como sustituto de autorización. El GET es administrativo: no implementa el listado estudiantil de C04 ni `postulables=true`.

## Integración exacta con V05

### `dueno_campana_id` es una función, no una columna

`public.dueno_campana_id(bigint)` devuelve el `usuarios.id` del dueño a partir de `auth.uid()`. La definición exacta usa `SET search_path = ''`, referencias calificadas y exige `u.activo AND r.activo`, además del rol `dueño`/`dueno` y la cafetería. No existe una columna `campanas.dueno_campana_id` y la migración no la crea. Las RPC nuevas usan la función para autorizar. La prueba SQL reproduce esa definición y comprueba que un dueño activo con rol inactivo es rechazado en alta, edición, activación y listado.

### Mapeo C02 → esquema real

| C02 | `public.campanas` | Tratamiento |
|---|---|---|
| `descuento_normal_pct` | `tasa_descuento` | Se conserva el nombre externo y se escribe la columna real |
| `descuento_oferta_pct` | `tasa_descuento_oferta` | Columna nueva, nullable. No se rellena en campañas existentes |
| `comision_pct` | `tasa_comision` | Se conserva el nombre externo y se escribe la columna real |
| `inicio` | `vigencia_desde` | Fecha ISO 8601 con zona horaria |
| `fin` | `vigencia_hasta` | Fecha ISO 8601 con zona horaria |
| `estado: programada` | `pendiente_aceptacion` o `aceptada` | La API deriva `programada` y publica el estado real en `estado_db` |

La respuesta conserva las columnas que lee `app-desktop/src/services/campanasService.js` y agrega los alias de C02. El escritorio sigue leyendo `public.campanas` directamente; no se cambió su contrato.

### Estados

`public.campanas` no admite `programada`. La vista externa usa estas equivalencias:

| Estado externo | Estado real | Significado |
|---|---|---|
| `programada` | `pendiente_aceptacion` | Creada, aún sin aceptación |
| `programada` | `aceptada` | Aceptada y aún no iniciada |
| `programada` | `borrador` | Campaña heredada en borrador |
| `activa` | `activa` | Vigente y habilitada |
| `pausada` | `pausada` | Condiciones conservadas y sin aplicar a compras nuevas |
| `finalizada` | `finalizada` o `vigencia_hasta <= now()` | No se reactiva |

Pausar y reanudar solo cambian `estado` y `actualizado_en`. No tocan tasas, fechas, versión, `confirmada_por_dueno`, `fecha_confirmacion`, `usuario_confirma_id` ni `version_confirmada`.

## Versionado de condiciones

`public.campanas.version_condiciones` es `varchar(20)`. La migración agrega `public.siguiente_version_condiciones(text)`, que solo puede ejecutar el propietario de la migración; el cliente no envía ni elige la versión.

- Formato normal: incremento del componente menor de `MAJOR.MINOR` (`1.0 → 1.1`, `1.9 → 1.10`).
- Respaldo: `YYYYMMDDHH24MISSUS` (20 caracteres) si la versión no tiene ese formato o el incremento excedería la columna. V05 solo exige que el texto cambie.
- La versión se actualiza en la misma sentencia que las condiciones, bajo `FOR UPDATE`, para que el trigger vea `NEW.version_condiciones` distinto de `OLD.version_condiciones`.
- No cambia al pausar, reanudar ni enviar valores idénticos. La comparación usa los valores normalizados que realmente se guardan.

El trigger V05 `proteger_confirmacion_campanas` exige una versión nueva cuando cambian `nombre`, `descripcion`, `tasa_descuento`, `tasa_comision`, `vigencia_desde` o `vigencia_hasta`. La migración extiende esa misma regla para incluir `tasa_descuento_oferta`. También la incluye en la comparación de inmutabilidad posterior a la aceptación. No se relaja ninguna protección original: se conserva la prohibición de escrituras directas de `authenticated`/`anon`, los mensajes y el `SQLSTATE 22023` de V05.

## Aceptación V05 y conflicto con C02

`public.confirmar_condiciones_campana(bigint, bigint, text)` no se modifica. Conserva:

- La firma de tres argumentos.
- La identidad mediante `auth.uid()` y `dueno_campana_id`.
- La exigencia de que la versión enviada coincida con la versión vigente.
- La restricción de vigencia: `estado IN ('pendiente_aceptacion','activa')`, `vigencia_desde <= now()` y `vigencia_hasta > now()`.
- La actualización de `estado = 'activa'`, `confirmada_por_dueno`, `fecha_confirmacion`, `usuario_confirma_id` y `version_confirmada`.

**Diferencia pendiente con C02:** C02 describe una campaña futura que el dueño acepta antes del inicio. V05 no permite aceptar una campaña antes de `vigencia_desde`. La implementación no modifica esa restricción. Una campaña creada por C03 con inicio futuro queda en `pendiente_aceptacion` y no puede aceptarse hasta que comience su vigencia. La prueba SQL verifica ese rechazo con la RPC real. Si el negocio necesita aceptación anticipada, debe decidirse y cambiarse V05 de forma coordinada; no se simula aquí.

Una campaña confirmada es inmutable. La RPC nueva detecta cambios de `nombre`, `descripcion`, tasas, oferta y fechas, y devuelve `409 {"error":"condiciones_aceptadas"}`. El trigger también rechaza la escritura directa con `SQLSTATE 22023`.

## Archivos

- `Microservices/ms-pedidos/src/modules/afiliados/afiliados.routes.js`: validación, llamada a las RPC, mapeo C02 ↔ `public.campanas` y traducción de errores a HTTP.
- `Microservices/ms-pedidos/src/cliente-autenticado.js`: cliente de Supabase con el JWT del usuario.
- `Microservices/ms-pedidos/src/app.js`: monta `/api/afiliados`.
- `Microservices/ms-pedidos/tests/afiliados.test.js`: 25 pruebas de rutas con Supertest y una RPC en memoria.
- `database/fixes/administrar_campanas_afiliados.sql`: migración sobre `public.campanas`; agrega el descuento de oferta, el versionado y las RPC administrativas, y extiende el trigger V05.
- `database/fixes/prueba_administrar_campanas_afiliados.sql`: prueba SQL/RLS con las definiciones V05 reales, la identidad exacta de 0021 y el ciclo completo de una campaña.
- `app-desktop/src/services/campanasService.js`: incluye `tasa_descuento_oferta` en la lectura de `campanas`.
- `app-desktop/src/pages/dueno/CondicionesCampana.jsx`: muestra por separado descuento normal, descuento para ofertas y comisión; `NULL` aparece como «No especificado».
- `app-desktop/src/utils/condicionesCampana.js`: la clave de consentimiento incluye la tasa de oferta.
- `app-desktop/tests/campanas.test.cjs`: 13 pruebas de campañas, incluidas lectura de la nueva columna y presentación de la tasa nula.
- `Microservices/gateway/nginx.conf` y `k8s-next/gateway/nginx.conf`: exponen `/api/afiliados` hacia `ms-pedidos:3005`; una prueba de `ms-pedidos` verifica ambas configuraciones.

## Evidencia HTTP

Ejecutado el 16 de noviembre de 2026 en Windows con Node.js 22.23.5:

```powershell
npm test --prefix Microservices/ms-pedidos -- --ci
```

Resultado real: **3 suites y 156 pruebas aprobadas**. `afiliados.test.js` aporta **25 pruebas**. La RPC está simulada en memoria: estas pruebas verifican el contrato HTTP, la sesión, el alcance por cafetería, el mapeo de campos, el versionado del doble y los códigos de error, pero no sustituyen una prueba contra Supabase Auth/RLS.

| Caso | Solicitud | HTTP | Respuesta verificada |
|---|---|---|---|
| Alta | `POST /api/afiliados/cafeterias/7/campanas` con los dos descuentos, comisión y vigencia | 201 | `{"id":1,"cafeteria_id":7,"estado":"programada","estado_db":"pendiente_aceptacion","descuento_normal_pct":15,"descuento_oferta_pct":5,"comision_pct":10,"version_condiciones":"1.0","confirmada_por_dueno":false,...}` |
| Lectura de la misma campaña | `GET /api/afiliados/cafeterias/7/campanas` | 200 | `{"campanas":[{"id":1,"cafeteria_id":7,"estado":"programada","estado_db":"pendiente_aceptacion","descuento_normal_pct":15,"descuento_oferta_pct":5,...}]}` |
| Edición de condiciones | `PATCH` con `{"nombre":"Semana editada","descuento_normal_pct":12}` | 200 | `{"version_condiciones":"1.1","descuento_normal_pct":12,"descuento_oferta_pct":5,...}` |
| Valores idénticos | `PATCH` con los mismos valores | 200 | Conserva `version_condiciones: "1.0"` |
| Solo oferta | `PATCH` con `{"descuento_oferta_pct":6}` | 200 | `{"version_condiciones":"1.1","descuento_oferta_pct":6,...}` |
| Condiciones aceptadas | `PATCH` con nombre, descripción, tasas o fechas sobre una campaña aceptada | 409 | `{"error":"condiciones_aceptadas"}`; no cambia la fila |
| Pausa | `PATCH` con `{"pausada":true}` | 200 | `{"estado":"pausada","estado_db":"pausada",...}` con versión y condiciones conservadas |
| Reanudación futura | `PATCH` con `{"pausada":false}` antes del inicio | 200 | `{"estado":"programada","estado_db":"aceptada",...}` |
| Reanudación activa | `PATCH` con `{"pausada":false}` dentro de la vigencia | 200 | `{"estado":"activa","estado_db":"activa",...}` |
| Activación sin aceptación | `PATCH` con `{"pausada":false}` sobre `pendiente_aceptacion` | 409 | `{"error":"aceptacion_requerida"}` |
| Campaña finalizada | `PATCH` con `{"pausada":false}` después del término | 409 | `{"error":"campana_finalizada"}` |
| Dueño ajeno | `PATCH /cafeterias/7/...` con sesión de la cafetería 8 | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Empleado | `PATCH /cafeterias/7/...` con sesión de empleado | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Campaña ajena con cafetería propia en la URL | `PATCH /cafeterias/8/campanas/1` con sesión de la cafetería 8 y campaña de la 7 | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Listado ajeno | `GET /cafeterias/7/campanas` con sesión de la cafetería 8 | 403 | `{"error":"sin_acceso_cafeteria"}` |
| Sin sesión o sesión inválida | `POST`, `GET` o `PATCH` sin `Authorization` o con token inválido | 401 | La prueba mockea el middleware con `{"error":"sesion_invalida"}`; el middleware real responde 401 con su propio mensaje |
| Cuerpo inválido | Campos desconocidos, `version_condiciones` del cliente, oferta mayor, fechas invertidas o porcentaje como texto | 422 | `{"error":"campana_invalida"}`; la RPC no se invoca |
| Identificador inválido | `GET /cafeterias/0/...`, `POST /cafeterias/abc/...` o `PATCH .../campanas/0` | 400 | `identificador_invalido`; la RPC no se invoca |
| Mensaje 22023 del trigger | `"La aceptación es inmutable; cree una nueva campaña para otras condiciones"` | 409 | `{"error":"condiciones_aceptadas"}` |
| Mensaje 22023 de versión | `"Cambiar condiciones requiere una nueva versión"` | 422 | `{"error":"campana_invalida"}` |
| Fallo inesperado | Error no clasificado (por ejemplo `42501` de infraestructura) | 503 | No se convierte en conflicto de negocio |

## Evidencia SQL/RLS

Ejecutado el 16 de noviembre de 2026 en un contenedor desechable `postgres:15`, con el repositorio montado en `/repo`. El script crea las definiciones V05 0018/0019 y la identidad exacta de 0021, inserta fixtures y aplica la migración C03. La identidad se simula con `request.jwt.claim.sub`; los privilegios, RLS, trigger y RPC de aceptación son los reales.

```powershell
docker run -d --rm --name cf-s3t3-pg -e POSTGRES_PASSWORD=test -v "${PWD}:/repo" postgres:15
Start-Sleep -Seconds 4
docker exec -w /repo cf-s3t3-pg psql -U postgres -v ON_ERROR_STOP=1 -f database/fixes/prueba_administrar_campanas_afiliados.sql
docker rm -f cf-s3t3-pg
```

Resultado real: **código 0**. Salidas observadas:

| Caso | Entrada | Salida observada |
|---|---|---|
| Esquema | Columnas y funciones de V05 | No existe columna `dueno_campana_id`; sí existe la función; el trigger conserva `current_user IN ('authenticated','anon')` y contiene `tasa_descuento_oferta` |
| Campaña previa | Fixture aceptado con `tasa_descuento=10`, `tasa_comision=3` | `tasa_descuento=10.00`, `tasa_comision=3.00`, `tasa_descuento_oferta=null`, `version_condiciones="1.0"`, `version_confirmada="1.0"` |
| Versión normal | `siguiente_version_condiciones('1.0')` | `1.1` |
| Versión menor doble | `siguiente_version_condiciones('1.9')` | `1.10` |
| Versión no numérica | `siguiente_version_condiciones('foo')` | `YYYYMMDDHH24MISSUS` de 20 caracteres (observado: `20261116215543229997`) |
| Alta C03 | `administrar_campana_afiliados(7, NULL, {...15, 5, 10...})` | `id=7`, `estado="pendiente_aceptacion"`, `version_condiciones="1.0"`, `tasa_descuento=15.00`, `tasa_descuento_oferta=5.00`, `tasa_comision=10.00`, `confirmada_por_dueno=false` |
| Lectura | `listar_campanas_afiliados(7)` | Incluye la campaña creada y las fixtures de la cafetería 7; ninguna de la 8 |
| Listado de la cafetería 8 | `listar_campanas_afiliados(8)` | Solo campañas de la cafetería 8 |
| Edición | `{"nombre":"Semana del café editada","descripcion":"Descripción editada","descuento_normal_pct":12}` | `version_condiciones="1.1"`, tasas `12/5/10` |
| Idénticos | Los mismos valores y los mismos porcentajes | Conserva `version_condiciones="1.1"` |
| Solo oferta | `{"descuento_oferta_pct":6}` | `version_condiciones="1.2"`, `tasa_descuento_oferta=6.00` |
| Comisión, fechas, descripción | Cambios sucesivos | Versiones `1.3`, `1.4`, `1.5`; nombre con espacios normalizado no versiona |
| Aceptación con versión anterior | `confirmar_condiciones_campana(3, 7, '0.9')` | `22023`: `La versión cambió; revise las condiciones de nuevo` |
| Aceptación real | `confirmar_condiciones_campana(3, 7, '1.0')` | `estado="activa"`, `confirmada_por_dueno=true`, `version_confirmada="1.0"`, `usuario_confirma_id=1`, `fecha_confirmacion` no nula |
| Aceptación idempotente | La misma llamada | Devuelve la campaña confirmada sin duplicar |
| Aceptación futura | `confirmar_condiciones_campana(c03, 7, version vigente)` sobre la campaña C03 futura | `22023`: `La campaña no está vigente para aceptar condiciones` |
| RPC sobre aceptada | Nombre, descripción, tasas, oferta, comisión, inicio o fin | `condiciones_aceptadas`; la versión sigue en `1.0` |
| Trigger sobre aceptada | UPDATE directo de cada condición como escritor privilegiado | `22023`: `La aceptación es inmutable; cree una nueva campaña para otras condiciones` |
| Trigger, oferta pendiente | UPDATE directo de `tasa_descuento_oferta` sin versión | `22023`: `Cambiar condiciones requiere una nueva versión` |
| Trigger, oferta con versión | UPDATE de `tasa_descuento_oferta=4` y `version_condiciones='1.1'` | Permitido; oferta `4.00`, versión `1.1` |
| Escritura directa | `UPDATE` como `authenticated` | `42501`; `authenticated` solo tiene `SELECT` |
| Lectura anónima | `SELECT` como `anon` | `42501` |
| Pausa | `administrar_campana_afiliados(7, 3, '{"pausada":true}')` | `estado="pausada"`, versión `1.0`, tasas y aceptación conservadas |
| Reanudación | `{"pausada":false}` dentro de vigencia | `estado="activa"`, versión `1.0`, condiciones y aceptación conservadas |
| Finalizada | `{"pausada":false}` con `vigencia_hasta` vencida | `campana_finalizada` |
| Porcentajes tras inicio | `{"descuento_normal_pct":11}` sobre una campaña iniciada y pendiente | `porcentajes_fijados` |
| Nombre tras inicio | `{"nombre":"Nombre iniciado"}` | Permitido con nueva versión `1.1`; C02 no fija el nombre desde el inicio |
| Dueño ajeno | Dueño de la cafetería 8 sobre la 7 | `sin_acceso_cafeteria` (`42501`) |
| Empleado | Empleado de la cafetería 7 | `sin_acceso_cafeteria` (`42501`) |
| Dueño inactivo | Usuario 4, `activo=false` | `sin_acceso_cafeteria` (`42501`) |
| Dueño activo con rol inactivo | Usuario 5, rol 3 `activo=false`; alta, edición, activación y listado | `sin_acceso_cafeteria` (`42501`) en las cuatro operaciones |
| Ciclo completo C03 | Alta con inicio `+8 s`, edición `1.0 → 1.1`, aceptación antes de vigencia, espera acotada (límite 30 s), versión anterior, versión actual, pausa, reanudación y edición posterior | Aceptación antes de vigencia rechazada; versión anterior rechazada; versión actual aceptada; pausa/reanudación conservan tasas `12/5/10`, comisión, fechas, versión `1.1` y aceptación; edición posterior `condiciones_aceptadas` |
| Campaña ajena con URL propia | Dueño 8 con URL 8 y campaña 7 | `sin_acceso_cafeteria` (`42501`) |
| Sesión ausente | `listar_campanas_afiliados(7)` sin JWT simulado | `sin_acceso_cafeteria` (`42501`) |
| RLS de lectura | `SELECT` como dueño 8 | Cafetería 7: 0 filas; cafetería 8: 1 fila |
| RLS de empleado | `SELECT` como empleado | 0 filas visibles |
| Validaciones | Oferta 15 > normal 10, fin anterior al inicio, `version_condiciones` del cliente, `cafeteria_id` | `campana_invalida` |

**Límite:** `request.jwt.claim.sub` simula `auth.uid()` y las fixtures se insertan como `postgres`. La aceptación que se valida se ejecuta con `confirmar_condiciones_campana`; no se acepta con `UPDATE` ni con el trigger deshabilitado. La prueba no sustituye un JWT emitido por Supabase Auth, el gateway real ni el esquema Cloud.

## CI

`.github/workflows/ci-functional.yml` incorpora el trabajo `afiliados`. Levanta `postgres:15` desechable, monta el repositorio y ejecuta la misma prueba SQL. No publica imágenes ni toca Cloud. El workflow fue actualizado localmente; no se ejecutó en GitHub Actions desde este entorno.

## Escritorio

`npm test --prefix app-desktop`: **40 pruebas aprobadas**. Se agregó una prueba que verifica que `campanasService.listar` selecciona las 17 columnas del contrato de `public.campanas`, incluida `tasa_descuento_oferta`; otra prueba monta la vista y comprueba que muestra por separado descuento normal, descuento para ofertas y comisión, y que una campaña anterior con `tasa_descuento_oferta = NULL` muestra «No especificado» sin convertirlo en `0,00%` ni copiar la tasa normal. Las 11 pruebas restantes de `campanas.test.cjs` cubren aceptación, versiones, tasas y estados. `claveCondiciones` incluye `tasa_descuento_oferta`, de modo que un cambio de esa tasa invalide el consentimiento anterior. `npm run build --prefix app-desktop` compiló con Vite 4.5.14 y la advertencia existente de un paquete principal de 2,7 MB. La aceptación por versión y las validaciones de sesión/cafetería no se modificaron.

## Límites y decisiones pendientes

- La definición completa de `public.campanas` en Cloud no está versionada en este repositorio. La migración verifica las columnas, funciones y triggers que necesita y falla con un mensaje explícito si el esquema no coincide; no crea una tabla equivalente.
- La tabla provisional `campanas_afiliados` no se usa ni se migra. No se aplicó en Cloud, por lo que no hay datos de producción que trasladar.
- No se aplicó SQL en Supabase Cloud, no se desplegó en Kubernetes, no se publicaron imágenes y no se hizo push ni merge.
- La prueba real con Supabase Auth, RLS y gateway no se ejecutó: el stack Supabase local disponible no contiene `public.campanas` y el esquema V05 se define en otro repositorio. No se modificó ese entorno ni se usaron credenciales Cloud.
- **Decisión 1:** C02 permite aceptar una campaña futura; V05 exige `vigencia_desde <= now()`. Se conserva V05. Si se necesita aceptación anticipada, debe cambiarse la regla de forma coordinada.
- **Decisión 2:** las campañas existentes conservan `tasa_descuento_oferta = NULL`. Debe decidirse si no aplican descuento a productos en oferta o si el dueño debe crear una campaña nueva con las dos tasas.
- **Decisión 3:** C02 pide avisar a afiliados si cambian porcentajes antes del inicio. C03 no implementa correo ni notificaciones; es una tarea separada.
- **Decisión 4:** pausar una campaña pendiente devuelve `409 campana_no_activa`. Si el negocio prefiere permitirlo, debe definirse el estado resultante y su efecto sobre la aceptación.
- **Decisión 5:** C02 permite editar porcentajes antes del inicio, pero V05 impide cambiar cualquier condición ya aceptada. Se conserva la inmutabilidad. Si se autoriza la edición, debe definirse una nueva versión, la invalidación de la aceptación y el aviso a afiliados.
