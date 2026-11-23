# A10 · Historial de ganancias y retiros

23 de noviembre de 2026. Rama `S3-T10-Ariel-Diaz-Mostrar-historial-ganancias-y-retiros`,
basada en `develop` (`cad8bd8`). Dependencias: A09 y V14.

## Contrato contrastado

Se consultó `develop` de `Diego24Vas/db_CoffeeFaster` en el SHA
[`8b80271a30fcf1940edc531cf7bbc0c910327de1`](https://github.com/Diego24Vas/db_CoffeeFaster/tree/8b80271a30fcf1940edc531cf7bbc0c910327de1).
La carpeta local de BD está en otra revisión y tiene modificaciones ajenas; se
conservó intacta. No se copian migraciones al repositorio de la aplicación.

CI fija el commit oficial de V14
[`80bbc91ebf7766d849332d2a73b02b0f7265568f`](https://github.com/Diego24Vas/db_CoffeeFaster/commit/80bbc91ebf7766d849332d2a73b02b0f7265568f).
Las siete migraciones utilizadas por esta integración son idénticas en ambos
SHA (comparación SHA-256). El `develop` de BD consultado añade
`20261123050000` sin actualizar la lista esperada de `tests/migraciones.cjs`,
por lo que su `npm test` falla antes de ejecutar SQL. No se modifica ese
repositorio ni se omite su suite: se usa la versión oficial de V14 anterior
a esa discrepancia para la preparación de CI.

- [V12](https://github.com/Diego24Vas/db_CoffeeFaster/blob/8b80271a30fcf1940edc531cf7bbc0c910327de1/supabase/migrations/20261118211348_consulta_saldo_afiliado.sql)
  permite `SELECT` de `retiros_afiliado` con RLS propia del estudiante. Sus filas
  representan exclusivamente retiros confirmados e inmutables; **no existe una
  columna `estado` en esta tabla**. Por ese contrato se rotulan «confirmado».
- [V14](https://github.com/Diego24Vas/db_CoffeeFaster/blob/8b80271a30fcf1940edc531cf7bbc0c910327de1/supabase/migrations/20261123020643_comprobante_retiro_simulado.sql)
  incorpora `referencia` UUID única. Las filas anteriores conservan `NULL` y la
  pantalla indica «Sin comprobante: retiro histórico»; no inventa referencias.
- Comisiones y reversiones mantienen la lectura autenticada de V04 y su estado
  persistido, agrupadas por cafetería/campaña. El resumen global sigue usando
  V12: no suma las tarjetas como disponible ni resta otra vez las reversiones.

## Comportamiento y archivos

Perfil → Mis afiliaciones → Historial muestra «Historial de ganancias y
retiros». Un bloque de retiros para toda la cuenta evita duplicarlos cuando
hay varias afiliaciones; los bloques de comisiones conservan su contexto.
Cada movimiento muestra importe CLP, fecha/hora local y estado. Un retiro se
muestra como salida (`-$100`); la referencia es seleccionable.

«Buscar retiro por referencia de comprobante» admite la referencia completa o
un fragmento, ignora mayúsculas y espacios externos. Filtra solo los retiros;
las comisiones no desaparecen. «Limpiar búsqueda» restaura el listado. Una
búsqueda sin coincidencias se distingue de una cuenta sin retiros.

- [Servicio de retiros](../../../app-mobile/src/services/retirosAfiliado.ts) y
  [pruebas](../../../app-mobile/src/services/retirosAfiliado.test.ts): lectura SDK
  con JWT/RLS, renovación de sesión, `count: 'exact'` y páginas de hasta 200.
  Si PostgREST limita a menos filas, continúa desde el número realmente recibido.
  Rechaza totales cambiantes, páginas incompletas, filas duplicadas, importes no
  representables, fechas inválidas y referencias que no respetan V14. No publica
  un historial parcial. El límite defensivo es 50 páginas; al superarlo da error.
- [Vista de retiros](../../../app-mobile/src/screens/afiliaciones/RetirosAfiliado.js)
  y [pruebas](../../../app-mobile/src/screens/afiliaciones/RetirosAfiliado.test.js):
  carga, vacío, búsqueda y actualización. Un fallo transitorio conserva la última
  consulta con aviso; 401/403 retiran los datos y no ofrecen reintento. Una
  respuesta atrasada de una revisión anterior o tras desmontar no se publica.
- [Mis afiliaciones](../../../app-mobile/src/screens/MisAfiliacionesScreen.js) y
  [regresión del recorrido](../../../app-mobile/src/screens/afiliaciones/AfiliacionMovil.test.js):
  entrada existente, sin ruta nueva ni pérdida de sesión. El perfil ya monta
  esta pantalla con la identidad Auth como clave al cambiar de cuenta.
- [Integración](../../../app-mobile/src/screens/afiliaciones/AfiliacionIntegracion.test.js),
  [runner desechable](../../../.github/scripts/test-afiliados-auth-integration.cjs)
  y [workflow](../../../.github/workflows/ci-functional.yml): escenario A10 dentro
  de `--a06`; el job `mobile-afiliaciones` fija el SHA de BD que incluye V14.

Al abrir Historial, actualizar solicitudes o regresar al foreground se consultan
los retiros. «Actualizar retiros» repite la lectura y conserva la búsqueda.
La app **no llama a `registrar_retiro_simulado`**. El formulario A11 continúa
siendo una revisión local sin envío ni débito. La lectura no mueve la Wallet.

## Prueba reproducible y estado resultante

Desde la raíz, con Node.js 22 y las dependencias instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
```

Pruebas focalizadas de pantalla, consulta y recorrido:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/services/retirosAfiliado.test.ts src/screens/afiliaciones/RetirosAfiliado.test.js src/screens/afiliaciones/AfiliacionMovil.test.js
```

Para integración, usar una copia de BD en `80bbc91ebf7766d849332d2a73b02b0f7265568f` y Docker activo;
no apuntar a Cloud ni a un contenedor existente:

```powershell
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
git diff --check
```

El runner crea y elimina sus contenedores, cuentas y JWT. Aplica V12/V13/V14
oficiales sobre el fixture mínimo de A06; reproduce únicamente el esquema
privado y sus permisos de V06 requeridos por V13/V14, sin instalar la cotización.
Auth, JWT, gateway, PostgREST y RLS son reales. No reproduce todo el esquema de
negocio de Cloud. El render es con React Test Renderer, sin APK ni captura visual.

| Paso que produce el estado | Resultado comprobado |
|---|---|
| Aprobar al estudiante desechable por C05 y abrir Historial | Comisiones propias de pedidos 1001/1002/1003, con importe, fecha y estado; el código desactivado no oculta el historial |
| Registrar con el fixture dos retiros de $100/$50 mediante la RPC oficial V14, además del histórico $300 | Tres retiros; PostgREST limita a dos por página y la pantalla recupera los tres |
| Preparar pedido 1004 con comisión $200 revertida y compensación -$200 en una transacción válida de V04 | Aparecen Comisión y Reversión, ambas `revertida`, sin descontar dos veces del saldo |
| Reabrir Ganancias y después Historial | Disponible neto $1.050, retirado $450; el saldo sigue siendo el de V12 |
| Introducir la referencia devuelta por V14 en el buscador | Se localiza únicamente el retiro de $100; desaparece el de $50 del bloque filtrado |
| Buscar `no-existe` y después limpiar | Mensaje sin coincidencias; se recupera la lista completa al limpiar |
| Consultar retiros con JWT de otro estudiante | Lista vacía por RLS; no aparecen comprobantes de la cuenta de prueba |
| Consultar el libro después de navegar y buscar | Siguen exactamente tres filas y $450: la lectura no crea retiros |
| Simular red caída, reintentar y completar una respuesta atrasada | Se conserva la consulta anterior con aviso; se recupera con reintento y se descarta la respuesta obsoleta |

La reversión y la entrega de los pedidos son datos del fixture: no acreditan
cancelación real ni entrega desde KDS. Los retiros del fixture son simulados,
con destino ficticio; no hay transferencias ni pagos reales. No se aplicó SQL
ni se modificaron datos de Cloud. La prueba visual del APK queda pendiente.

## Resultados locales

Windows, Node.js 22.19.0:

- Pruebas focalizadas: **49/49 aprobadas** en tres suites.
- Suite móvil completa: **357 aprobadas y dos integraciones opt-in omitidas**,
  34 suites aprobadas. Se ejecutó con el timeout normal de Jest.
- Integración `--a06`: **PASS**, incluidos el recorrido A10 y los siete escenarios
  C05/E08 con JWT de Auth y RLS reales. La salida incluye
  `PASS A10: comisión y reversión $200; tres retiros paginados con límite 2; comprobante V14 localizable, RLS ajena vacía; lectura sin nuevos débitos`.
- TypeScript sin errores; exportación Android de Expo aprobada con un trabajador,
  `EXPO_NO_DOTENV=1`, `EXPO_OFFLINE=1` y variables sintéticas. Es un bundle,
  no un APK ejecutado.
- Suite oficial completa de BD (`npm test` en `80bbc91`, PostgreSQL 17
  desechable): **PASS**, incluidos saldo V12 y comprobante V13/V14. El
  contenedor propio se eliminó al terminar.
- Enlaces relativos de los tres documentos: **136/136**; `git diff --check` limpio.

La ejecución remota de CI corresponde al futuro PR; estos resultados son locales.
