# C13 / CAM-180 — Aislamiento de credenciales, saldos y retiros

[Tarea en Linear](https://linear.app/camilodarwitg/issue/CAM-180/c13-probar-acceso-a-credenciales-saldos-y-retiros)

## Reproducción

1. Usar Node.js 22, Docker Desktop y las dependencias instaladas de `ms-afiliados`
   y `ms-pedidos`. El runner usa las migraciones del checkout vecino de
   `db_CoffeeFaster` o el directorio indicado en `COFFEEFAST_DB_MIGRATIONS`.
2. Ejecutar desde la raíz. El escenario crea dos estudiantes ficticios, uno en
   cada cafetería, siguiendo el patrón de [E02](../../base-datos/E02-cuentas-cafeterias-prueba.md).
   El dueño aprueba la afiliación del titular. El runner prepara un pedido listo
   con credenciales y una comisión disponible de $1.000 CLP para ese estudiante.

   ```powershell
   $env:TEST_AUTH_IMAGE = 'supabase/gotrue:v2.197.0'
   $env:TEST_REST_IMAGE = 'postgrest/postgrest:v16.3'
   node .github/scripts/test-afiliados-auth-integration.cjs --c13
   ```

3. El runner ejecuta las lecturas con ambas sesiones, confirma un retiro de
   $400 CLP con la cuenta titular y comprueba los rechazos con la otra sesión.
   Al final coteja el historial, la fila persistida y el saldo de ambas cuentas.

El job `mobile-afiliaciones` de [CI Functional](../../../.github/workflows/ci-functional.yml)
incluye C13 como paso independiente. El escenario usa Auth, PostgREST,
PostgreSQL y Nginx desechables y los servicios reales. El registro solo muestra
etiquetas y estados. [Prueba C13](../../../.github/scripts/test-aislamiento-credenciales-c13.cjs)

## Matriz de aceptación

Corrida del 27 de noviembre de 2026 en Windows, con Node.js 22.23.5,
Docker Desktop, PostgreSQL 15 y el checkout de migraciones `c595ecc`.
Los cuatro escenarios volvieron a pasar con las migraciones del commit
`80bbc91ebf7766d849332d2a73b02b0f7265568f`, fijado por CI Functional.
Esta segunda ejecución también fue local.

| Paso | Resultado esperado | Resultado observado |
|---|---|---|
| Leer el QR y el token de contingencia del pedido con ambas sesiones | El titular recibe los valores persistidos. El estudiante ajeno no recibe credenciales. | Titular HTTP 200 en ambas rutas. Ajeno HTTP 404 para QR y 403 para contingencia. Los cuerpos de rechazo omitieron ambos valores. |
| Consultar el perfil de afiliación con ambas sesiones | Solo el perfil titular contiene el código aprobado. | HTTP 200 en ambas consultas. Código presente en el perfil titular y lista vacía en el ajeno. |
| Consultar saldos y solicitar el saldo de otro estudiante por identificador | Cada sesión recibe su propio saldo. El selector de titular se rechaza. | HTTP 200 con $1.000 CLP para el titular y $0 para el otro estudiante. Selector de titular HTTP 400 sin saldo. |
| Confirmar el retiro propio y repetir la solicitud con la sesión ajena | Solo el titular obtiene el comprobante. La sesión ajena no afecta su saldo. | Titular HTTP 200 con comprobante por $400 CLP. Ajeno HTTP 422 `saldo_insuficiente`, y HTTP 400 al indicar otro titular. Ambos rechazos omitieron el comprobante. |
| Consultar el historial por referencia y conciliar | Una fila propia y cero filas para la otra sesión. Saldo y base de datos reflejan un solo retiro. | RLS devolvió una fila al titular y cero al ajeno. Una sola fila persistida, $600 CLP disponibles y $400 retirados para el titular. La otra cuenta quedó en $0. |

[Contrato de afiliados](../../contratos-integracion-afiliados.md#saldo-y-retiro-por-el-gateway-c15) · [Contrato de lectura QR](../seguridad/consulta_qr_ms_pedidos_s2_t14.md)
