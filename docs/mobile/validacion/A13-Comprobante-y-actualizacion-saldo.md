# A13 · Mostrar comprobante y actualizar saldo

24 de noviembre de 2026. Rama `S3-T13-Ariel-Diaz-Mostrar-comprobante-y-actualizar-saldo`,
basada en A12 (`2ef7006`, [PR #125](https://github.com/cdarwitg2024/taller-integracion-3/pull/125)).
A12 tiene 13 controles remotos aprobados y sigue abierta al comenzar A13. Esta
rama conserva A12 como dependencia. Integrar A12 antes de revisar A13 contra
`develop` evita repetir sus cambios en ambos PR.

Dependencias: [A10](A10-Historial-ganancias-y-retiros.md) y
[A12](A12-Confirmar-retiro-reintento-seguro.md).

## Recorrido y comportamiento

Perfil → Mis afiliaciones → Ganancias o Historial → revisar monto → confirmar
retiro simulado. El comprobante conserva **referencia, monto, estado y destino**
que C15 devuelve desde V14. El disponible al confirmar se identifica como una
instantánea del comprobante; el disponible actual se consulta nuevamente con V12.
No se resta el monto en el cliente ni se vuelve a registrar el retiro al navegar.

A12 ya mostraba el comprobante y actualizaba el saldo. A13 conecta esa confirmación
con la lista de A10: si Historial está abierto, se consulta nuevamente al confirmar,
sin renovar el perfil ni generar un segundo refresco del saldo por ese evento.
Una respuesta de historial iniciada antes del retiro no reemplaza la lectura nueva.

**Ver retiro en historial** abre la sección existente y coloca la referencia en su
buscador. Funciona también si se vuelve a pulsar para el mismo comprobante después
de editar el filtro. No se añade otra ruta ni otro historial. Salir y volver obtiene
el mismo movimiento persistido, con importe de salida, fecha y estado confirmado.
V12/V14 solo guardan retiros confirmados; la tabla no tiene una columna `estado`.
El rótulo del historial sigue ese contrato y no simula estados nuevos.

Después de confirmar se descarta el resumen anterior mientras llega V12. Si falla
esa consulta, permanece el comprobante y se ofrece actualizar el saldo; el importe
anterior no se presenta como disponible actual ni se calcula uno local. Reintentar
el saldo o el historial realiza lecturas y no repite el POST. Los rechazos 401/403
retiran el comprobante de la vista de saldo, conforme al aislamiento de A12/A14.

## Regresiones con respuestas controladas

Desde la raíz, con Node.js 22 y dependencias instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/afiliaciones/ComprobanteRetiro.test.js src/screens/afiliaciones/ConfirmarRetiroSimulado.test.js src/screens/afiliaciones/SaldoAfiliado.test.js src/screens/afiliaciones/RetirosAfiliado.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
```

| Paso que produce el estado | Resultado exigido y observado por las pruebas |
|---|---|
| Abrir Historial con disponible $700, sin retiros, y confirmar $500 | Un POST; un refresco de saldo y uno de retiros; disponible $200 |
| Consultar el comprobante y la fila nueva | Mismo monto $500 y referencia; estado confirmado |
| Pulsar Ver retiro en historial | Buscador con la referencia exacta y movimiento de salida `-$500` |
| Cambiar el buscador y volver a pulsar el acceso | Vuelve a localizar la misma referencia |
| Salir, reabrir la sección e ingresar a Historial | Misma referencia e importe; ningún POST adicional ni otro descuento |
| Fallar la consulta de saldo posterior al retiro | Comprobante intacto; el saldo anterior $700 no aparece como actual |
| Reintentar saldo | Disponible $200 del servidor; no registra otro retiro |
| Resolver tarde una consulta de historial anterior a la confirmación | No borra la fila nueva |
| Fallar el refresco del historial y reintentar | Recupera la fila; conserva comprobante y no repite el retiro |

Estas regresiones montan Mis afiliaciones, formulario, saldo e historial juntos;
Auth y las respuestas de red/lectura están controladas. Complementan la siguiente
prueba con la RPC y la tabla reales.

## Cotejo con Supabase desechable

El runner existente de C15/A12 prepara una afiliación aprobada, una comisión
**desechable** disponible de $600 y sesiones reales de Auth. La pantalla usa
Nginx → ms-afiliados → PostgREST → V14, y V12 para consultar saldo. No usa Cloud.

```powershell
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
```

1. Abrir Mis afiliaciones con el estudiante y entrar a Ganancias: disponible $600.
2. Confirmar $500 y perder la primera respuesta **después** de que V14 confirma.
3. Recuperar la misma solicitud: el comprobante conserva la referencia original,
   muestra $500 y estado confirmado; V12 devuelve disponible $100.
4. Cotejar referencia e importe contra `retiros_afiliado` en PostgreSQL y comprobar
   una sola fila por cuenta/clave por $500.
5. Pulsar Ver retiro en historial: la lectura SDK autenticada encuentra esa misma
   referencia y el importe de salida `-$500`, con fecha y rótulo confirmado.
6. Desmontar la pantalla, abrirla nuevamente e ir a Historial: misma fila y saldo
   $100. Se mantienen dos POST totales (envío cuya respuesta se perdió y recuperación).

El runner imprime `PASS A13` con el cotejo de la fila y `PASS A12` con la solicitud
repetida. El job `mobile-afiliaciones` ejecuta el mismo escenario ampliado. Las
migraciones oficiales V12/V13/V14 pertenecen a `db_CoffeeFaster` y se leen desde la
copia fijada; no se copian ni se aplican al Supabase existente del equipo.

## Archivos

- [Coordinación de vistas](../../../app-mobile/src/screens/MisAfiliacionesScreen.js).
- [Saldo](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.js),
  [comprobante y acceso](../../../app-mobile/src/screens/afiliaciones/SolicitudRetiroSimulado.js) e
  [historial](../../../app-mobile/src/screens/afiliaciones/RetirosAfiliado.js).
- [Regresiones A13](../../../app-mobile/src/screens/afiliaciones/ComprobanteRetiro.test.js) e
  [integración A12/A13](../../../app-mobile/src/screens/afiliaciones/ConfirmarRetiroIntegracion.test.js).

La evidencia registra componentes React Native y servicios reales en contenedores;
no acredita un APK instalado ni interacción visual en emulador. No se ejecutan
transferencias bancarias, escrituras Cloud ni operaciones con datos productivos.
La CI remota del commit de A13 se verifica cuando se publique su rama.

## Resultado local del 24 de noviembre

- **408 pruebas móviles aprobadas**, tres integraciones opt-in omitidas en la suite
  normal, 40 suites aprobadas. Las cuatro suites enfocadas contienen 26 pruebas.
- TypeScript, exportación Android con Expo/Metro y `git diff --check` aprobados.
  Se comprobaron 169 enlaces relativos sin roturas.
- **Integración A12/A13 aprobada** con pantalla, Auth, Nginx, PostgREST y RPC reales.
  Comprobante V14 y fila SQL: monto $500, referencia
  `0a523e13-b7dd-4e04-bb40-a612d79c0182`. Estado confirmado; una sola fila por $500.
- Historial consultado de nuevo tras cerrar la pantalla: mismo importe y referencia,
  disponible final $100. Dos POST totales por la pérdida de la primera respuesta;
  abrir o actualizar el historial no añadió otro.
- Se conservaron los escenarios A06/A09/A10/A11/A08, C15 y siete casos C05/E08.
- Migraciones oficiales leídas desde la copia aislada de `db_CoffeeFaster` `8b80271`,
  imagen `postgres:15`, Auth `supabase/gotrue:v2.197.0` y PostgREST `postgrest/postgrest:v16.3`.
- El runner eliminó sus contenedores. Docker volvió al estado apagado inicial.
  No se modificaron los datos del Supabase existente ni Cloud.
