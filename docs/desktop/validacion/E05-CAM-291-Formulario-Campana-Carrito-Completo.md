<!-- Registro de validación del formulario de campaña de carrito completo (E05 / CAM-291). -->
# E05 / CAM-291 — Formulario de campaña de carrito completo

Rama: `S3-T5-Elias-Crear-formulario-de-carrito-completo`.
Base: `origin/develop`, commit `efce508`.
Validación local: 17 de noviembre de 2026, Node.js 22.16.0 y 24.18.0.

## Alcance

E05 pide capturar nombre, vigencia, descuento y comisión, con errores por campo
y mensajes que identifiquen los obligatorios. No conecta la creación ni la
edición con el gateway: eso corresponde a E06. No se modifica el contrato C02.

Archivos modificados:

- `app-desktop/src/pages/dueno/Campanas.jsx`
- `app-desktop/src/services/campanasAfiliados.js`
- `app-desktop/tests/campanas.test.cjs`
- `docs/README.md` (índice de documentación)

Archivo nuevo: este registro de validación.

## Problema y corrección

El formulario ya tenía los campos, pero delegaba toda la validación a
`prepararCampana`, que lanza el primer error y solo mostraba un aviso global. No
había errores por campo ni forma de distinguir cuáles obligatorios faltaban.

Se extrajo `validarFormularioCampana` en el servicio, que devuelve un mapa
`{campo: mensaje}` sin alterar los valores válidos. `prepararCampana` sigue siendo
el límite de confianza del gateway: consume el mismo validador y lanza el primer
error, por lo que no hay duplicación de reglas. El formulario muestra
`error`/`helperText` por campo, limpia solo el error del campo editado y bloquea
el envío mientras queden errores. Las tres tasas y el nombre aparecen como
obligatorios; inicio y término siguen opcionales, pero se validan si se llenan.
Cada fecha inválida se marca en su propio campo. El validador acepta fechas ISO
con zona horaria, rechaza fechas de calendario imposibles como `2026-02-30` y
trata los porcentajes vacíos, con solo espacios o booleanos como omitidos. Al
editar una campaña con tasas nulas, el formulario las muestra vacías en vez de
`null`. El form lleva `noValidate` para que el navegador no bloquee el `submit`
con su globo nativo antes de que corra la validación de la vista: el asterisco de
`required` sigue visible.

## Registro de prueba reproducible

Desde la raíz del repositorio, con Node.js 22 o 24:

```sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
```

`app-desktop/tests/campanas.test.cjs` incorpora tres pruebas. La primera ejerce
el validador con un nombre válido, una tasa omitida, otra fuera de rango, un
término anterior al inicio y una fecha de inicio mal escrita con el término
correcto. La segunda monta el formulario real, comprueba `noValidate`, completa
solo algunos campos, envía, verifica los errores y los valores conservados, y
luego completa el resto para comprobar el envío. La tercera abre una campaña
existente con tasas nulas y comprueba que se editan como texto vacío sin mostrar
errores. La prueba del contrato C02 amplía las aserciones con espacios, booleanos,
fechas imposibles, fechas con zona horaria y orden invertido.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Nombre válido, descuento normal omitido, oferta `150`, término anterior al inicio | Errores en `descuento_normal_pct`, `descuento_oferta_pct` y `fin`; el nombre válido se conserva | Aprobado |
| Inicio mal escrito y término válido | Error solo en `inicio`; `fin` queda sin error | Aprobado |
| Formulario con nombre, descuento normal y comisión; falta descuento en oferta | `Descuento en oferta` marcado con «obligatorio»; nombre y comisión sin error y con sus valores | Aprobado |
| Envío con ese campo incompleto | Aviso «Revisa los campos marcados» y ninguna llamada de creación | Aprobado |
| Completar oferta, inicio y término y volver a enviar | Errores limpios y formulario entregado al servicio con los cinco valores | Aprobado |
| Campo editado tras un error | El error de ese campo se limpia y su valor se conserva | Aprobado |
| Formulario montado con campos obligatorios vacíos | El form expone `noValidate`, así que el `submit` llega a la validación de la vista y no al globo nativo | Aprobado (prop del form asertada) |
| Comisión con espacios o booleano `true` | Error «La comisión es obligatorio.» en ambos casos | Aprobado |
| Inicio `2026-02-30T10:00` | Error de fecha en `inicio` y `prepararCampana` lo rechaza | Aprobado |
| Inicio y término ISO con zona horaria | Sin errores; `prepararCampana` conserva el inicio en UTC | Aprobado |
| Editar campaña con descuento en oferta nulo | El campo se muestra vacío, sin error, y acepta un valor nuevo | Aprobado |

Resultado final: `campanas.test.cjs` 31/31 y suite `app-desktop` 75/75 aprobadas
en Node 22.16.0 y en Node 24.18.0. `npm run build --prefix app-desktop` finaliza
con salida cero en ambos y la advertencia habitual por chunks superiores a 500
kB. `git diff --check` no informa problemas.

## Límites de la evidencia

Las pruebas usan sesiones ficticias, sustituyen el gateway y no ejecutan Electron
ni Supabase: no acreditan JWT, RLS, persistencia real ni la aceptación móvil. El
envío verificado llega al servicio simulado del panel, no a `ms-pedidos`. Tampoco
se ejecuta un navegador real: la prueba afirma la prop `noValidate` del form, pero
no reproduce el globo nativo de Chromium. Quedan para E06 la conexión real de
alta/edición y para E07 la activación y pausa.
