# A08 · Carga, vacío y error en afiliaciones

20 de noviembre de 2026. Rama `S3-T8-Ariel-Diaz-Cubrir-carga-vacio-y-error`,
basada en A06 (`a9e1f1c`) y A03 integrada en develop. A07 no es dependencia
y no se incorpora a esta rama. Primero debe integrarse A06 (#80).

## Cambios y comportamiento

- El perfil diferencia la consulta en curso del resultado vacío. «Todavía no
  tienes solicitudes de afiliación» aparece solo después de una respuesta válida.
- Se reutilizan los estados de catálogo/campañas de A03: carga, cafeterías
  vacías, oportunidades vacías, error y reintento de la consulta correspondiente.
- Al enviar una solicitud se muestra un indicador con nombre accesible,
  se deshabilitan los campos y se bloquean envíos simultáneos.
- Un error de red o del servidor mantiene la campaña, el plan y el enlace y
  ofrece «Reintentar solicitud de afiliación». No recarga el listado de campañas
  ni ejecuta un POST automático para recuperarse.
- El reintento usa los IDs de la misma cafetería/campaña. C05 conserva la misma
  solicitud por estudiante y campaña, incluso si el primer POST se confirmó
  en el servidor y su respuesta no llegó al móvil.
- Si el POST fue exitoso y falla la consulta posterior, se conserva su estado
  recibido con aviso de última consulta. «Actualizar mis solicitudes» hace GET;
  no repite el alta. Códigos/acciones siguen sujetos a la confirmación de A06.
- Un 401/403 del envío no ofrece reintento de alta: muestra sesión vencida o
  falta de permisos. La restricción del 403 del perfil de A06 se mantiene.

No se añade navegación, otra fuente de campañas ni otra operación de alta.
No se cambia SQL: la idempotencia es la del contrato C05 ya existente.

## Archivos

- [Mis afiliaciones](../../../app-mobile/src/screens/MisAfiliacionesScreen.js).
- [Formulario de solicitud](../../../app-mobile/src/screens/afiliaciones/SolicitarAfiliacion.js).
- [Pruebas de pantalla](../../../app-mobile/src/screens/afiliaciones/AfiliacionMovil.test.js).
- [Integración real](../../../app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js).
- Índice y estado funcional. El [runner A06](../../../.github/scripts/test-afiliados-auth-integration.cjs)
  y su job `mobile-afiliaciones` ejecutan también el nuevo escenario de A08.

## Registro reproducible

Windows, Node.js 22.19.0. Desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/afiliaciones/AfiliacionMovil.test.js src/screens/afiliaciones/OportunidadesScreen.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
git diff --check
```

Las dependencias, las migraciones oficiales fijadas a `07b5a6a` y la preparación
Docker son las documentadas en [A06](A06-Solicitudes-aprobacion.md).

| Paso que produce el estado | Resultado comprobado |
|---|---|
| Dejar pendiente el GET inicial del perfil | Muestra carga; no anuncia todavía que no hay solicitudes |
| Resolver ese GET con lista vacía | Estado vacío, acceso a Oportunidades y ningún POST |
| Resolver campañas con lista vacía | Vacío de oportunidades de A03; distinto de un fallo de red |
| Fallar catálogo/campañas y pulsar su reintento | Vuelve a consultar y recupera el listado; pruebas A03 conservadas |
| Abrir campaña Norte, rellenar plan/enlace y fallar el POST con red/503 | Campaña y campos conservados; un envío y botón de reintento |
| Pulsar Reintentar solicitud | Mismos IDs/plan/enlace; muestra el estado pendiente recibido |
| Resolver el POST y fallar el GET de confirmación; pulsar Actualizar mis solicitudes | Conserva campaña y solicitud; hace otro GET sin nuevo POST |
| Devolver 401/403 al POST | Mensaje específico, sin botón de envío/reintento |
| Crear solicitud real en C05, interceptar su respuesta 201 y rechazarla en el transporte móvil | Error visible y campaña/plan conservados; no se anuncia aprobación local |
| Reintentar por C05 y consultar PostgreSQL | Dos peticiones, mismo ID y exactamente una fila para el estudiante/campaña |

La integración modifica solo el transporte del primer resultado: C05, Auth,
gateway, RPC, RLS y PostgreSQL son reales y desechables. La solicitud se crea
realmente antes de perder la respuesta; no se sustituye el alta por una función
de prueba. Tras el reintento continúan los escenarios de aprobación, saldo e
historial de A06. No se generan altas adicionales desde reintentos de lectura.

Resultados: **33/33 pruebas de pantalla PASS**, **205/205 pruebas móviles PASS
en 20 suites** (dos integraciones omitidas en la ejecución normal), TypeScript,
98 enlaces relativos y `git diff --check` aprobados. La ejecución con Docker
pasó **1/1 integración Mobile**, incluido el escenario A08 y los estados A06,
además de **seis escenarios C05**. La aserción SQL final exige una sola fila
para el estudiante 901 y la campaña seleccionada después de los dos POST.
Los recursos desechables se eliminan al finalizar el runner.

Exportación Android: **PASS**, bundle Hermes y recursos. Se ejecutó desde
`app-mobile` con `EXPO_NO_DOTENV=1`, `EXPO_OFFLINE=1`, `CI=1`, URLs locales y
clave pública sintéticas: `node node_modules/expo/bin/cli export --platform
android --max-workers 2 --output-dir RUTA_DE_SALIDA`. El primer intento se
detuvo durante el arranque prolongado de Metro; la repetición sin conexión
finalizó correctamente. La exportación no construye ni instala un APK.

Este registro aporta los pasos y estados resultantes. No se ejecutó una nueva
prueba visual en emulador: los componentes se montan con react-test-renderer.
No acredita un APK desplegado ni el funcionamiento del servidor de la cuenta
del usuario. No se modificaron Cloud, credenciales, `.env` ni datos productivos.
