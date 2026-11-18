# A03 · Conectar campañas activas

## Estado y contrato integrado

Implementación actualizada el **18 de noviembre de 2026**, en la rama
`S3-T3-Ariel-Diaz-Conectar-campanas-activas`, sobre `develop` en `e2ee09b`.
Ese commit incluye A02, D02 y C04 / PR #74. El trabajo móvil preparado el 17 de
noviembre se recuperó después de actualizar la rama; el contrato provisional
con `postulables=true` ya no se utiliza.

La consulta usa `GET /api/afiliados/cafeterias/:id/campanas`, sin parámetros,
con el JWT de la cuenta activa obtenido por `backendClient.apiGet`. C04 llama a
`listar_oportunidades_campana(p_cafeteria_id)`; la RPC oficial autoriza al
estudiante y filtra cafeterías y campañas activas dentro de su vigencia.
Ver [C02](../../contratos-integracion-afiliados.md) y la [evidencia C04](../../microservicios/validacion/S3-T4-consulta-campanas-vigentes.md).

Mobile conserva los once campos oficiales: `id`, `nombre`, `cafeteria_id`,
`cafeteria_nombre`, `tipo`, `estado`, `estado_vigencia`, `vigencia_desde`,
`vigencia_hasta`, `tasa_descuento` y `tasa_comision`. No usa los alias del
formulario administrativo ni presenta un descuento en oferta que C04 no devuelve.
La cafetería de cada respuesta debe coincidir con la selección actual.

## Archivos y comportamiento

- [Servicio de campañas](../../../app-mobile/src/services/campanasAfiliados.ts):
  consulta el catálogo público y la ruta estudiantil autenticada, valida la
  respuesta y aplica el filtro defensivo de vigencia. No utiliza la ruta del dueño.
- [OportunidadesScreen](../../../app-mobile/src/screens/afiliaciones/OportunidadesScreen.js):
  selector de cafetería, carga, listado, vacío, error, reintento y actualización.
- [MisAfiliacionesScreen](../../../app-mobile/src/screens/MisAfiliacionesScreen.js):
  conecta Oportunidades desde la entrada existente y conserva Mis códigos/Ganancias.
- [Pruebas del servicio](../../../app-mobile/src/services/campanasAfiliados.test.ts),
  [pruebas de pantalla](../../../app-mobile/src/screens/afiliaciones/OportunidadesScreen.test.js)
  y [regresiones de perfil](../../../app-mobile/src/screens/PerfilAfiliaciones.test.js).
- [Prueba de integración Mobile](../../../app-mobile/src/screens/afiliaciones/OportunidadesIntegracion.test.js)
  y [runner desechable](../../../.github/scripts/test-mobile-campanas.cjs).
- `app-mobile/jest.config.js`: conserva `EXPO_PUBLIC_*` durante Jest mediante
  `caller.preserveEnvVars`, para verificar el cliente HTTP sin cargar `.env`.
- `docs/README.md`, `docs/estado-actual.md` y este registro.

### Filtro, contexto y sesión

Se muestra solo `estado = activa`, `estado_vigencia = en_curso` e
`inicio <= ahora < fin`, usando `vigencia_desde` y `vigencia_hasta`. Las fechas
se comparan como instantes con zona horaria. Pausadas, vencidas, futuras y
finalizadas quedan excluidas. Un temporizador retira la campaña al vencer,
aunque la pantalla siga abierta. Actualizar o volver al foreground reconsulta
para detectar pausas posteriores; A03 no incorpora polling ni Realtime.

La entrada exige elegir una cafetería real del catálogo. Cambiarla oculta el
listado anterior inmediatamente y descarta éxitos o errores atrasados. Al
salir se retiran el listener de AppState y el temporizador. El montaje por UUID
y las guardas de A01/A02 evitan conservar contenido al cambiar de cuenta.

Las tasas nulas se muestran como «No especificado», nunca como cero. Una
respuesta inválida o un error HTTP no se convierte en un vacío exitoso.
`401` informa sesión vencida; `403`, falta de permiso; otros errores permiten
reintentar. No se envían claves de servicio ni se consulta directamente la tabla
`campanas` desde el dispositivo.

## Registro automatizado reproducible

Entorno: Windows, Node.js 22.19.0. Desde la raíz, con dependencias móviles instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

| Paso que produce el estado | Resultado comprobado |
|---|---|
| Abrir Perfil → Mis afiliaciones → Oportunidades | Conserva la cuenta activa y solicita seleccionar cafetería; sin cafetería fija |
| Seleccionar Norte con activa, pausada y vencida en la respuesta controlada | Solo muestra la activa, su cafetería, alcance, descuento, comisión y vigencia |
| Recibir lista vacía válida | «No hay oportunidades disponibles» |
| Probar inicio y fin exactos con zona `-03:00` | Incluye el inicio y excluye el término |
| Llegar al vencimiento con la pantalla abierta | Retira la campaña y muestra el vacío |
| Cambiar Norte → Sur mientras Norte responde tarde con éxito o error | No muestra datos ni errores de Norte en Sur |
| Recibir 401/403/503 o respuesta malformada | Error con reintento; no simula ausencia de campañas |
| Cambiar el token sintético antes de otra consulta | El cliente toma la sesión nueva |
| Desmontar con consulta o vencimiento pendientes | Retira listener/timer y no publica una respuesta posterior |
| Recibir datos de otra cafetería o sin identidad de cafetería | Rechaza el resultado, sin mezclar el alcance |

Las pruebas unitarias sustituyen `fetch` o el cliente HTTP; la siguiente prueba
se ejecuta por separado para acreditar datos persistidos y servicios reales.

## Integración real desechable: activa + pausada + vencida

Ejecutada el **18 de noviembre de 2026**. Docker Desktop local, PostgreSQL 15,
Supabase Auth/GoTrue `v2.197.0`, PostgREST `v16.3` y nginx `1.27-alpine`.
El runner crea nombres únicos, puertos loopback y un esquema mínimo de identidad,
cafeterías y campañas, con privilegios/RLS de prueba. Ejecuta la migración
[0024 oficial fijada al commit 07b5a6a](https://github.com/Diego24Vas/db_CoffeeFaster/blob/07b5a6aaad2a1ea8eb73ae5dbce5af9db02d16f2/supabase/migrations/0024_s3_t4_rpc_campanas_vigentes.sql),
sin copiar una RPC alternativa al repositorio ni reconstruir todo Cloud.

La cuenta estudiante se registra e inicia sesión mediante Auth real. El JWT
emitido se entrega en memoria a la prueba Mobile. Se monta la pantalla y se
utiliza el servicio móvil real: el lector local de sesión de Supabase se
sustituye para entregar ese JWT; el transporte Node realiza peticiones HTTP
reales. El gateway, ms-cafeterías, ms-pedidos, PostgREST y la RPC no se simulan.
No se ejecuta el inicio de sesión visual de la app ni un emulador en este caso.

Preparación desde la raíz, si faltan dependencias de microservicios:

```powershell
npm.cmd ci --prefix Microservices/ms-pedidos
# Los servicios comparten las mismas dependencias en este entorno de prueba.
$dependencias = (Resolve-Path Microservices/ms-pedidos/node_modules).Path
foreach ($carpeta in @('Microservices/shared/node_modules', 'Microservices/ms-cafeterias/node_modules')) {
    if (-not (Test-Path -LiteralPath $carpeta)) {
        New-Item -ItemType Junction -Path $carpeta -Target $dependencias | Out-Null
    }
}
node .github/scripts/test-mobile-campanas.cjs
```

El runner requiere Docker activo y acceso a las imágenes y a la migración
oficial fijada. No lee `.env`, no usa un proyecto Cloud y no necesita cuentas
ni credenciales del equipo. Su cuenta, claves y contraseña son efímeras; el JWT
no se escribe en archivos ni se pasa como argumento. Al finalizar elimina los
contenedores, sus volúmenes, la red y el directorio temporal, también ante errores.

| Paso ejecutado | Estado resultante observado | Resultado |
|---|---|---|
| Insertar en PostgreSQL Norte ID 7 con campaña 31 activa, 32 pausada y 33 vencida; Sur ID 8 sin campañas | Tres filas persistidas de Norte, con vigencias relativas al reloj del servidor | PASS |
| Registrar estudiante e iniciar sesión en Auth local | JWT real emitido por GoTrue, vinculado al usuario estudiante activo | PASS |
| Consultar C04 por nginx con ese JWT | HTTP 200; la respuesta contiene únicamente la campaña 31 | PASS |
| Montar Oportunidades y seleccionar Norte A03 | Muestra «Activa A03», descuento 15 % y comisión 10 %; no muestra Pausada A03 ni Vencida A03 | PASS |
| Seleccionar Sur A03 | Muestra «No hay oportunidades disponibles» y retira Activa A03 | PASS |

La primera ejecución encontró una carrera durante el reinicio de PostgreSQL al
terminar su inicialización. Se ajustó la espera para exigir que termine ese paso
antes de consultar. La ejecución completa posterior pasó y eliminó sus recursos.

## Resultados y límites

Suite móvil: **139/139 PASS en 16 suites**, con `--testTimeout=20000`.
El caso de integración es adicional y pasó **1/1** con el runner desechable.
TypeScript, 86 enlaces relativos y `git diff --check`: **PASS**. El límite ampliado conserva la
configuración de Jest; se utiliza por el timeout local de la prueba existente
de Pedidos ya registrado en A01. Exportación Android: **PASS**, 774 módulos,
bundle Hermes y recursos, con `EXPO_NO_DOTENV=1` y valores públicos sintéticos.
Esta exportación acredita el empaquetado de JavaScript y recursos, no un APK.

Comando desde `app-mobile`:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
$env:EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = 'ci-public-placeholder'
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080'
node node_modules/expo/bin/cli export --platform android --max-workers 2 --output-dir "$env:TEMP/coffeefast-a03-android"
```

La prueba de integración aparece omitida deliberadamente en la suite normal
si no se ejecuta con el runner: necesita su entorno y no convierte una respuesta
simulada en prueba de integración.

La evidencia acredita la pantalla montada y la consulta real contra datos
persistidos desechables. No acredita un APK desplegado, una sesión visual nueva
en emulador, las políticas completas de Cloud ni su esquema íntegro. No se
crearon campañas, cuentas ni migraciones en Cloud y no se modificaron `.env`,
microservicios ni datos productivos. Mis códigos y Ganancias mantienen
el alcance informativo de A02; A03 no solicita afiliaciones ni procesa compras.
