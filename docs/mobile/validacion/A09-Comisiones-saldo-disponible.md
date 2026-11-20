# A09 · Comisiones pendientes, disponibles y retiradas

20 de noviembre de 2026. Rama `S3-T9-Ariel-Diaz-Mostrar-comisiones-y-saldo-disponible`,
basada en A06 (`a9e1f1c`). A07 y A08 no son dependencias de esta tarea.

## Dependencia V12 confirmada

Se contrastaron la [migración V12](https://github.com/Diego24Vas/db_CoffeeFaster/blob/884f25698e76df7d50a08b8a0d0a81a1059733e9/supabase/migrations/20261118211348_consulta_saldo_afiliado.sql)
y sus [pruebas oficiales](https://github.com/Diego24Vas/db_CoffeeFaster/blob/884f25698e76df7d50a08b8a0d0a81a1059733e9/tests/saldo_afiliado.cjs).
La rama `V12-CAM-181-DiegoVasquez-Implementar_consulta_saldo_afiliado` tiene ese
commit, pero no está integrada en `main` al revisar. No se aplicó SQL en Cloud.

La RPC `consultar_saldo_afiliado()` obtiene la identidad del JWT. Devuelve una
fila con `pendiente_clp`, `disponible_clp` y `retirado_clp`, calculados en una
misma instantánea sobre todas las afiliaciones propias. El disponible resta
los retiros confirmados y excluye pendientes y comisiones revertidas.

A09 usa la RPC autenticada directamente mediante el cliente Supabase existente;
no incorpora la rama C15 del gateway, que no es dependencia de esta tarea.
El entorno de destino necesita V12 instalada antes de usar esta pantalla. Si
la función falta, se muestra error y no se presenta una suma parcial como saldo.

## Comportamiento

Perfil → Mis afiliaciones → Ganancias muestra un solo saldo del estudiante:
pendiente, disponible para retirar y retirado. El resumen también aparece al
abrir Historial; los movimientos permanecen agrupados por afiliación, sin
rotular sus sumas como monto retirable. No se descuenta un retiro dos veces.

El código desactivado conserva acceso a saldo e historial. Al abrir una vista,
actualizar las solicitudes o volver al foreground se vuelve a consultar el
saldo. «Actualizar saldo» permite hacerlo manualmente. Durante carga no se
inventan ceros; el error transitorio conserva la última consulta con aviso.
Los errores de sesión/permisos retiran los importes anteriores. El 403 no
ofrece reintento. Al cambiar de cuenta o desmontar se descartan respuestas tardías.

El cliente exige montos enteros representables sin pérdida de precisión. Permite
el disponible negativo que contempla V12 y lo muestra sin convertirlo a cero.
Las pendientes y los retirados no pueden ser negativos. La Wallet de compras
es independiente y no se modifica. No se añade botón ni operación de retiro.

## Archivos

- [Servicio V12](../../../app-mobile/src/services/saldoAfiliado.ts) y [pruebas](../../../app-mobile/src/services/saldoAfiliado.test.ts).
- [Resumen de saldo](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.js) y [pruebas](../../../app-mobile/src/screens/afiliaciones/SaldoAfiliado.test.js).
- [Pantalla principal](../../../app-mobile/src/screens/MisAfiliacionesScreen.js),
  [historial](../../../app-mobile/src/screens/afiliaciones/ComisionesAfiliado.js),
  pruebas de [perfil](../../../app-mobile/src/screens/PerfilAfiliaciones.test.js)
  y [afiliaciones](../../../app-mobile/src/screens/afiliaciones/AfiliacionMovil.test.js).
- [Integración Mobile](../../../app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js)
  y runners [Auth/BD](../../../.github/scripts/test-afiliados-auth-integration.cjs)
  y [preparación Mobile](../../../.github/scripts/test-mobile-afiliacion-a06.cjs).
- Contrato, índice y estado funcional.

## Registro reproducible

Windows, Node.js 22.19.0. Desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
git diff --check
```

La preparación de dependencias y las migraciones `0020`, `0021`, `0023` y
`0024` son las de [A06](A06-Solicitudes-aprobacion.md). El runner descarga
adicionalmente V12 desde el SHA fijado anterior y la aplica solo en PostgreSQL
desechable. El job existente `mobile-afiliaciones` ejecuta este mismo recorrido.
Requiere conexión al archivo oficial. Auth, PostgREST, RPC y RLS no se sustituyen.

### Datos y pasos del escenario

Se aprueba una afiliación del estudiante 901 mediante C05. El fixture prepara
tres pedidos y comisiones: pedido 1001 listo, comisión pendiente $500; pedidos
1002/1003 entregados, comisiones disponibles $600/$400. Se inserta un retiro
histórico confirmado de $300 como dato de prueba, no como operación de retiro.

| Paso que produce el estado | Pendiente | Disponible neto | Retirado |
|---|---:|---:|---:|
| Abrir Ganancias antes de la entrega del pedido 1001 | $500 | $700 | $300 |
| Consultar la RPC con el JWT del mismo estudiante | $500 | $700 | $300 |
| Consultar la RPC con otro estudiante sin movimientos | $0 | $0 | $0 |
| Cambiar el pedido 1001 a entregado y su comisión a disponible en una transacción del fixture; pulsar Actualizar saldo | $0 | $1.200 | $300 |
| Desactivar el código por C05; actualizar y abrir Historial | $0 | $1.200 | $300 |
| Desmontar/reabrir con el mismo JWT | $0 | $1.200 | $300 |

Antes de la entrega, el disponible es $600 + $400 − $300 = $700. Los $500
pendientes quedan fuera. Después, la RPC añade los $500 liberados al disponible
y mantiene los $300 retirados. Las aserciones comparan el valor recibido por el
SDK, los textos mostrados y la consulta del segundo estudiante. PostgREST sigue
limitado a dos filas para comprobar también el historial de tres movimientos.

Resultados locales: **224/224 pruebas móviles PASS en 22 suites**, con dos
integraciones omitidas en la ejecución normal; **54 pruebas enfocadas PASS**.
TypeScript, 111 enlaces relativos y `git diff --check` aprobados. El runner
pasó **1/1 integración Mobile con V12 y seis escenarios C05**. Los contenedores,
volúmenes, red y archivos temporales se eliminaron al finalizar.

Exportación Android: **PASS**, bundle Hermes y recursos. Se usaron
`EXPO_NO_DOTENV=1`, `EXPO_OFFLINE=1`, `CI=1`, URLs locales y una clave pública
sintéticas. Desde `app-mobile`: `node node_modules/expo/bin/cli export
--platform android --max-workers 2 --output-dir RUTA_DE_SALIDA`.
No construye ni instala un APK.

**Límite de la transición:** esta prueba cambia el estado del pedido y del
movimiento directamente en una transacción desechable. No prueba un trigger
V11 ni una entrega por QR/token del KDS. No se encontró esa automatización en
las ramas oficiales consultadas. Falta repetir la entrega real cuando esté
integrada; no se presenta el fixture como evidencia de ese flujo completo.

Este registro acredita los estados antes/después y la lectura propia de V12,
sin una nueva captura en emulador ni APK desplegado. No se modificaron Cloud,
configuraciones locales, credenciales ni datos productivos.
