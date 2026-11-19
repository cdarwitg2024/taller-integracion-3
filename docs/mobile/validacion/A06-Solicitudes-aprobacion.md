# A06 · Solicitar afiliación y mostrar aprobación en Mobile

18 de noviembre de 2026. Rama `S3-T6-Ariel-Diaz-Solicitar-afiliacion-y-mostrar-aprobacion`,
basada en A03/A04 (`693645b`), con la corrección de vencimiento de A03 y
`develop` actualizado a `446127f`, que incluye C05 paginado (`1977914`).
Los cambios de A06 permanecen en su rama; no se publican directamente en `develop`.

## Flujo y estados

Perfil → Mis afiliaciones consulta `GET /api/afiliados/mi-perfil` con la sesión
actual. Se repite al abrir una vista interna, actualizar o volver al foreground.
La consulta recorre `siguiente_antes_de` mediante `?antes_de=` hasta completar
el perfil. Un cursor inválido, filas repetidas, un error intermedio o el límite
de 50 páginas producen error y no publican un perfil parcial.
Oportunidades conserva el catálogo, filtro y condiciones de A03/A04.

Seleccionar cafetería → **Solicitar afiliación** de una campaña → completar
Plan de promoción y, opcionalmente, un enlace público http/https → Enviar solicitud
de afiliación. El POST usa la ruta de [C05](../../microservicios/validacion/C05-solicitudes-afiliacion.md)
y solo envía el plan y el enlace; no envía identidad, decisión ni código.
No existía un botón «Inscribirme» en esta base: se agrega el acceso con la
etiqueta solicitada, sin mantener una inscripción paralela.

El formulario conserva los datos ante errores, bloquea el doble envío y no
reintenta escrituras automáticamente. Si no se pudo confirmar el resultado,
permite reintentar y recuperar la misma solicitud gracias a C05. Después de la
respuesta consulta nuevamente el estado persistido; no simula una aprobación.

| Estado recibido | Vista y controles |
|---|---|
| Sin solicitud | Oportunidades y formulario de solicitud; sin código ni panel financiero |
| `pendiente` | Mensaje de revisión; no muestra código ni accesos Mis códigos/Ganancias/Historial |
| `rechazada` | Mensaje de rechazo, sin inventar un motivo ni mostrar código o panel financiero |
| `aprobada`, código activo | Muestra exactamente el código del servidor y habilita Mis códigos, Ganancias e Historial |
| `aprobada`, código desactivado | Advierte que ya no se usa en nuevas compras, conserva el código reservado y mantiene Ganancias/Historial |
| Error al consultar | Mensaje y actualización; un error inicial no se convierte en aprobación ni saldo cero |

La habilitación se aplica a cada afiliación: una cuenta con solicitudes de
distintos estados solo puede consultar movimientos de las aprobadas. Un código
activo sigue sujeto a la vigencia y al beneficio del comprador. No se generan
códigos en el dispositivo. C05 no devuelve nombres de cafetería/campaña en el
perfil; fuera del listado de oportunidades se identifican por sus IDs reales.

La sección conserva la cuenta de A01/A02 y se desmonta por UUID al cambiar de
usuario. Los números de solicitud y los flags de montaje impiden publicar
respuestas anteriores al cambiar de vista o cuenta. Los errores 401/403 retiran
el código y el panel previamente cargados. Se eliminan los listeners al salir.

## Saldo e historial persistidos

C05 devuelve solicitudes, no importes. A06 reutiliza el cliente Supabase de la
sesión para leer `public.movimientos_comision`. El contrato de BD V04/`0020`
concede SELECT a `authenticated`, limitado por RLS al estudiante de la afiliación.
El gateway y el cliente Supabase Mobile deben usar el mismo entorno Auth/BD.
La consulta filtra el ID devuelto por C05, solicita columnas explícitas y pagina
de 200 en 200. Una respuesta de otra afiliación, duplicada o malformada se rechaza.
Si se alcanza el límite de lectura, informa error y no publica un saldo parcial.

- Disponible: suma `tipo = comision`, `estado = disponible`.
- Pendiente: suma `tipo = comision`, `estado = pendiente`.
- Comisiones revertidas y sus compensaciones permanecen en el historial, pero
  no se suman como disponible ni se descuentan dos veces.

Desactivar el código no borra ni filtra esos movimientos: la misma lectura RLS
continúa disponible. Una actualización fallida conserva los últimos importes
con aviso; un error inicial no inventa $0. Una lista vacía confirmada sí produce
saldo cero. No se modifica el saldo, la Wallet ni el estado de un movimiento.

**No hay operación de retiro definida en C05/V04.** El panel lo informa, sin
añadir un botón que simule un retiro. Esta tarea habilita la consulta del panel;
no crea un endpoint, un pago o una deducción de saldo.

## Archivos principales

- [afiliaciones.ts](../../../app-mobile/src/services/afiliaciones.ts): GET/POST
  de C05, validación de estados/código y lectura RLS de movimientos.
- [MisAfiliacionesScreen.js](../../../app-mobile/src/screens/MisAfiliacionesScreen.js):
  consulta, actualización, estados y habilitación de vistas.
- [OportunidadesScreen.js](../../../app-mobile/src/screens/afiliaciones/OportunidadesScreen.js)
  y [SolicitarAfiliacion.js](../../../app-mobile/src/screens/afiliaciones/SolicitarAfiliacion.js):
  solicitud por campaña con plan y enlace opcional.
- [EstadoAfiliacion.js](../../../app-mobile/src/screens/afiliaciones/EstadoAfiliacion.js)
  y [ComisionesAfiliado.js](../../../app-mobile/src/screens/afiliaciones/ComisionesAfiliado.js):
  estado/código y panel de importes/historial.
- [Pruebas del servicio](../../../app-mobile/src/services/afiliaciones.test.ts),
  [pruebas de pantalla](../../../app-mobile/src/screens/afiliaciones/AfiliacionMovil.test.js),
  [regresiones de perfil](../../../app-mobile/src/screens/PerfilAfiliaciones.test.js)
  y adaptación de las pruebas de Oportunidades/Condiciones de A03/A04.
- [Prueba de integración](../../../app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js),
  [preparación Mobile](../../../.github/scripts/test-mobile-afiliacion-a06.cjs)
  y modo `--a06` del [runner compartido](../../../.github/scripts/test-afiliados-auth-integration.cjs).
- Índice, estado funcional y contrato de lectura; se conserva el registro C05
  integrado desde `develop`.

## Registro reproducible

Windows, Node.js 22.19.0. Comandos desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
git diff --check
```

El runner requiere dependencias de ms-pedidos, ms-cafeterías y shared preparadas
como indica [A03](A03-Campanas-activas.md). Se ejecutó con las migraciones
oficiales `0020`, `0021`, `0023`, `0024` del commit BD `07b5a6a`, PostgreSQL 15,
GoTrue `v2.197.0`, PostgREST `v16.3` y nginx `1.27-alpine`. Pueden seleccionarse
esas imágenes mediante `TEST_AUTH_IMAGE` y `TEST_REST_IMAGE`.

Tras integrar C05 paginado se repitió la validación. Un intento inicial no pudo
arrancar porque Docker estaba apagado; otro apuntó a una copia de BD sin las
migraciones requeridas. Se utilizó la copia de las migraciones oficiales fijadas
ya descargada para C05. El primer recorrido completo encontró que el límite
artificial de dos filas del fixture C05 ocultaba la campaña nueva de A06 detrás
de campañas usadas en la prueba previa. El fixture pausa esas campañas
desechables antes de comenzar A06; se mantienen tres solicitudes para comprobar
la paginación del perfil. La repetición completa pasó y limpió sus recursos.
Una ejecución móvil coincidió con el arranque de Docker y agotó el timeout de
Pedidos; la repetición con el mismo límite de 20 segundos pasó completa.
La exportación Android se quedó en el inicio de Metro con el acceso restringido
del entorno. Se detuvieron únicamente los procesos de ese intento y se repitió
con acceso normal a las dependencias: finalizó correctamente.

El estudiante nuevo se registra e inicia sesión en Auth real. La pantalla usa
el servicio C05 real y, para comisiones, el SDK Supabase con su JWT real. Se
sustituye la lectura local de la sesión y se adapta el transporte HTTP de Node;
no se simulan gateway, RPC, RLS, solicitudes ni movimientos. El dueño resuelve
las solicitudes mediante PATCH con su propio JWT. El saldo de prueba se siembra
en PostgreSQL desechable y pasa sus restricciones/estados oficiales; no acredita
el flujo de compra, entrega y generación automática de comisiones.

| Paso que produce el estado | Resultado observado |
|---|---|
| Abrir con solicitudes pendiente y rechazada persistidas de un estudiante nuevo | Mensajes reales; sin código ni controles Mis códigos/Ganancias/Historial |
| Abrir Oportunidades, elegir Norte y solicitar con plan | POST real crea pendiente; no muestra código ni aprobación local |
| Dueño aprueba por C05; actualizar solicitudes | Muestra el código generado por SQL y habilita el panel |
| Registrar una comisión y marcarla disponible en el fixture; abrir Ganancias | Saldo disponible $850 leído mediante PostgREST y RLS del estudiante |
| Dueño desactiva por C05; actualizar | Aviso de código desactivado; saldo $850 conservado |
| Abrir Mis códigos e Historial | Conserva el código reservado e informa que no se usa; muestra Pedido #1001 y comisión disponible |
| Desmontar y reabrir con el mismo JWT | Consulta de nuevo y conserva código desactivado, saldo e historial persistidos |
| Cambiar de cuenta con una consulta anterior pendiente, en prueba controlada | La respuesta anterior no aparece en la cuenta nueva |
| Fallar una lectura de comisiones | No inventa saldo cero ni elimina una consulta válida anterior |
| Doble toque en Enviar, en prueba controlada | Una llamada; C05 también comprueba reintentos concurrentes en su integración |

Resultados finales:

- Suite móvil: **192/192 PASS en 20 suites**, con `--testTimeout=20000`. El
  límite ampliado corresponde al timeout local de Pedidos ya documentado en A01;
  no se modificó la configuración de Jest.
- A06: **36 pruebas nuevas** de servicio/pantalla; las regresiones de perfil y
  las vistas de A03/A04 permanecen aprobadas.
- Integración A06: **1/1 PASS**, además de **seis escenarios reales de C05**.
  PostgREST limita las páginas a dos filas: Mis códigos conserva la solicitud
  pendiente de la segunda página, además de la rechazada y la aprobada.
- Runner compartido sin flags: **12 escenarios reales de C03 PASS** después de
  añadir la espera de finalización, sin alterar sus aserciones.
- TypeScript, 105 enlaces relativos y `git diff --check`: **PASS**.
- Exportación Android: **PASS**, 780 módulos y bundle Hermes, sin cargar `.env`
  y con valores públicos sintéticos. No es una construcción de APK.

Los dos casos de integración aparecen omitidos en la suite normal y se ejecutan
con sus runners; no se presentan respuestas sustituidas como evidencia de BD.

Exportación desde `app-mobile`:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
$env:EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = 'ci-public-placeholder'
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080'
node node_modules/expo/bin/cli export --platform android --max-workers 2 --output-dir "$env:TEMP/coffeefast-a06-android"
```

El primer arranque del runner terminó antes de las aserciones de Auth en
Windows. Se añadió una espera de vida del proceso, liberada después de completar
la ejecución y la limpieza. Ese intento no se contó como aprobado; sus dos
contenedores se identificaron por nombre y fecha y se eliminaron. El runner
posterior completó las aserciones y eliminó todos sus recursos.

## Límites

La evidencia es de componentes montados con servicios locales reales; no es una
nueva prueba visual en emulador ni un APK desplegado. No se aplicaron SQL,
ConfigMaps ni imágenes en Cloud/Kubernetes. La aplicación de C05 en el entorno
de destino requiere autorización del equipo y no se acredita por este registro.
No se modifican credenciales, `.env`, contratos de retiro ni la Wallet.
