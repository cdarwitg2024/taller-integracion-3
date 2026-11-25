<!-- Registro de validación de la conciliación del panel del dueño con el resumen de comisiones (E15). -->
# E15 — Conciliar el panel con Supabase

## Alcance

E15 / CAM-240 coteja el panel del dueño contra el resumen de comisiones con un
pedido entregado y otro cancelado de la misma cafetería. Sus dependencias E12
(CAM-235) y V02 (CAM-237) figuran `Done` en Linear.

No se modificó código de producción. El cotejo usa los servicios reales
`obtenerResumenComisiones` (`resumenComisiones.js:66-100`) y
`pedidosService.getEstadisticas` (`pedidosService.js:401-430`). El primero
ejerce la consulta completa con `count: 'exact'`, `eq('pedidos.cafeteria_id')`,
`order` y `range`, además del agrupamiento de `construirResumen`; el segundo
aplica el criterio `esPedidoDeVentas`, que excluye cancelados de `totalVentas`
pero no de `totalPedidos`.

**Procedencia del SQL:** las RPC de V09 (`cancelar_pedido`), V11
(`confirmar_entrega_pedido`) y la tabla `movimientos_comision` de 0020 viven en
`Diego24Vas/db_CoffeeFaster`. Este cambio no copia, reaplica ni modifica ese
SQL; documenta los efectos que esas migraciones producen en las filas que lee
el panel.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
node .github/scripts/verify-unit-sensitivity.cjs desktop
git diff --check
~~~

El comando acotado que produce el cotejo es:

~~~sh
node --test --test-name-pattern='E15: el cotejo' app-desktop/tests/resumen-comisiones.test.cjs
~~~

Referencia: `app-desktop/tests/resumen-comisiones.test.cjs`. El transporte de
Supabase se sustituye por una implementación en memoria que devuelve filas con
la forma exacta de la respuesta de PostgREST. En E15 el embed era
`pedidos!inner(cafeteria_id, total)`; E09 lo amplió con `estado, pago_estado`,
así que el aserto actual de la consulta incluye esas columnas. No se consultó
Supabase Cloud ni se aplicó SQL.

## Datos de prueba y cotejo

Cafetería 1: pedido 20 de $10.000, entregado, con comisión de $1.000 en
`disponible`. Pedido 21 de $5.000, cancelado, con su comisión de $500 en
`revertida` y la `reversion` de $-500 que apunta al movimiento original. Se
añade una fila de la cafetería 2 con $9.999 para comprobar que el alcance no se
cruza. Los importes y los estados finales son los que producen V11 y V09; el
punto de partida usa la comisión del pedido 21 todavía `pendiente`.

| Métrica | Antes de cancelar | Después de cancelar | Observado en E15 |
|---|---|---|---|
| Panel: ventas (`getEstadisticas`) | $15.000 | $10.000 | $15.000 → $10.000 |
| Panel: total pedidos | 2 | 2 | 2 → 2 |
| Resumen: comisión pendiente | $500 | $0 | $500 → $0 |
| Resumen: comisión disponible | $1.000 | $1.000 | $1.000 → $1.000 |
| Resumen: comisión revertida | $0 | $500 | $0 → $500 |
| Resumen: reversiones | $0 | $-500 | $0 → $-500 |
| Resumen: ventas referidas / cobrado bruto | 2 / $15.000 | 2 / $15.000 | sin cambio en E15 |

En E15, la comisión disponible seguía siendo exactamente la del pedido
entregado: no aparecía ningún movimiento del pedido 21 en `disponible`, y su
comisión quedaba en `revertida` con su compensación negativa. El histórico
bruto no borraba el pedido cancelado, mientras que las ventas del panel sí lo
descartaban y `totalPedidos` lo seguía contando. Esa diferencia quedó registrada
para E09 / CAM-295. E09 la corrigió con el mismo `esPedidoDeVentas` del panel:
el pedido cancelado ya no cuenta como venta referida ni aporta cobro, y el
bruto tras cancelar pasó a 1 / $10.000. Por eso el aserto actual de la prueba
E15 ya no reproduce la última fila de la tabla; ver
[registro E09](E09-CAM-295-Corregir-diferencias-en-ventas-y-comisiones.md).

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Consulta del resumen | `select` con `count: 'exact'` y `eq` por `pedidos.cafeteria_id` | Aprobado |
| Fila ajena a la cafetería | No aparece en movimientos ni en importes | Aprobado |
| Cancelación | Disponible no crece; revertida $500 y reversiones $-500 | Aprobado |
| Panel | Ventas bajan $5.000; total pedidos queda en 2 | Aprobado |

## Sensibilidad de la prueba

En un checkout desechable se mutaron los servicios reales para confirmar que
el cotejo falla si se rompe la regla:

| Mutación temporal | Resultado |
|---|---|
| Contar la comisión `revertida` como `disponible` | La prueba falla |
| Contar el pedido `cancelado` como venta | La prueba falla |

Las mutaciones no se conservan en este repositorio.

## Resultado

- Rama `S3-T15-Elias-Conciliar-panel-con-Supabase`, sobre `develop` en `4ca32ae`.
- Escritorio: 164/164 pruebas aprobadas en E15 (163 de `develop` y 1 nueva de
  E15); 167/167 tras las pruebas adicionales de E09 y V02.
- `node --test --test-name-pattern="E15: el cotejo" ...`: 1 prueba, aprobada.
- `npm run build --prefix app-desktop`: código de salida 0.
- `node .github/scripts/verify-unit-sensitivity.cjs desktop`: 5/5 mutaciones
  detectadas.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real, Supabase Cloud, Realtime ni
PostgREST. La consulta se ejerce sobre un transporte en memoria con la forma de
respuesta de PostgREST; eso comprueba el contrato de la consulta y el cálculo,
pero no el RLS ni los disparadores de las migraciones externas. V02 está
`Done` en Linear, pero su verificación con dos sesiones reales de Supabase Auth
sigue declarada como pendiente en su propio registro. E15 no acredita esa
integración de punta a punta y no modifica datos de Cloud.
