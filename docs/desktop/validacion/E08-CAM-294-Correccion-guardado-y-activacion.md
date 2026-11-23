<!-- Registro de validación y corrección del guardado, la reapertura y la activación de campañas del dueño (E08). -->
# E08 — Corregir fallos de guardado y activación de campañas

Rama: `S3-T8-Elias-Corregir-fallos-de-guardado-y-activacion-de-campanas`.
Base: `origin/develop`, commit `43fa980` (incluye E10 y E14).
Validación local: 21 de noviembre de 2026, Node.js 22.16.0 y Docker 29.9.1.

## Alcance

E07 dejó conectadas la pausa y la activación, pero el formulario seguía
guardando el estado de la campaña abierta antes del cambio de ruta. Al pasar de
`/dueno/afiliados/campanas/31/editar` a `/32/editar` dentro de la misma
cafetería, React reutilizaba la instancia porque la clave de ruta solo incluía
la cafetería. `useParams()` cambiaba, pero `form` conservaba los valores de la
campaña 31; guardar desde esa vista enviaba esas tasas y esa vigencia a la
campaña 32.

La corrección remonta el formulario con una clave que incluye la cafetería y el
id de la campaña. Además, el guardado solo vuelve al listado si su ruta y su
instancia del formulario siguen vigentes antes y después de recargar, para que un
PATCH o una recarga atrasados no descarten los cambios de otra campaña abierta,
incluso si se vuelve a la campaña original mientras la recarga está pendiente.
No cambia el contrato C02, la validación ni la RPC.

Archivos modificados:

- `app-desktop/src/pages/dueno/Campanas.jsx`
- `app-desktop/tests/campanas.test.cjs`
- `.github/scripts/test-afiliados-auth-integration.cjs`
- `docs/README.md` (índice de documentación)
- `docs/estado-actual.md` (estado funcional)

Archivo nuevo: este registro.

## Fallo reproducido

La prueba «reabrir otra campaña de la misma cafetería precarga sus datos y
guarda solo esa campaña» se ejecutó antes de la corrección y falló con:

~~~text
expected: 'Campaña B'
actual: 'Campaña A'
~~~

La ruta ya era `/dueno/afiliados/campanas/32/editar`, pero el campo de nombre
seguía mostrando la campaña 31. Sin la corrección, el envío habría llamado a
`actualizar(7, 32, form de 31)`.

## Verificación

| Escenario | Resultado esperado | Resultado observado |
|---|---|---|
| Abrir la campaña 31 y navegar a la 32 en la misma cafetería | El formulario muestra nombre, tasas y vigencia de la 32 | Aprobado |
| Guardar desde la campaña 32 | Se llama a `actualizar(7, 32, ...)` con los valores de la 32 | Aprobado |
| Guardar la campaña 31, volver al listado y reabrirla | Tasas y vigencia persisten; el chip sigue mostrando `activa` | Aprobado |
| Consultar oportunidades móviles con la campaña aceptada | La RPC devuelve la campaña | Aprobado con Auth, JWT, PostgREST y RLS reales |
| Pausar la campaña desde el escritorio | La RPC ya no devuelve la campaña | Aprobado con Auth, JWT, PostgREST y RLS reales |
| Activarla de nuevo | La RPC vuelve a devolver la campaña | Aprobado con Auth, JWT, PostgREST y RLS reales |
| Guardar A, navegar a editar B y terminar el PATCH de A | Se conserva la edición de B y sus cambios sin guardar | Aprobado |
| Guardar A, navegar a editar B durante la recarga | Se conserva la edición de B y sus cambios sin guardar | Aprobado |
| Guardar A, ir a B y volver a A durante la recarga | Se conserva la edición de la nueva instancia de A y sus cambios sin guardar | Aprobado |

Las tres filas de oportunidades móviles se obtuvieron con
`.github/scripts/test-afiliados-auth-integration.cjs --c05`, que levanta
PostgreSQL, Auth, PostgREST, `ms-pedidos` y nginx en contenedores desechables.
El escenario E08 usa la cafetería 8 para no topar con el límite de dos filas que
C05 configura en PostgREST, y consulta
`/rest/v1/rpc/listar_oportunidades_campana` con el JWT de un estudiante. Las
migraciones oficiales `0020`, `0021`, `0023` y `0024` se leyeron del SHA fijado
`07b5a6aaad2a1ea8eb73ae5dbce5af9db02d16f2` de `Diego24Vas/db_CoffeeFaster`.

## Comprobaciones ejecutadas

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
npm test --prefix Microservices/ms-pedidos -- --ci
node --check .github/scripts/test-afiliados-auth-integration.cjs
COFFEEFAST_DB_MIGRATIONS=<directorio-con-migraciones-0020-0021-0023-0024> \
  node .github/scripts/test-afiliados-auth-integration.cjs --c05
git diff --check
~~~

- Escritorio: 141/141 pruebas aprobadas (136 antes de E08).
- Compilación de producción de escritorio: código de salida 0.
- `ms-pedidos`: 191/191 pruebas aprobadas.
- Integración desechable C05/E08: 7/7 escenarios aprobados, incluido el de
  oportunidades móviles.
- `node --check` y `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron ni un navegador real: la interfaz se cubre con
`react-test-renderer`. No se aplicó SQL en Cloud, no se publicó ninguna campaña
real y no se ejecutó el APK. La comprobación móvil usa la RPC real con la
migración 0024 en PostgreSQL desechable; no sustituye una prueba visual en el
dispositivo. El registro no cubre el doble clic concurrente en Pausar/Activar:
la RPC es idempotente, pero ese caso queda fuera de los criterios de E08.
