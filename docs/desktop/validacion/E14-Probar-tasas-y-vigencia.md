<!-- Registro de validación de los límites de tasas y vigencia del formulario de campañas del dueño (E14). -->
# E14 — Probar tasas y vigencia

## Alcance

E14 verifica los límites numéricos y de fechas del formulario de campañas de
carrito completo desde el escritorio. Sus dependencias E06 (`#84`) y E07
(`#89`) ya están en `develop`. La validación vive en
`app-desktop/src/services/campanasAfiliados.js` (`validarFormularioCampana`,
`parsearFecha` y `prepararCampana`) y la vista `Campanas.jsx` muestra cada error
en el campo correspondiente antes de llamar al gateway. No se reescribió la
validación: E14 aporta los casos límite que faltaban y este registro.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
~~~

Referencias: `app-desktop/tests/campanas.test.cjs`, pruebas «E14: tasas en los
límites y vigencia inválida identifican el campo en el formulario», «el servicio
sigue el contrato C02 con el cliente autenticado» y «el formulario marca el
campo obligatorio omitido y conserva los datos válidos». Los límites que aplica
el gateway están en `Microservices/ms-pedidos/src/modules/afiliados/afiliados.routes.js`
y se reflejan en `docs/contratos-integracion-afiliados.md`.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Tasas en `0` y `100`, con oferta `0` y comisión `100` | Sin errores; la prueba verifica la comisión, el descuento normal y el inicio guardados | Aprobado |
| Descuento normal o comisión en `-0.01` y `100.01` | Error en ese campo: «debe estar entre 0 y 100»; no se crea la campaña | Aprobado |
| Descuento en oferta en `-0.01` | Error «El descuento en oferta debe estar entre 0 y 100» | Aprobado |
| Descuento en oferta en `100.01` | Error «El descuento en oferta debe estar entre 0 y 100»; la comparación entre descuentos se comprueba aparte con tasas dentro del rango | Aprobado |
| Inicio `2026-12-01T25:00`, `2026-12-01T08:60` o `2026-09-31T08:00` | Error «Revisa la fecha de vigencia» en `inicio` | Aprobado |
| Comisión `101` e inicio `2026-12-01T25:00` en el formulario | `helperText` de Comisión y de Inicio identifica cada dato a corregir; cero llamadas a `crear` | Aprobado |
| Corregir comisión a `100` e inicio a `2026-12-01T08:00` y volver a enviar | Se crea la campaña con los valores válidos | Aprobado |
| Término igual o anterior al inicio, fechas imposibles y fechas con zona horaria | Error en `fin` cuando corresponde; sin error en fechas ISO válidas | Aprobado (pruebas previas de C02) |
| Tasas con tres decimales | Error «hasta dos decimales» en la tasa correspondiente | Aprobado (pruebas previas de C02 y E05) |

## Resultado

- Escritorio: 114/114 pruebas aprobadas, incluida la nueva de límites de E14.
- `npm run build --prefix app-desktop`: código de salida 0.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real ni una integración HTTP contra
`ms-pedidos`: las pruebas sustituyen el gateway y comprueban la validación y el
formulario con `react-test-renderer`. C02 no enumera el rango 0-100 ni los dos
decimales; esos límites están implementados en el gateway y duplicados en la
aplicación, por lo que un cambio en el contrato del servidor exigiría ajustar
ambos lugares. No se aplicó SQL ni se modificaron despliegues.
