# A11 · Capturar solicitud de retiro simulado

20 de noviembre de 2026. Rama `S3-T11-Ariel-Diaz-Capturar-solicitud-retiro-simulado`,
basada en A09 (`7e4739e`, PR #87). A10/V14 no son dependencia del formulario:
esta tarea captura y valida un monto para revisar, sin registrar un retiro.

## Recorrido y comportamiento

Perfil → Mis afiliaciones → Ganancias → **Preparar retiro simulado**. El
formulario también está disponible en el resumen de saldo del Historial.
Usa exclusivamente el `disponible_clp` que A09 obtiene de la RPC V12; no añade
las comisiones pendientes ni utiliza la Wallet de compras.

El destino de solo lectura es **Cuenta de prueba CoffeeFast (destino ficticio)**.
No se piden datos bancarios. El aviso de simulación aparece antes del campo de
monto y explica que no habrá transferencia ni descuento de saldo.

El monto se introduce en pesos chilenos enteros, sin separadores. Se aceptan
valores positivos hasta el saldo disponible inclusive. Vacío, cero, negativos,
fracciones, exponentes, letras y valores no representables producen error.
«Revisar solicitud simulada» muestra el monto validado, el destino y que aún
no se ha enviado. No muestra una referencia o comprobante inventados.

Mientras el saldo se actualiza o conserva un error transitorio, el formulario
queda deshabilitado aunque el resumen conserve valores anteriores. Si cambia
el saldo, desaparece la revisión anterior y el monto se comprueba nuevamente
al revisar. Editar el campo limpia el resultado anterior. Cambiar de cuenta
desmonta el formulario y no conserva el monto de la cuenta previa.

## Alcance del contrato C02

La sección [captura local A11](../../contratos-integracion-afiliados.md) define
la validación de este formulario. No se añade un endpoint, una transferencia,
una reserva de fondos ni una escritura en `retiros_afiliado`. La futura
operación de retiro deberá volver a validar el monto y el saldo en el servidor.
V14 sigue pendiente para comprobantes; esta tarea no la sustituye.

## Archivos

- [Formulario](../../../app-mobile/src/screens/afiliaciones/SolicitudRetiroSimulado.js)
  y [pruebas de pantalla](../../../app-mobile/src/screens/afiliaciones/SolicitudRetiroSimulado.test.js).
- [Validación de monto y destino](../../../app-mobile/src/utils/retiroSimulado.ts)
  y [pruebas de importes](../../../app-mobile/src/utils/retiroSimulado.test.ts).
- [Integración en el saldo A09](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.js).
- [Prueba con V12 real](../../../app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js).
- Contrato, índice y estado funcional.

## Registro reproducible

Windows y Node.js 22.19.0. Desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/utils/retiroSimulado.test.ts src/screens/afiliaciones/SolicitudRetiroSimulado.test.js src/screens/afiliaciones/SaldoAfiliado.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
git diff --check
```

Las dependencias, las migraciones fijadas y el entorno desechable son los
descritos en [A09](A09-Comisiones-saldo-disponible.md). El job existente
`mobile-afiliaciones` ejecuta el mismo runner y el nuevo escenario A11.

| Paso que produce el estado | Resultado observado |
|---|---|
| Abrir con pendiente $500, disponible $700 y retirado $300 | Campo de monto, destino ficticio y aviso de simulación |
| Introducir $500 y revisar | Monto válido $500, destino ficticio y texto de solicitud no enviada; disponible sigue en $700 |
| Introducir $0 y revisar | Error de monto mayor que cero; no aparece una revisión válida |
| Introducir $701 o $1.000 y revisar | Error de superar el saldo de $700; no se añaden los $500 pendientes |
| Introducir el límite exacto $700 | Revisión válida, sin débito |
| Editar un monto validado | Desaparece la revisión anterior |
| Actualizar el saldo y dejar la respuesta pendiente | Campo y revisión bloqueados; no valida contra el saldo anterior |
| Resolver la actualización con disponible $400 y revisar los $500 conservados | Error por superar $400; no conserva el resultado válido anterior |
| Fallar una actualización de saldo | Puede verse la última consulta, pero no se habilita preparar el retiro |
| Cambiar de cuenta | Monto vacío y sin revisión de la cuenta anterior |

En la integración se usa el saldo V12 real con JWT estudiantil y PostgreSQL
desechable. Se comprueban $0, $701 y $500 desde el formulario real montado.
Después de revisar $500, la base sigue teniendo **un retiro histórico de $300**,
exactamente como antes: no se insertó otro ni se descontó saldo. Ese retiro
histórico es un dato del fixture A09, no una operación de A11.

Resultados: **38/38 pruebas enfocadas PASS**, **254/254 pruebas móviles PASS
en 24 suites** (dos integraciones omitidas en la ejecución normal), TypeScript,
110 enlaces relativos y `git diff --check` aprobados. El runner pasó **1/1 integración Mobile**,
incluido A11, además de **seis escenarios C05**. Los recursos desechables
se eliminaron al finalizar.

Exportación Android: **PASS**, bundle Hermes y recursos. Se usaron
`EXPO_NO_DOTENV=1`, `EXPO_OFFLINE=1`, `CI=1`, URLs locales y una clave pública
sintéticas. Desde `app-mobile`: `node node_modules/expo/bin/cli export
--platform android --max-workers 2 --output-dir RUTA_DE_SALIDA`.

Este registro aporta el paso y el estado resultante; no se tomó una nueva
captura en emulador ni se construyó un APK. No se modificaron datos de Cloud,
SQL de negocio, credenciales, archivos `.env` ni la Wallet.

## Continuación A12

El registro anterior conserva el alcance de A11. A12 añade una confirmación
explícita por C15: revisar no envía, pero confirmar registra el retiro simulado
y descuenta el disponible. Ver [confirmación y reintento seguro](A12-Confirmar-retiro-reintento-seguro.md).
