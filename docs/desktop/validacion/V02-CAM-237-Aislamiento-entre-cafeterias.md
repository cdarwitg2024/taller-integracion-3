# V02 · Probar aislamiento entre cafeterías

[CAM-237](https://linear.app/camilodarwitg/issue/CAM-237/v02-probar-aislamiento-entre-cafeterias)

Validación local del 23 de noviembre de 2026 con Node.js 22.23.1 y PostgreSQL
15.20 desechable. Bases de trabajo de los cambios sin commit:
`taller-integracion-3@bab9267` y `db_CoffeeFaster@8b80271`.

## Datos y resultados

El fixture `db_CoffeeFaster/tests/fixtures/afiliaciones.sql` crea al dueño 1
para la cafetería 1 y al dueño 3 para la cafetería 2. Las dos cafeterías tienen
campañas activas y movimientos de comisión pendientes con montos distintos.

| Paso | Resultado esperado | Resultado observado en PostgreSQL |
|---|---|---|
| 1. Consultar con el dueño 1 | Solo campaña 1 y movimiento 301 por 1.000 CLP | Campaña 1 y movimiento 301 por 1.000 CLP |
| 2. Consultar campaña 2 y movimiento 302 con el dueño 1 | Cero filas en ambas lecturas | Cero filas |
| 3. Repetir la lectura propia con el dueño 1 | Mismas filas y monto que en el paso 1 | Campaña 1 y movimiento 301 por 1.000 CLP |
| 4. Consultar con el dueño 3 | Solo campaña 2 y movimiento 302 por 500 CLP | Campaña 2 y movimiento 302 por 500 CLP |
| 5. Consultar campaña 1 y movimiento 301 con el dueño 3 | Cero filas en ambas lecturas | Cero filas |
| 6. Repetir la lectura propia con el dueño 3 | Mismas filas y monto que en el paso 4 | Campaña 2 y movimiento 302 por 500 CLP |

Cada secuencia usa el rol `authenticated` con la identidad ficticia de su dueño
en la misma sesión. Las lecturas inicial y final se hacen sin filtrar por
cafetería para comprobar que el propio RLS limita las filas visibles.

En escritorio, `campanas.test.cjs` verificó que el servicio de campañas
rechaza el contexto ajeno antes de consultar y permite volver al contexto propio.
`resumen-comisiones.test.cjs` verificó que una respuesta sin filas ajenas
produce un resumen vacío y conserva el resumen propio en la consulta siguiente.
Ambos casos se repitieron para las dos cuentas.

## Reproducción

En `db_CoffeeFaster`, con un contenedor PostgreSQL desechable iniciado:

```sh
TEST_POSTGRES_CONTAINER=cf-test-postgres npm run test:afiliaciones
```

El runner crea y elimina su base temporal. Las dos líneas con prefijo
`APROBADO: V02` registran los IDs y montos comprobados. La ejecución de
`npm test` completó las 12 suites de base de datos, incluidas las 61
comprobaciones de afiliaciones y las 36 migraciones.

En `taller-integracion-3`, con las dependencias de escritorio instaladas:

```sh
node app-desktop/tests/campanas.test.cjs
node app-desktop/tests/resumen-comisiones.test.cjs
```

Los dos archivos reportan un caso V02 cada uno. La suite de escritorio
obtuvo 164 pruebas aprobadas.

Las pruebas SQL ejecutan las políticas RLS en PostgreSQL con el identificador
de sesión simulado. Las pruebas de escritorio usan dobles de transporte.
Queda pendiente la comprobación en la aplicación ejecutándose con dos
sesiones reales de Supabase Auth en el entorno de prueba.
