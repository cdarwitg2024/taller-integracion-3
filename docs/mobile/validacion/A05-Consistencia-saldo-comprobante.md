# A05 · Corregir inconsistencias de saldo y comprobante en móvil

24 de noviembre de 2026. Rama `S3-T05-Ariel-Diaz-Corregir-inconsistencias-saldo-y-comprobante`,
basada en A13 `f080c34` ([PR #126](https://github.com/cdarwitg2024/taller-integracion-3/pull/126)).
A13 y A12 seguían abiertas al comenzar esta tarea; integrar primero
[A12 #125](https://github.com/cdarwitg2024/taller-integracion-3/pull/125) y después A13
antes de comparar A05 contra `develop`. Actualización del 25 de noviembre: A12 ya
está integrada y esta rama incorpora `origin/develop` en `7202239`. A13 sigue abierta;
su corrección `36d75b0` recupera el comprobante al reabrir con fallo de saldo y ya
está incorporada a esta rama. Integrar A13 en `develop` y volver a comprobar el
diff de A05 antes del merge. A14 ya forma parte de la base (se comprobó
que `786b65b` es antecesor de la rama). A12 y A13 tienen 13 controles remotos aprobados.

Dependencias: [A13](A13-Comprobante-y-actualizacion-saldo.md) y
[A14](A14-Cambio-cuenta-afiliaciones.md). Alcance: corrección del piloto de carrito completo.

## Fallos reproducidos antes de corregir

### Saldo e historial desincronizados tras una entrega

Con la misma cuenta y el Historial abierto, una comisión de $500 pasa de pendiente
a disponible. Al volver a la app, el refresco de solicitudes actualizaba V12 y
mostraba disponible $1.200, pero la tarjeta seguía indicando **$500 · pendiente**.
«Actualizar saldo» también actualizaba únicamente V12 y conservaba esa tarjeta.

Causa: el efecto de `ComisionesAfiliado` dependía del ID, el código activo y su
botón individual; no observaba la revisión del perfil ni los refrescos del saldo.

Corrección: el perfil renovado y la revisión compartida de movimientos invalidan
la lectura anterior de comisiones. «Actualizar saldo» consulta el saldo, los
retiros y las comisiones de la misma cuenta. No se agregan temporizadores ni
operaciones de escritura a las lecturas.

### Rechazos de acceso tratados como errores transitorios

Después de cargar saldo e historial, un HTTP 401/403 del SDK con `error.message`
y sin `error.code` se convertía en un fallo genérico: seguía visible la consulta
anterior con un aviso de conservación. Se reprodujo tanto para saldo como para
comisiones. El lector de retiros A10 ya contemplaba el estado HTTP.

Corrección: saldo y comisiones conservan el estado HTTP del SDK, además de los
códigos PostgREST. Ante 401/403 se retiran los importes y filas previos y se muestra
el motivo de sesión/permisos; comisiones deja de ofrecer el botón individual.
Un 503 sigue conservando la última consulta autorizada con aviso, sin habilitar
un retiro con un saldo no confirmado.

## Registro antes y después

Las primeras regresiones sobre A13 terminaron con **4 fallos / 1 caso aprobado**:
dos por la comisión pendiente obsoleta y dos por saldo visible tras 401/403. El
control 503 pasó. Al ampliar el caso a comisiones se reprodujeron otros **2 fallos**
de autorización, con cuatro controles ya aprobados. Las pruebas se escribieron y
ejecutaron antes de modificar esos comportamientos.

Después de corregir, las cinco suites enfocadas aprobaron **60 pruebas**. Incluyen
la secuencia completa con entrega, retiro con respuesta perdida, recuperación y
reapertura, así como los lectores de saldo/comisiones y los controles de A13.

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/afiliaciones/ConsistenciaSaldoComprobante.test.js src/screens/afiliaciones/SaldoAfiliadoAcceso.test.js src/screens/afiliaciones/ComprobanteRetiro.test.js src/services/saldoAfiliado.test.ts src/services/afiliaciones.test.ts --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/CambioCuentaAfiliaciones.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
```

Para contrastar el fallo inicial, usar una copia aislada de `f080c34` e incorporar
los dos archivos nuevos de regresión; no retroceder ni reemplazar el trabajo actual.
Las pruebas con respuestas controladas montan las pantallas y el cliente HTTP;
no se presentan como evidencia de transacciones SQL.

## Integración: misma cuenta antes y después del retiro

El runner C15/A12/A13 se amplió con A05. Mantiene al estudiante de prueba **901**
y su JWT real, y usa Nginx, ms-afiliados, PostgREST y PostgreSQL desechables.
Después de comprobar A13 prepara una comisión pendiente de $500 para un pedido
`listo`. La transición de entrega se realiza **de forma controlada en el fixture**:
cambia el pedido a entregado y la comisión a disponible en una transacción.
**No acredita KDS, la RPC V11 ni una entrega real.** Sí comprueba que la interfaz
vuelve a consultar y muestra el estado persistido con V12/V04.

```powershell
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
```

| Paso que produce el estado | Pendiente | Disponible | Retirado acumulado | Resultado observado |
|---|---:|---:|---:|---|
| Abrir/actualizar Historial con la comisión de prueba pendiente | $500 | $100 | $2.000 | Tarjeta $500 · pendiente |
| Aplicar la entrega controlada y emitir el regreso a la app | $0 | $600 | $2.000 | Tarjeta $500 · disponible; no queda pendiente |
| Preparar otro retiro por $500 y perder su respuesta después del commit | $0 | Operación confirmada en servidor | $2.500 en servidor | Recuperar retiro con la misma solicitud |
| Recuperar la solicitud | $0 | $100 | $2.500 | Mismo comprobante, una fila por $500 |
| Salir y reabrir Historial | $0 | $100 | $2.500 | Misma referencia; no se añade un POST |

La referencia del retiro A05 fue **`65a38a16-fbea-4037-b62c-e885669e79ea`**.
PostgreSQL confirmó **una fila por $500** para esa cuenta y clave. El historial
mostró el mismo comprobante y el saldo neto. Los cuatro POST del escenario ampliado
corresponden a dos retiros distintos (A12 y A05), con una respuesta perdida y una
recuperación cada uno; A05 conserva su propia clave en sus dos envíos.
Los $2.000 previos incluyen los retiros desechables de los escenarios anteriores,
no son el monto de un único retiro.

El aviso de respuesta incierta desaparece al recuperar el comprobante. Reabrir no
vuelve a escribir. El runner imprime `PASS A05` con los importes antes/después, la
referencia y el conteo SQL, sin JWT. La consulta de V12 evita descontar localmente
otra vez y los pendientes no se añaden al monto retirable.

## Archivos y límites

- [Coordinación de las vistas](../../../app-mobile/src/screens/MisAfiliacionesScreen.js),
  [saldo](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.js) y
  [comisiones](../../../app-mobile/src/screens/afiliaciones/ComisionesAfiliado.js).
- Lectores de [saldo](../../../app-mobile/src/services/saldoAfiliado.ts) y
  [comisiones](../../../app-mobile/src/services/afiliaciones.ts).
- [Regresión del flujo](../../../app-mobile/src/screens/afiliaciones/ConsistenciaSaldoComprobante.test.js),
  [acceso HTTP](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliadoAcceso.test.js) y
  [prueba A14](../../../app-mobile/__tests__/CambioCuentaAfiliaciones.test.js).
- [Integración ampliada](../../../app-mobile/src/screens/afiliaciones/ConfirmarRetiroIntegracion.test.js),
  ejecutada por el job existente `mobile-afiliaciones`.

La prueba de A14 contempla las lecturas adicionales de movimientos que inicia
«Actualizar saldo» y resuelve todas sus respuestas pendientes tras cambiar de
cuenta; conserva las comprobaciones de ausencia de datos ajenos.
Las migraciones oficiales se leyeron desde la copia aislada `8b80271` de
`db_CoffeeFaster`, con `postgres:15`, Auth `supabase/gotrue:v2.197.0` y PostgREST
`postgrest/postgrest:v16.3`. El runner elimina sus contenedores y Docker vuelve a su
estado apagado inicial. No se modifican Cloud, datos bancarios ni datos existentes.
No se ejecutó un APK en emulador. La CI del commit A05 se verifica al publicarlo.

## Resultado de la implementación inicial

- **416 pruebas móviles aprobadas**, 42 suites; tres integraciones opt-in omitidas
  en la suite normal. Las cinco suites enfocadas pasaron 60 pruebas y A14 pasó
  sus cuatro escenarios con todas las respuestas tardías retenidas.
- **Integración A05 aprobada**, además de A12/A13 y los escenarios anteriores de
  A06/A09/A10/A11/A08, C15 y siete casos C05/E08.
- TypeScript y exportación Android con Expo/Metro aprobados.
- 175 enlaces relativos sin roturas y `git diff --check` aprobado.

## Ajuste tras revisión: solicitudes con HTTP 503 al volver a la app

25 de noviembre de 2026. Se reprodujo el hallazgo con la regresión nueva y el
código anterior de `MisAfiliacionesScreen`: al entregar una comisión de $500 y
volver a primer plano, un 503 únicamente en solicitudes dejaba disponible **$700**
y la comisión **pendiente**, aunque saldo y movimientos podían devolver **$1.200**
y **disponible**. La regresión falló al esperar el importe actualizado.

La pantalla ahora avanza una revisión de consultas al iniciar el refresco, sin
esperar el resultado de solicitudes. Saldo, retiros y comisiones observan esa
revisión y conservan sus controles de respuestas tardías. Al navegar, las vistas
inician sus propias lecturas sin repetirlas por esta revisión. El error de
solicitudes continúa visible; no se registra ningún retiro durante el refresco.

| Paso reproducible con servicios controlados | Resultado observado |
|---|---|
| Abrir Historial con la cuenta de prueba | Disponible $700; comisión $500 pendiente; retiros vacíos |
| Simular entrega, agregar un retiro histórico y rechazar únicamente solicitudes con 503 | Los lectores financieros siguen disponibles |
| Emitir `AppState: active` | Disponible $1.200; comisión $500 disponible; comprobante histórico visible; aviso de solicitudes conservado; cero POST |
| Repetir el regreso con solicitudes rechazadas con 401 o 403 | Se retiran el panel y los datos financieros; aparece el motivo de sesión/permisos |

La prueba de A14 retiene ahora nueve respuestas, incluidas las tres lecturas
financieras que se inician mientras el perfil está pendiente, y comprueba que
ninguna muestra datos de la cuenta anterior al resolverse tras logout o cambio
de estudiante. Se conserva la regresión A13 de una sola lectura de saldo tras
confirmar un retiro y la recuperación manual cuando esa lectura falla.

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/afiliaciones/ConsistenciaSaldoComprobante.test.js src/screens/afiliaciones/SaldoAfiliadoAcceso.test.js src/screens/afiliaciones/ComprobanteRetiro.test.js src/screens/afiliaciones/AfiliacionMovil.test.js __tests__/CambioCuentaAfiliaciones.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Las cinco suites enfocadas aprobaron **40 pruebas** con Node.js **22.19.0** en
Windows. La suite completa aprobó **419 pruebas en 42 suites**, con tres
integraciones opt-in omitidas; TypeScript, los 11 enlaces relativos de este
registro y `git diff --check` pasaron. Las verificaciones de esta revisión usan servicios simulados; no se
repitieron Docker, Supabase Cloud, la entrega desde KDS ni el APK. Los resultados
de la integración inicial arriba conservan su alcance y fecha. La CI del nuevo
commit se verifica por separado. A13 sigue siendo una dependencia pendiente de merge.

## Composición con el ajuste de A13

El mismo 25 de noviembre se incorporó `36d75b0` desde la rama de A13 sin conflictos.
La combinación conserva el refresco financiero independiente de solicitudes y
recupera el comprobante de la cuenta activa si falla temporalmente el saldo al
reabrir Ganancias. El comprobante muestra su saldo histórico como «al confirmar»;
sin saldo vigente no ofrece formulario ni preparar otro retiro. HTTP 401/403
siguen retirando el comprobante. Ver la reproducción y los límites en
[el registro A13](A13-Comprobante-y-actualizacion-saldo.md#ajuste-tras-revisión-recuperar-el-comprobante-al-reabrir-sin-saldo).

Sobre la combinación: **423 pruebas aprobadas en 42 suites**, tres integraciones
opt-in omitidas; TypeScript, enlaces relativos de A05/A13 y `git diff --check`
correctos con Node.js 22.19.0. Son pruebas con servicios simulados; la CI del nuevo
SHA se verifica por separado y A13 sigue pendiente de aprobación y merge.
