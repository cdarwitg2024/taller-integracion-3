# Revisión de pruebas para CI/CD

## S3-T4: condiciones y aceptación de campañas

Integración del 14 de noviembre de 2026 con el develop que contiene S3-T2:
35 pruebas de escritorio y cinco regresiones deliberadas detectadas, conservando
ambas tareas. Compilación aprobada; conflictos de pruebas y documentación resueltos.

Validación local del 13 de noviembre de 2026 con Node 22.16.0:

- Escritorio: 21 pruebas aprobadas, incluidas 8 nuevas de componentes montados y servicio.
- Se comprueban doble clic, consentimiento por versión, cambios de cafetería, respuestas tardías incluso en el mismo lote, reintento, actualización del badge y errores de consulta visibles.
- El servicio rechaza perfiles inválidos y respuestas que no confirman la campaña, cafetería y versión solicitadas. No envía el ID del firmante.
- La sensibilidad detecta tres regresiones en copias temporales: stock concurrente, versión aceptada y omisión del consentimiento.
- Compilación Vite aprobada; permanece la advertencia de tamaño del paquete. `git diff --check` aprobado.

La migración y sus pruebas SQL pertenecen exclusivamente a `Diego24Vas/db_CoffeeFaster`, rama
`develop`, commit `56508f9`. Allí, la migración `0019` retira la firma
antigua de confirmación y añade `obtener_campana_vigente`. Debe aplicarse coordinadamente
con esta versión de la aplicación; no se aplicó a Cloud. Las condiciones ya aceptadas
son inmutables: para otras condiciones se crea otra campaña, conservando la evidencia anterior.

Las pruebas React utilizan el ciclo de vida real con `react-test-renderer` y sustituyen
MUI y las conexiones externas. No equivalen a una prueba manual en Electron ni a una
validación de Supabase Auth. Las pruebas de PostgreSQL, sus comandos y límites se
documentan en `tests/README.md` del repositorio de base de datos.

## Validación S3-T2: concurrencia y cambio de cafetería del Dashboard

13 de noviembre de 2026, ejecución local con Node.js 22.16.0 en la rama
`S3-T2-Diego_Vasquez-Descartar_respuestas_antiguas_del_Dashboard`.

- `npm test --prefix app-desktop`: 21 pruebas aprobadas (8 existentes y 13 regresiones nuevas).
- Las regresiones comprueban carga inicial solapada con refresco silencioso, éxito y error, respuestas antiguas antes/después, reintento, cálculos pendientes, desmontaje y reactivación.
- El estado incluye la cafetería a la que pertenece. El render descarta su contenido si no corresponde a la cafetería seleccionada, antes de la limpieza de `useEffect`.
- Dos casos integran el cargador con el render real de `VistaDashboard` mediante ReactDOMServer: primero cargan y muestran datos de A, luego renderizan B o un usuario sin cafetería conservando todavía el estado de A. Verifican que no se muestren indicadores, pedidos, errores ni la última actualización de A.
- `node .github/scripts/verify-unit-sensitivity.cjs desktop`: tres defectos detectados mediante aserciones, introducidos solo en copias temporales: pérdida de protección de stock concurrente, cierre de carga condicionado a `showLoading` y eliminación de la comprobación de cafetería en el render.
- `npm run build --prefix app-desktop`: compilación aprobada. Vite advierte de un paquete mayor de 500 kB; no impide compilar.
- `git diff --check`: aprobado.

Estas pruebas sustituyen las conexiones externas y los componentes visuales hijos.
No verifican un navegador montado, Electron, Supabase Auth/RLS ni la recepción real
de eventos Realtime. La validación no modifica datos remotos ni acredita un despliegue.

## Resultado local

- Móvil: 68 pruebas, 11 suites aprobadas. La prueba de App comprueba login y navegación a registro; antes podía quedarse en carga sin detectar problemas.
- Microservicios: cafeterías 22, menús 36, pedidos/auth 131 aprobadas.
- Backend legacy: 51 pruebas en 4 suites en la auditoría original. La suite retirada tenía 15 casos. La ejecución posterior del backend aprobó las 36 pruebas restantes en 3 suites.
- Escritorio: 7 aprobadas; shared: 5 aprobadas.
- Telegram: 11 pruebas aprobadas, incluida la integración con PostgreSQL 15 real, ejecutadas dentro de un contenedor Python temporal.
- Total de la auditoría antes del retiro de esa suite: 331 pruebas Node/Jest/Python aprobadas.
- SQL: 8 escenarios de compra, 8 de cancelación y 2 concurrentes aprobados en PostgreSQL 15, la versión usada por CI. También se ejecutaron en PostgreSQL 17 local.
- Catálogo: 7 escenarios HTTP con Express, supabase-js, PostgREST y PostgreSQL 15 reales aprobados.
- Sensibilidad: 11 defectos deliberados detectados (7 JavaScript y 4 SQL), introducidos exclusivamente en copias temporales. No es un porcentaje de mutation coverage global.

## Error real encontrado y falsos escenarios corregidos

PedidosScreen usaba `ApiError` sin importarlo. Ante una cancelación rechazada, el bloque que debía interpretar el error lanzaba un ReferenceError y no llegaba al fallback RPC ni al manejo específico de 409. Se corrigió el import y se añadieron comprobaciones de llamadas, persistencia de las credenciales y ausencia de mensajes de éxito al fallar.

Tres casos configuraban errores 401/403/404 en `apiGet` aunque la pantalla no llamaba a ese método. Se reemplazaron por cancelaciones que sí ejecutan API y RPC. El caso de pérdida de conexión ahora provoca un error real en la consulta ejecutada por la pantalla. Los tests usan la clase `ApiError` del código de aplicación.

Las pruebas de escritorio ya no borran imports/exports mediante expresiones regulares: compilan el módulo con esbuild y verifican que existan sus imports y exports, manteniendo sustituciones explícitas de las dependencias externas.

Ante el reporte de que Mis pedidos permite scroll pero a veces no abre QR/token, se unificaron los modales nativos de confirmación y detalle. Se probaron cinco aperturas/cierres consecutivos y el paso de confirmación a detalle, tocando las tarjetas renderizadas. Las pruebas de componente pasan y el usuario confirmó posteriormente que la apertura funciona en Android. La causa exacta del bloqueo táctil no se aisló por separado.

El registro Android posterior mostró `PGRST303: JWT expired`. Se vinculó la renovación automática de sesión al estado de la app y se agregó un único reintento de lecturas de pedidos/perfil tras renovar un JWT vencido. Las renovaciones concurrentes se comparten. No se reintentan escrituras. Siete pruebas nuevas verifican renovación, fallo de renovación, límite de reintentos, errores de red, concurrencia, ciclo de primer/segundo plano y recuperación del QR. Esto confirma el manejo de la sesión en pruebas; la comprobación manual posterior en Android fue aprobada por el usuario, según el registro siguiente.

## Prueba manual aprobada: pedidos en Android

- Fecha: 10 de noviembre de 2026.
- Entorno: app-mobile en Android; modelo, versión de Android e identificador de compilación no registrados.
- Ejecutor y evidencia: Camilo, por confirmación explícita en esta conversación: «funciona, demos por validado la prueba manual».
- Flujo validado: acceder a Mis pedidos, abrir y cerrar el detalle y visualizar el QR y el token de contingencia.
- Resultado actualizado: APROBADO. Después de un reporte intermedio de posible recurrencia, se preguntó expresamente si la apertura del detalle y del QR/token funciona de forma estable, sin salir de Pedidos y volver a entrar. El usuario respondió «sip funciona bien». Se cierra el caso manual con esa confirmación; scroll y pestañas no eran el problema reportado.
- Segunda cuenta: APROBADA la comprobación visual de aislamiento. El usuario confirmó que la cuenta 2 muestra únicamente sus propios pedidos y no los de la cuenta anterior, que tenía aproximadamente 12. También confirmó crear y visualizar correctamente un pedido con la cuenta 2. Esta comprobación de interfaz no equivale a probar acceso directo por API o RLS.
- Alcance: aprobadas manualmente la creación y visualización en la segunda cuenta, el aislamiento visual entre cuentas y la apertura estable del detalle con QR/token en Android. La validación corresponde a estos flujos. No se ha demostrado por separado una expiración y renovación forzada del JWT; ese caso tiene cobertura automatizada.

## Qué comprueban y qué falta

Las pruebas unitarias usan entradas controladas y sustituyen dependencias externas. Eso permite verificar errores, permisos, cálculos y decisiones de la aplicación, pero no demuestra que una consulta funcione contra el esquema desplegado. Se conservan porque aportan cobertura; no deben describirse como end-to-end.

El workflow `CI Functional` ejecuta las funciones SQL versionadas de pago y cancelación contra PostgreSQL 15 desechable. Comprueba persistencia de stock y saldo, rollback, rechazo por falta de saldo/stock, pertenencia, estados y operaciones concurrentes. Las comparaciones usan `IS DISTINCT FROM` para que un resultado NULL inesperado también falle. El runner espera a ambos procesos antes de eliminar la base, incluso si uno falla.

El esquema de esa prueba es mínimo y las funciones de identidad devuelven un usuario controlado: no verifica Supabase Auth ni RLS. Tampoco demuestra compatibilidad con un esquema remoto que haya cambiado fuera del repositorio.

La integración Telegram ejecuta el repositorio real contra PostgreSQL, crea un esquema único, inserta registros controlados y verifica resultados exactos y exclusión de productos ajenos, inactivos y eliminados. Cierra las conexiones y elimina únicamente ese esquema. Reemplaza la prueba que eliminaba registros del usuario 1 y asumía que existía un dueño llamado Carlos. En CI, faltar la conexión de pruebas provoca fallo, no un skip.

La integración de catálogo comprueba listas, ordenamiento, filtros, registros inactivos/eliminados, precios autoritativos, actualizaciones SQL visibles desde HTTP y rechazo 503 tras revocar permisos reales. Crea y elimina su propia red y contenedores; no usa respuestas prefabricadas ni modifica el entorno activo del usuario. El JWT se firma para el PostgREST aislado: no sustituye una prueba de Supabase Auth.

Todavía no existe una prueba end-to-end que recorra móvil/escritorio, gateway, microservicios y Supabase Auth/RLS real. Las pruebas de servicios de escritorio usan un transporte en memoria; las regresiones S3-T2 añaden render con ReactDOMServer, pero no validan la interfaz Electron. La entrega de mensajes por Telegram queda fuera de estas pruebas. Para cerrar esas brechas hace falta un entorno Supabase local reproducible con esquema, políticas y usuarios de prueba versionados.

## Ejecución

- Móvil y backend: `npm test -- --ci --runInBand` desde cada carpeta.
- Cada microservicio: `npm test -- --ci` desde su carpeta; shared requiere sus dependencias resueltas como indica `ci-microservices.yml`.
- Escritorio: `npm test` desde `app-desktop`.
- Catálogo real: `node .github/scripts/test-catalog-integration.cjs` desde la raíz, con Docker activo y dependencias de ms-menus/ms-cafeterias/shared instaladas. Usa PostgreSQL 15 y PostgREST en contenedores desechables.
- Sensibilidad JavaScript: `node .github/scripts/verify-unit-sensitivity.cjs` o agregar `mobile`, `desktop`, `backend`, `ms-cafeterias`, `ms-menus` o `ms-pedidos` para verificar una suite. Requiere sus dependencias instaladas. Un fallo de compilación o infraestructura no cuenta como defecto detectado.
- Sensibilidad SQL: `node .github/scripts/verify-test-sensitivity.cjs` con el mismo contenedor PostgreSQL de las pruebas SQL. Exige que falle la aserción funcional esperada, no simplemente cualquier comando.
- SQL: crear un contenedor PostgreSQL 15 de pruebas con usuario postgres y rol `authenticated`, definir `TEST_POSTGRES_CONTAINER` con su nombre y ejecutar `node app-mobile/tabla_mobile/tests/run-procesar-pago.cjs`. Crea y elimina una BD `cf_panel_test_*`; no ejecutar contra producción.
- Telegram: instalar `requirements.txt`, `pytest` y `pytest-asyncio`; ejecutar `python -m pytest` desde `BotTelegramCoffeFaster`. Para integración, definir `TEST_DATABASE_URL` apuntando a localhost y una BD cuyo nombre empiece por `cf_bot_test_`. El workflow prepara esa base automáticamente.

`CD Docker` requiere también `CI Functional` antes de publicar. Este cambio no publica imágenes ni despliega en Kubernetes. El archivo `.github/scripts/validate-release.cjs` ya tenía cambios antes de esta revisión y no fue modificado por ella.
