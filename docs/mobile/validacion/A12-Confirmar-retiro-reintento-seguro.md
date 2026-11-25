# A12 · Confirmar retiro con reintento seguro

24 de noviembre de 2026. Rama `S3-T12-Ariel-Diaz-Confirmar-retiro-con-reintento-seguro`,
basada en `develop` `0ed1784`, que ya contiene C15 (#123). Extiende el formulario
local de [A11](A11-Solicitud-retiro-simulado.md) con la confirmación del
[contrato C15](../../contratos-integracion-afiliados.md#saldo-y-retiro-por-el-gateway-c15).

## Recorrido y reglas

Perfil → Mis afiliaciones → Ganancias (o Historial) → introducir monto →
**Revisar solicitud simulada** → **Confirmar retiro simulado**.
Revisar sigue sin enviar ni descontar. Confirmar registra un retiro simulado,
descuenta el disponible de comisiones y no transfiere dinero a una cuenta bancaria.
El destino es ficticio y de solo lectura.

Antes del POST se guarda en AsyncStorage una clave UUID y el monto, bajo el
UUID Auth de la cuenta. El POST autenticado al gateway envía únicamente
`monto_clp` y `clave_idempotencia`; la identidad la resuelve V14 con el JWT.
No usa la Wallet de compras ni suma comisiones pendientes.

Durante el procesamiento se bloquean edición, revisión y confirmación, con
indicador accesible. Un bloqueo inmediato también cubre dos pulsaciones antes
del siguiente render. El servicio evita otro envío simultáneo de la misma cuenta.

Si se pierde la respuesta, hay timeout, HTTP 503 o un comprobante incompleto,
se conserva la solicitud. **Recuperar retiro** reenvía el mismo monto y clave,
incluso después de salir y volver o con el saldo ya agotado. No se puede preparar
otro monto mientras esa solicitud esté pendiente. Un conflicto 409 conserva la
clave y no se interpreta como éxito.

El comprobante válido muestra monto, estado, destino, referencia del servidor y
saldo **al confirmar**. Se vuelve a consultar V12 para actualizar el resumen:
no se resta el retiro nuevamente en el cliente. El comprobante también queda
guardado; abrirlo de nuevo no envía otro POST. Solo **Preparar otro retiro simulado**
permite iniciar una solicitud posterior con otra clave.

HTTP 401/403 retira los importes y los controles de retiro. Un rechazo confirmado
422 por monto/clave inválidos o saldo insuficiente permite corregir el formulario.
Fallar al guardar antes del envío impide el POST; fallar al guardar el comprobante
conserva la clave ya enviada para recuperar el resultado. Un registro local dañado
bloquea otra solicitud en lugar de reemplazar una clave que podría haberse usado.

La cuenta se pasa desde Perfil hasta el formulario. El almacenamiento se separa
por UUID y el cliente comprueba que la sesión corresponde a esa cuenta antes de
enviar. Desmontar la cuenta anterior descarta sus respuestas tardías en la interfaz.

## Prueba reproducible con transporte controlado

Windows, Node.js 22.19.0. Desde la raíz, con dependencias instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/services/confirmarRetiroSimulado.test.ts src/screens/afiliaciones/ConfirmarRetiroSimulado.test.js src/screens/afiliaciones/SolicitudRetiroSimulado.test.js src/screens/afiliaciones/SaldoAfiliado.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
# Desde app-mobile:
# $env:CI = '1'
# node node_modules/expo/bin/cli export --platform android --max-workers 2
```

| Paso que produce el estado | Resultado esperado y comprobado por la regresión |
|---|---|
| Disponible $700, revisar $500 | Sin POST; muestra monto y destino ficticio |
| Confirmar y perder la respuesta después de persistir en el servidor simulado | Disponible del servidor $200; la pantalla ofrece recuperar y bloquea cambiar el monto |
| Pulsar Recuperar retiro | Segundo POST con cuerpo idéntico; misma referencia; un retiro y un solo descuento de $500 |
| Confirmar dos veces con la primera respuesta pendiente | Un POST; campo no editable y confirmación deshabilitada/ocupada |
| Retirar los $700, perder la respuesta, salir y volver | Recuperación disponible con saldo $0; no exige fondos para volver a crear un retiro |
| Cambiar de cuenta antes de recibir el comprobante | La nueva cuenta no muestra la referencia ni el monto anteriores |
| Responder 401 o 403 | Desaparece el saldo y no aparece Recuperar retiro |
| Fallar la escritura local antes del POST | Ningún envío |
| Fallar la escritura del comprobante tras el POST | Recuperación con la clave original |

La pantalla, el servicio, AsyncStorage y el cliente HTTP se ejecutan juntos;
Auth, transporte, almacenamiento nativo y UUID tienen dobles controlados.
No se presenta este escenario como evidencia de deduplicación SQL real.

## Integración con gateway y V14

El runner de C15 `--a06` crea, después de sus comprobaciones, otra campaña
y una afiliación aprobada con código activo para el estudiante del fixture.
Añade una comisión **desechable** disponible de $600 sin reactivar el código
que A06 había desactivado. Monta la pantalla real
con una sesión emitida por Auth y llama a Nginx → ms-afiliados → PostgREST → V14.
El transporte HTTP descarta la primera respuesta de retiro solo después de recibir
HTTP 200, de modo que el retiro ya está confirmado en PostgreSQL.

```powershell
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
```

El caso exige dos POST idénticos por $500, la referencia original en pantalla,
una sola fila de retiro por cuenta/clave y saldo disponible final $100. El runner
imprime `PASS A12` con solicitudes, referencia y resultado, sin JWT. El job existente
`mobile-afiliaciones` ejecuta este escenario, sin habilitar operaciones en Cloud.
Las migraciones oficiales V12/V13/V14 se leen desde el repositorio complementario,
sin copiarlas ni aplicarlas al entorno del usuario. El runner elimina sus recursos.

## Archivos y alcance

- [Servicio y persistencia](../../../app-mobile/src/services/confirmarRetiroSimulado.ts).
- [Formulario](../../../app-mobile/src/screens/afiliaciones/SolicitudRetiroSimulado.js) y
  [saldo](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.js).
- [Pruebas de servicio](../../../app-mobile/src/services/confirmarRetiroSimulado.test.ts),
  [pantalla](../../../app-mobile/src/screens/afiliaciones/ConfirmarRetiroSimulado.test.js) e
  [integración](../../../app-mobile/src/screens/afiliaciones/ConfirmarRetiroIntegracion.test.js).
- [Runner desechable](../../../.github/scripts/test-mobile-afiliacion-a06.cjs).

No se ejecuta un emulador ni se acredita el APK desplegado. No se usan cuentas
reales, datos bancarios ni Cloud. La ejecución de CI del nuevo commit se comprueba
cuando se publique la rama; una ejecución local no acredita un despliegue.

## Resultado de la ejecución local

- Suite móvil completa: **403 PASS**, **3 integraciones opt-in omitidas**, 39 suites aprobadas.
- TypeScript: sin errores. Exportación Android con Expo/Metro y dos workers: aprobada.
  176 enlaces relativos correctos; `git diff --check`: aprobado.
- Runner desechable: **A06/A09/A10/A11/A08 y C15 conservados**, **A12 PASS**,
  siete escenarios C05/E08 aprobados. Se ejecutaron dos pruebas móviles con
  servicios reales; las tres integraciones solo se omiten en la suite normal.
- A12: dos POST por $500 con la clave de prueba
  `00000000-0000-4000-8000-000000000001`, referencia V14
  `a745a719-1da1-48c2-8688-3db5c7cc5e53`, **1 fila por $500**, disponible final **$100**.
  La primera respuesta se perdió después del commit; la segunda recuperó esa referencia.
- Dependencia SQL: migraciones oficiales de `db_CoffeeFaster` en el commit
  `8b80271`, leídas desde una copia aislada. PostgreSQL desechable con imagen
  `postgres:15`, Auth `supabase/gotrue:v2.197.0`, PostgREST `postgrest/postgrest:v16.3`.
- Los recursos creados por el runner se eliminaron. Docker volvió a su estado
  apagado inicial. No se alteraron datos de los entornos existentes ni Cloud.
