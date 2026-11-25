# A15 · Validar solicitud, aprobación y ganancias en móvil

Registro local del 24 de noviembre de 2026; verificación de CI del 25 de noviembre de 2026.
Rama `S3-T15-Ariel-Diaz-Validar-solicitud-aprobacion-y-ganancias-en-movil`,
basada en A05 `fbfe3b7` ([PR #127](https://github.com/cdarwitg2024/taller-integracion-3/pull/127)).
La validación reutiliza [A07](A07-Compartir-codigo-personal.md),
[A13](A13-Comprobante-y-actualizacion-saldo.md), [A14](A14-Cambio-cuenta-afiliaciones.md)
y el contrato de aprobación de [E10](../../desktop/validacion/E10-Aprobar-afiliados-y-gestionar-codigos.md).
A12 (#125), A13 (#126) y A05 (#127) seguían abiertas al preparar esta rama;
conservar ese orden de integración antes de comparar A15 contra `develop`.

## Alcance

Se añade una prueba reproducible, no una implementación paralela del flujo.
No se modificó código de aplicación. La pantalla React Native real se monta
con una cuenta ficticia nueva y consulta los servicios de un entorno desechable:
Nginx, ms-afiliados, Supabase Auth, PostgREST, RPC y políticas RLS.

El estudiante **902** comienza sin solicitudes, códigos, comisiones ni retiros.
Su correo `a15-<UUID>@example.test`, contraseña y JWT se generan para la ejecución
y no se registran. El dueño también usa una sesión ficticia emitida por Auth,
con acceso a la cafetería 7. La campaña aislada se llama **Piloto A15**.

La aprobación y la desactivación utilizan la misma ruta C05 y cuerpo de decisión
que consume E10: GET de solicitudes y PATCH con `decision: aprobar/desactivar`.
Se contrastó con `listarSolicitudes`/`resolverSolicitud` del servicio de escritorio.
**No se ejecutó Electron ni se pulsó su interfaz.**

El portapapeles y `Share.share` tienen dobles nativos: se comprueba que reciben
exactamente el código devuelto por SQL y el contexto de campaña/cafetería.
**Esta corrida no abre el selector de un teléfono ni valida su portapapeles físico.**
La evidencia histórica en dispositivo de A07 conserva su fecha y alcance.

## Registro de pasos y resultados

| Paso que produce el estado | Resultado esperado y verificado |
|---|---|
| Abrir Mis afiliaciones con el estudiante nuevo | Sin solicitudes y sin accesos a código, ganancias o historial |
| Entrar a Oportunidades → Norte A06 → Piloto A15, completar el plan y enviar | Solicitud pendiente; no aparece código ni panel financiero |
| Consultar las solicitudes con la sesión del dueño | La solicitud pertenece a la campaña elegida |
| Aprobar por C05 con el JWT del dueño y actualizar Mis solicitudes | Estado aprobado, código asignado por el servidor y panel habilitado |
| Ir a Mis códigos y pulsar Copiar | El portapapeles de prueba recibe el código exacto; aparece la confirmación de copia |
| Pulsar Compartir | `Share.share` recibe el código exacto y campaña/cafetería correctas |
| Preparar comisiones ficticias: $1.200 disponible y $300 pendiente | Ganancias muestra pendiente $300, disponible $1.200 y retirado $0 |
| Revisar y confirmar un retiro simulado de $500 | Un POST a C15; V14 registra un retiro, V12 devuelve disponible $700 y retirado $500 |
| Ver el comprobante y abrir Historial | Misma referencia de PostgreSQL y monto `-$500 · confirmado`; comisión $1.200 disponible conservada |
| Desactivar la afiliación por C05 y actualizar Mis solicitudes | Código desactivado, sin botones para copiar/compartir; historial y ganancias siguen accesibles |
| Cotejar saldo antes y después de la desactivación | Mismos pendiente $300, disponible $700 y retirado $500 |
| Intentar atribuir una comisión nueva a la afiliación desactivada | El trigger oficial rechaza la operación; la transacción no deja pedido ni movimiento nuevos |
| Salir, volver a abrir Historial | Mismo comprobante y disponible $700; una sola fila de retiro y ningún POST adicional |

Las ganancias se preparan como **datos ficticios persistidos**: pedido 2015
entregado con comisión disponible de $1.200 y pedido 2016 listo con comisión
pendiente de $300. No se ejecutan una compra, un débito de Wallet ni una entrega KDS.
Los pendientes no se incluyen en el monto retirable.

La comprobación del código desactivado cubre la retirada de sus acciones móviles,
el `codigo_activo: false` de C05 y el rechazo real de una **atribución nueva** por
`validar_codigo_afiliacion`. La transacción del intento se revierte y se comprueba
que el pedido 2017 no existe. **No se ejecuta una compra con C07/V08 ni se acredita
el rechazo del descuento en un checkout desplegado.** Los movimientos previos y
el retiro confirmado permanecen consultables.

## Reproducir

Windows, Node.js 22.19.0. Desde la raíz, con dependencias instaladas y Docker activo:

```powershell
$env:COFFEEFAST_DB_MIGRATIONS = 'RUTA_ABSOLUTA/db_CoffeeFaster/supabase/migrations'
$env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
$env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
node .github/scripts/test-afiliados-auth-integration.cjs --a06
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

El runner crea la cuenta y la campaña, pasa únicamente credenciales efímeras al
proceso de prueba y ejecuta `PilotoAfiliadoIntegracion.test.js`. La aprobación se
realiza dentro del escenario después de comprobar la restricción pendiente.
Se imprimen `PASS A15 pendiente`, `aprobada`, `retiro` y `desactivada`, con IDs,
importes y referencia; no se imprimen JWT ni contraseñas.

La prueba está conectada al job existente `mobile-afiliaciones`. Sin las variables
efímeras del runner es opt-in y se omite en la suite normal. El contenedor y las
cuentas del entorno desechable se eliminan al finalizar. La fuente de migraciones
se distingue por corrida:

- **Local (24/11):** copia aislada de `db_CoffeeFaster`
  [`8b80271a30fcf1940edc531cf7bbc0c910327de1`](https://github.com/Diego24Vas/db_CoffeeFaster/tree/8b80271a30fcf1940edc531cf7bbc0c910327de1),
  mediante `COFFEEFAST_DB_MIGRATIONS`.
- **CI (25/11, run 45537079299):** checkout de
  [`80bbc91ebf7766d849332d2a73b02b0f7265568f`](https://github.com/Diego24Vas/db_CoffeeFaster/tree/80bbc91ebf7766d849332d2a73b02b0f7265568f)
  en `.test-bd`, fijado en el [workflow del SHA revisado](https://github.com/cdarwitg2024/taller-integracion-3/blob/432134aa8a9bba3b0a6c33c824a776d3e8889424/.github/workflows/ci-functional.yml).

El escenario aplica V05/V12/V13/V14 en el entorno desechable, sin copiarlas ni
aplicarlas a Cloud. El runner usa `postgres:15`, Auth `supabase/gotrue:v2.197.0`
y PostgREST `postgrest/postgrest:v16.3`. La etapa separada de suites SQL del job CI
usa `postgres:17`; no es el PostgreSQL del recorrido móvil.

## Preparación del escenario y límites

La primera corrida no pudo seleccionar Piloto A15: quedaban tres campañas activas
y el fixture limita PostgREST a dos filas para forzar la paginación de C05.
Se aisló la campaña A15 pausando únicamente las campañas temporales previas,
conservando ese límite. Es una corrección de datos del escenario; no se presenta
como una corrección de producto ni como validación de un catálogo grande.

No se encontraron defectos adicionales de aplicación en los recorridos ejecutados.
No se modificaron cuentas reales, Cloud, datos bancarios ni datos existentes.
El alcance es la validación funcional de componentes móviles y servicios reales,
no una captura visual de un APK instalado. La CI de `432134a` ya se verificó en el
run enlazado en el apéndice. Esa evidencia corresponde a ese SHA y no se atribuye
a otros commits ni ejecuciones posteriores.

## Archivos

- [Prueba integral de A15](../../../app-mobile/src/screens/afiliaciones/PilotoAfiliadoIntegracion.test.js).
- [Preparación y ejecución desechable](../../../.github/scripts/test-mobile-afiliacion-a06.cjs).
- [Job funcional](../../../.github/workflows/ci-functional.yml).
- Índice, contrato y estado funcional.

## Resultado de la corrida local — 24 de noviembre de 2026

Windows, Node.js 22.19.0. La corrida finalizó a las **23:56, America/Santiago**,
antes del commit: se ejecutó sobre el árbol de trabajo de A15 basado en
`fbfe3b7d879e961e3031b1083b23098769599111`, después publicado como
[`432134aa8a9bba3b0a6c33c824a776d3e8889424`](https://github.com/cdarwitg2024/taller-integracion-3/commit/432134aa8a9bba3b0a6c33c824a776d3e8889424).
Comando: `node .github/scripts/test-afiliados-auth-integration.cjs --a06`, con
`COFFEEFAST_DB_MIGRATIONS` apuntando a la copia local `8b80271` y las imágenes Auth
/ PostgREST indicadas arriba. Los valores siguientes **son locales, no de CI**.

- **A15 PASS** con el estudiante ficticio 902, solicitud 13. El código asignado
  `CF-986F9162D5F24DDC962D24465CCA4AA3` fue el mismo visible, copiado y enviado a compartir.
- Retiro: **$500**, referencia **`0f19d6fc-4729-4e47-86f0-1f279e4f16c5`**,
  **una sola fila**, disponible **$1.200 → $700**, retirado acumulado **$500**.
- Desactivación: pendiente **$300**, disponible **$700** y retirado **$500**
  conservados. La atribución nueva se rechazó por SQL y no dejó un pedido nuevo.
  Reabrir conservó referencia e importe sin otro POST de retiro.
- Runner completo: **tres pruebas móviles de integración aprobadas** (A06,
  A12/A13/A05 y A15), más siete escenarios C05/E08; C15 se conservó aprobado.
- Suite normal: **416 pruebas aprobadas**, 42 suites; cuatro integraciones opt-in
  omitidas. A15 sí se ejecutó en la corrida integrada descrita arriba.
- TypeScript, sintaxis del runner, 174 enlaces relativos y `git diff --check` aprobados.
- Los contenedores creados por el runner se eliminaron. Docker volvió al estado
  apagado inicial. No se modificaron código de aplicación, datos existentes ni Cloud.

## Apéndice: CI verificada de `432134a` — 25 de noviembre de 2026

- [Run 45537079299](https://github.com/cdarwitg2024/taller-integracion-3/actions/runs/45537079299),
  evento `pull_request`, SHA de origen
  `432134aa8a9bba3b0a6c33c824a776d3e8889424`.
- [Job mobile-afiliaciones 138946191133 y su log](https://github.com/cdarwitg2024/taller-integracion-3/actions/runs/45537079299/job/138946191133):
  **success**, de **00:01:51 a 00:04:09, America/Santiago (UTC−03)**,
  equivalentes a `2026-11-25T03:01:51Z`–`03:04:09Z`.
- El checkout de aplicación fue la combinación de prueba `f80fa62` de `432134a`
  con `develop` `0ed178418e89439729103bfea4600f830f61c0db`.
  El checkout de BD fue **`80bbc91ebf7766d849332d2a73b02b0f7265568f`**.
- Comando del escenario: `node .github/scripts/test-afiliados-auth-integration.cjs --a06`.
- Los **13 checks** de `432134a` terminaron aprobados. Esto verifica ese commit,
  no el estado de checks de una modificación documental posterior.

Los cuatro `PASS A15` del log de ese job registran:

| Etapa | Resultado de CI |
|---|---|
| Pendiente | Estudiante 902, solicitud **10**, `codigo_visible: false`, `panel_habilitado: false` |
| Aprobada | Código **`CF-8C7A7D0D2E00476CBA4DD4436CAF437D`**, el mismo para copiar/compartir y con el contexto correcto |
| Retiro | Monto **$500**, referencia **`b5cbf70d-3e38-4dd4-a86d-e894bf5dde4c`**, una fila, disponible **$1.200 → $700**, pendiente **$300**, retirado **$500** |
| Desactivada | `codigo_activo: false`, saldo **300/700/500** conservado, misma referencia, atribución nueva rechazada por SQL y reapertura sin otro retiro |

Para volver a consultar el registro original, con acceso al repositorio:

```powershell
gh run view 45537079299 --repo cdarwitg2024/taller-integracion-3 --job 138946191133 --log | Select-String 'PASS A15'
```

La solicitud, el código y la referencia se generan en cada entorno. Por eso la
corrida local (solicitud 13) y esta corrida de CI (solicitud 10) tienen valores
diferentes. Las aserciones cotejan cada código y comprobante con la respuesta y
la fila SQL de **su propia corrida**; no fijan estos valores como constantes para
futuras ejecuciones. El apéndice conserva evidencia inmutable del run citado.
