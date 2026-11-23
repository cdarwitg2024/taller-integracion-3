<!-- Registro reproducible de los estados de carga, vacío y error de las campañas del dueño (E13 / CAM-296). -->

# E13 / CAM-296 — Cubrir estados de carga y error

## Alcance

E13 pedía estados de carga, vacío y error con recuperación en la pantalla de campañas del dueño. Sus dependencias E04 (`3728521`) y E06 (`a8b0731`) ya estaban en `develop`, y E03/E04 habían dejado implementados esos estados en `app-desktop/src/pages/dueno/Campanas.jsx`: indicador durante la carga, tarjeta de vacío, alerta con `Reintentar` al fallar y limpieza de filas al cambiar de cafetería. No se reescribió la vista: E13 aporta las pruebas de regresión que faltaban y este registro.

## Pasos verificados

1. Con una respuesta pendiente, el primer render muestra `CircularProgress` y no muestra el vacío ni el error; al resolver la consulta aparece la campaña y desaparece el indicador.
2. Con un listado vacío, aparece `Aún no hay campañas` y el botón `Crear la primera campaña`.
3. Tras cargar `Semana del café`, se invoca el callback interno de recarga del listado y esa segunda consulta falla con `sin_acceso_cafeteria`: la alerta y el botón `Reintentar` aparecen, la tarjeta anterior desaparece y la ruta no cambia. La recuperación visible para el usuario se comprueba en el paso siguiente con el botón `Reintentar` de la alerta.
4. Al pulsar `Reintentar`, aparece `Campaña recuperada`, desaparece la alerta y la ruta sigue siendo `/dueno/afiliados/campanas`.

Los pasos 1, 3 y 4 corresponden a `app-desktop/tests/campanas.test.cjs`; el paso 2 lo cubre la prueba `sin campañas aparece el estado vacío`, que comprueba el texto y el botón `Crear la primera campaña`.

## Resultado

- Escritorio: 143/143 pruebas aprobadas tras integrar `develop` con E08, V11 y E13, incluidas 51 de campañas (7 nuevas de E07, 1 de E14, 5 de E08 y 2 de E13).
- `npm run build --prefix app-desktop`: código de salida 0.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron ni un navegador real, por lo que no se adjunta una captura visual: el registro de prueba deja constancia del estado resultante y del paso que lo produce, como pide el criterio 3. Las pruebas sustituyen el servicio de campañas; no acreditan una respuesta real del gateway ni de PostgreSQL. Mientras hay tarjetas visibles no existe un botón de recarga en la cabecera: la prueba de recarga usa el callback interno; la acción de recuperación expuesta al usuario es `Reintentar` en la alerta de error. No se modificó SQL, Cloud ni despliegues.
