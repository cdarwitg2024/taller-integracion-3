<!-- Registro de validación del resumen de ventas referidas y comisiones del dueño (E11). -->
# E11 — Conectar resumen de ventas y comisiones

## Alcance

E11 / CAM-233 conecta el panel del dueño con las ventas referidas, el total
cobrado y las comisiones por estado (`pendiente`, `disponible`, `revertida`).
Sus dependencias E04, V08 y V12 figuran `Done` en Linear. El resumen se calcula
en `app-desktop/src/services/resumenComisiones.js` leyendo
`movimientos_comision` con el JWT del dueño y el pedido embebido; no hay RPC
nueva ni `service_role`. La consulta filtra por cafetería en servidor, pide
`count` y pagina de 200 en 200: si el historial no se confirma completo, falla
en vez de mostrar cifras parciales. `cargadorDashboard.js` lo consulta junto con
las demandas del panel y mantiene su aviso propio: un fallo de comisiones no
borra las ventas ni el último resumen bueno de esa cafetería. El aviso aparece
en `Dashboard.jsx` junto al resumen y al historial de movimientos.
`movimientos_comision` no está publicado en `supabase_realtime`, así que la
frescura del resumen depende del respaldo existente de 10 s. Los refrescos
silenciosos (respaldo y realtime) se omiten mientras hay una carga en curso, para
que una consulta más lenta que 10 s no sea invalidada antes de publicarse; el
cambio de cafetería y el reintento visible siguen invalidando la carga anterior.

**Procedencia del SQL (importante para la revisión):** las migraciones V08, V09,
V11, V12, V13 y V14 viven en `Diego24Vas/db_CoffeeFaster`, **no en este
repositorio**. Este cambio no copia, reaplica ni modifica ese SQL; su estado se
consigna en `docs/estado-actual.md` dentro de esta misma rama T11.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
node .github/scripts/verify-unit-sensitivity.cjs desktop
git diff --check
~~~

Referencias: `app-desktop/tests/resumen-comisiones.test.cjs` y
`app-desktop/tests/dashboard.test.cjs`. El transporte de Supabase se sustituye
por una implementación en memoria; no se consultó Supabase Cloud ni se aplicó
SQL. Los comandos acotados que producen el cotejo son:

~~~sh
node --test --test-name-pattern="el resumen agrupa" app-desktop/tests/resumen-comisiones.test.cjs
node --test --test-name-pattern="el componente real muestra" app-desktop/tests/dashboard.test.cjs
~~~

## Datos de prueba y cotejo

La fixture del primer comando usa tres pedidos de la cafetería 1 y uno de la 2:
el pedido 10 tiene la comisión original de $1.000 en estado `revertida` y su
compensación V09 de $-1.000, el 11 aporta una comisión disponible de $2.000
sobre un cobro de $15.000, el 12 una revertida de $1.500 con su compensación de
$-1.500 sobre $12.000 y el pedido 13 se descarta por cafetería ajena. Cada
comisión `revertida` lleva su compensación negativa, como exige el trigger de
`0020`; no se usa ningún estado imposible en la base real.

| Resultado | Esperado | Observado |
|---|---|---|
| Ventas referidas | 3 | 3 |
| Total cobrado | $37.000 | $37.000 |
| Comisión pendiente | $0 | $0 |
| Comisión disponible | $2.000 | $2.000 |
| Comisión revertida | $2.500 | $2.500 |
| Reversiones | $-2.500 | $-2.500 |

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Sin cafetería (`null`, `undefined`, vacío o espacios) | Resumen en cero y cero consultas | Aprobado |
| Movimientos `pendiente`, `disponible` y `revertida`, más una reversión | Totales por estado, cada pedido contado una vez y la reversión sin restarse dos veces | Aprobado |
| Movimiento de otra cafetería devuelto por RLS | Se descarta; no aporta ventas ni comisiones | Aprobado |
| Error de Supabase | Se propaga como error de comisiones | Aprobado |
| Historial de 450 movimientos | Filtro por cafetería en servidor, 3 páginas y totales completos | Aprobado |
| Conteo incompleto o cambiante entre páginas | Se rechaza sin mostrar cifras parciales | Aprobado |
| Historial mayor que 50 páginas | Se rechaza después de 50 consultas sin cifras parciales | Aprobado |
| IDs duplicados o no enteros | Se rechaza la respuesta como inválida | Aprobado |
| Historial vacío con cafetería válida | Resumen en cero tras una sola consulta | Aprobado |
| Falla inicial de comisiones con pedidos cargados | Ventas visibles, `dbError` nulo, aviso de comisiones y resumen nulo | Aprobado |
| Falla de comisiones tras un éxito | Aviso, ventas y último resumen bueno visibles; el reintento lo reemplaza | Aprobado |
| Reintento visible | Limpia el aviso anterior, vuelve a consultar y muestra el resumen | Aprobado |
| Cambio de cafetería con respuesta tardía | Se descarta el resumen de la cafetería anterior | Aprobado |
| Tres refrescos silenciosos durante una carga lenta | Se omiten sin incrementar `requestId`; la carga inicial publica ventas y resumen al terminar | Aprobado |
| Refresco silencioso tras reactivar | Cierra el indicador que dejó el desmontaje y publica los datos nuevos | Aprobado |
| Render del panel con aviso y datos | El aviso, las ventas, el resumen y `Reintentar` aparecen juntos | Aprobado |
| Render del componente real con la fixture | Se muestran las seis etiquetas, $37.000, $0, $2.000, $2.500 y $-2.500 | Aprobado |

## Resultado

- Escritorio: 161/161 pruebas aprobadas sobre `develop` con E13 integrado (18 nuevas de E11: 16 del resumen/cargador y 2 de render). La regresión de refrescos silenciosos modela tres respaldos de 10 s durante una consulta de 15 s sin esperas reales.
- `node .github/scripts/verify-unit-sensitivity.cjs desktop`: las 5 mutaciones de escritorio se detectan, incluida la del cierre de `loading` en `cargadorDashboard.js`.
- `npm run build --prefix app-desktop`: código de salida 0.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real ni una consulta HTTP/PostgREST contra
Cloud: el resumen se validó con un transporte en memoria y un render estático de
React. Las cifras reales dependen de que V08, V09 y V11 estén generando
movimientos en el entorno desplegado; Diego confirma que su SQL ya está en
Cloud, pero este trabajo no lo verificó directamente. No se aplicó SQL ni se
modificaron despliegues.

`ventasReferidas` y `totalCobrado` son el histórico bruto de pedidos con comisión
registrada: un pedido cancelado con comisión revertida sigue contando como venta
referida y aporta su total histórico. Las comisiones por estado sí reflejan la
reversión. La conciliación de ese bruto con el criterio de ventas del panel
(excluir cancelados/reembolsados, `esPedidoDeVentas` en `pedidosService.js`)
corresponde a E09 / CAM-295, no a E11.
