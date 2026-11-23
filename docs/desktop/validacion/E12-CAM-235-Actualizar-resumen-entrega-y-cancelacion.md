<!-- Registro de validación de la actualización del resumen del dueño tras entregar o cancelar (E12). -->
# E12 — Actualizar resumen tras entregar o cancelar

## Alcance

E12 / CAM-235 verifica que el resumen del dueño cambie cuando un pedido pasa a
`entregado` o `cancelado`, y que el cambio de cafetería muestre solo el resumen
de la cafetería activa. Sus dependencias E11 (`292a837`, mergeado), V09
(CAM-177, `Done`) y V11 (CAM-179, `Done`) están disponibles.

No se modificó código de producción. `Dashboard.jsx:49-67` ya suscribe
`postgres_changes` de `pedidos` y `detalles_pedido` con `{ event: '*' }` y llama
a `refrescar(false)` ante cualquier cambio; el respaldo de 10 s hace lo mismo.
`cargadorDashboard.js:63-81` vuelve a consultar el resumen conservando ventas y
último dato bueno, y `cambiarCafeteria` (`:109-129`) reinicia el estado antes de
cargar.
`movimientos_comision` no está publicado en Realtime, así que la fila nueva se
observa en la siguiente lectura, no en el evento de Realtime del pedido.

**Procedencia del SQL:** las RPC de V09 (`cancelar_pedido`) y V11
(`confirmar_entrega_pedido`) viven en `Diego24Vas/db_CoffeeFaster`. Este cambio
no copia, reaplica ni modifica ese SQL; solo consume sus efectos en
`movimientos_comision` a través de `resumenComisiones.js`.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
node .github/scripts/verify-unit-sensitivity.cjs desktop
git show --check HEAD
~~~

El comando acotado que produce el cotejo es:

~~~sh
node --test --test-name-pattern="entrega y cancelación actualizan" app-desktop/tests/resumen-comisiones.test.cjs
~~~

Referencia: `app-desktop/tests/resumen-comisiones.test.cjs`. El transporte de
Supabase se sustituye por una implementación en memoria que devuelve tres
instantáneas construidas con el `construirResumen` real. No se consultó
Supabase Cloud ni se aplicó SQL.

## Datos de prueba y cotejo

Dos pedidos de la cafetería 1: el 20, de $10.000 con comisión de $1.000, y el
21, de $5.000 con comisión de $500. V11 solo mueve comisiones `pendiente` a
`disponible` y V09 rechaza cancelar una comisión que no esté `pendiente`, así
que la entrega y la cancelación recaen en pedidos distintos.

| Paso | Evento en `pedidos` | Estado de `movimientos_comision` | Resultado observado |
|---|---|---|---|
| Inicial | Pedido 20 `listo` y pedido 21 `pagado` | Comisiones `pendiente` de $1.000 y $500 | Pendiente $1.500, disponible $0, revertida $0, reversiones $0 |
| Entrega del pedido 20 (V11) | `entregado` + `refrescar(false)` | Su comisión pasa a `disponible`; la del 21 sigue `pendiente` | Pendiente $500, disponible $1.000, revertida $0, reversiones $0 |
| Cancelación del pedido 21 (V09) | `cancelado` + `refrescar(false)` | Su comisión pasa a `revertida` y se inserta una `reversion` de $-500 | Pendiente $0, disponible $1.000, revertida $500, reversiones $-500 |

En los tres pasos el histórico bruto sigue siendo 2 ventas referidas y $15.000
cobrados; la cancelación no borra ese histórico ni modifica `creado_en` de las
comisiones existentes. La conciliación con el criterio de ventas del panel
(`esPedidoDeVentas`) corresponde a E09 / CAM-295. La verificación real contra
Supabase depende de E15 / CAM-240, que sigue `Todo` y depende de E12 y de V02
(CAM-237); aquí no se acredita.

Evidencia del comando acotado de E12:

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Tras la entrega | La disponible crece a $1.000 y la pendiente baja a $500 | Aprobado |
| Tras la cancelación | Aparecen revertida $500 y reversiones $-500; la disponible se mantiene | Aprobado |

Regresiones de E11 verificadas en la suite completa:

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Cambio de cafetería con resumen visible | `resumenComisiones` y `comisionesError` se reinician antes de cargar la cafetería nueva | Aprobado |
| Resumen tardío de la cafetería anterior | Se descarta y no sobrescribe el resumen vigente | Aprobado |
| Render del componente real con la fixture de E11 | Se muestran las seis cifras y el historial | Aprobado |

## Resultado

- Rama `S3-T12-Elias-Actualizar-resumen-tras-entregar-o-cancelar`, sobre
  `develop` en `48e3af9`.
- Escritorio: 163/163 pruebas aprobadas (161 de E11, 1 incorporada en `develop`
  por C12 y 1 nueva de E12).
- `node --test --test-name-pattern="entrega y cancelación actualizan" ...`:
  1 prueba, aprobada.
- `npm run build --prefix app-desktop`: código de salida 0.
- `node .github/scripts/verify-unit-sensitivity.cjs desktop`: 5/5 mutaciones
  detectadas.
- `git show --check HEAD`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real, Supabase Realtime ni PostgREST
contra Cloud. El disparo de Realtime se verificó por lectura de `Dashboard.jsx`;
la prueba unitaria ejerce el mismo `refrescar(false)` que invoca ese callback.
Como `movimientos_comision` no está en Realtime, si la fila se publica después
del evento de `pedidos`, el resumen se actualiza en el siguiente respaldo de
10 s; si una carga lenta hace que ese respaldo se omita, se aplica en el
siguiente. No se modificaron despliegues ni datos de Cloud.
