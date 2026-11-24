<!-- Registro de la corrección del bruto de ventas y comisiones del panel del dueño (E09). -->
# E09 — Corregir diferencias en ventas y comisiones del dueño

## Alcance

E09 / CAM-295 cierra la diferencia que E15 dejó documentada: el resumen del dueño
contaba el pedido cancelado como venta referida y aportaba su total al cobro,
mientras el panel ya lo descartaba con `esPedidoDeVentas`. Las dependencias E12
(CAM-235) y E15 (CAM-240) figuran `Done` en Linear.

Se modificaron dos servicios: `pedidosService.js` exporta el criterio de venta
que ya usaban sus indicadores, y `resumenComisiones.js` lo aplica al bruto y
amplía el embed de pedidos con `estado` y `pago_estado`. Los totales de comisión
y las reversiones no cambian, y `totalPedidos` sigue contando los pedidos
registrados en la cafetería, tal como indica la tarjeta «Pedidos registrados en
la cafetería».

**Procedencia del SQL:** la tabla `movimientos_comision` y las RPC de V08
(`procesar_pago`), V09 (`cancelar_pedido`) y V11
(`confirmar_entrega_pedido`) viven en `Diego24Vas/db_CoffeeFaster`. Este cambio
no agrega, copia ni reaplica ese SQL; solo lee columnas ya existentes de
`pedidos` y `movimientos_comision`.

## Fallo reproducido

El registro de E15 (`E15-CAM-240-Conciliar-panel-con-Supabase.md`, tabla de
cotejo) dejó constancia del fallo con el pedido 21 cancelado: el panel bajaba de
$15.000 a $10.000 en ventas, pero el resumen seguía en 2 ventas referidas y
$15.000 cobrados. Esa es la divergencia que corrige E09.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
node .github/scripts/verify-unit-sensitivity.cjs desktop
node --test --test-name-pattern='E09:' app-desktop/tests/resumen-comisiones.test.cjs
git diff --check
~~~

Referencia: `app-desktop/tests/resumen-comisiones.test.cjs`. El transporte de
Supabase se sustituye por una implementación en memoria con la forma de
respuesta de PostgREST. No se consultó Supabase Cloud ni se aplicó SQL.

## Datos de prueba y cotejo

Cafetería 1: pedido 20 de $10.000, entregado, con comisión de $1.000 en
`disponible`; pedido 21 de $5.000, cancelado, con su comisión de $500 en
`revertida` y la `reversion` de $-500 que apunta al movimiento original.
Cafetería 2: pedido 99 de $9.000, entregado, con comisión de $900 en
`disponible`. El transporte devuelve las filas de ambas cafeterías en cada
consulta para comprobar que el filtro por cafetería sigue vigente.

| Paso de prueba | Esperado | Observado |
|---|---|---|
| Filtrar el resumen por cafetería 1 | `eq('pedidos.cafeteria_id', '1')`; solo movimientos 20, 21 y 22 | Aprobado |
| Consulta del embed | Incluye `estado` y `pago_estado` del pedido | Aprobado |
| Ventas referidas / total cobrado en cafetería 1 | 1 / $10.000 (se descarta el pedido 21) | Aprobado |
| Comisiones en cafetería 1 | Disponible $1.000, revertida $500, reversiones $-500 | Aprobado |
| Cambio a cafetería 2 | `eq` por `'2'`; solo movimiento 30, 1 venta y $9.000 | Aprobado |
| Cotejo con el panel | `totalVentas` $10.000 = `totalCobrado`; `totalPedidos` 2 | Aprobado |

La cancelación no aumenta la comisión disponible: sigue siendo $1.000, igual
que antes de cancelar. La reversión compensa la comisión ($-500), no el cobro,
así que no se resta del histórico de $10.000. `totalPedidos` permanece en 2
porque la tarjeta cuenta pedidos registrados, no ventas válidas.

Si una fila de la cafetería activa llega sin `estado` en el pedido embebido,
`construirResumen` lanza un error en vez de descartar la venta en silencio; la
prueba E09 lo comprueba. Un `pago_estado` nulo sigue el criterio compartido del
panel: los estados `pendiente`/`pagado` solo cuentan como venta cuando el pago
está `pagado`.

## Sensibilidad de la prueba

En un checkout desechable se mutaron los servicios reales:

| Mutación temporal | Resultado |
|---|---|
| Quitar el filtro `esPedidoDeVentas` de `construirResumen` | La prueba E09 falla |
| Quitar `estado, pago_estado` del `select` | La prueba E09 falla |
| Contar el pedido `cancelado` como venta en `esPedidoDeVentas` | La prueba E09 falla |

Las mutaciones no se conservan en este repositorio.

## Resultado

- Rama `S3-T9-Elias-Corregir-diferencias-en-ventas-y-comisiones`, sobre
  `develop` en `8031fa8`.
- Escritorio: 165/165 pruebas aprobadas (164 de `develop` y 1 nueva de E09).
- Comando acotado de E09: 1 prueba, aprobada.
- `npm run build --prefix app-desktop`: código de salida 0.
- `node .github/scripts/verify-unit-sensitivity.cjs desktop`: 5/5 mutaciones
  genéricas de escritorio detectadas; las tres mutaciones propias de E09 están
  en la sección de sensibilidad de arriba.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real, Supabase Cloud, Realtime ni
PostgREST. La consulta se ejerce sobre un transporte en memoria con la forma de
respuesta de PostgREST: comprueba el contrato de la consulta, el filtro por
cafetería y el cálculo, pero no RLS ni los disparadores de las migraciones
externas. V02 / CAM-237 figura `Done` en Linear, pero su verificación con dos
sesiones reales de Supabase Auth sigue pendiente en su propio registro; E09 no
acredita esa integración de punta a punta y no modifica datos de Cloud.

La prueba E09 se limita al cotejo del pedido cancelado. No cubre reembolsos ni
duplicados de comisión, que no forman parte de esta divergencia.
