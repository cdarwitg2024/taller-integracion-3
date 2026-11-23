<!-- Registro de validación del resumen de ventas referidas y comisiones del dueño (E11). -->
# E11 — Conectar resumen de ventas y comisiones

## Alcance

E11 / CAM-233 conecta el panel del dueño con las ventas referidas, el total
cobrado y las comisiones por estado (`pendiente`, `disponible`, `revertida`).
Sus dependencias E04, V08 y V12 figuran `Done` en Linear. El resumen se calcula
en `app-desktop/src/services/resumenComisiones.js` leyendo
`movimientos_comision` con el JWT del dueño y el pedido embebido; no hay RPC
nueva ni `service_role`. `cargadorDashboard.js` lo consulta junto con las
demandas del panel y mantiene su aviso propio: un fallo de comisiones no borra
las ventas ya obtenidas. El aviso aparece en `Dashboard.jsx` junto al resumen y
al historial de movimientos.

**Procedencia del SQL (importante para la revisión):** las migraciones V08, V09,
V11, V12, V13 y V14 viven en `Diego24Vas/db_CoffeeFaster`, **no en este
repositorio**. Este cambio no copia, reaplica ni modifica ese SQL. Diego confirma
que todo el SQL que sube en sus PRs ya está aplicado en Supabase Cloud. Tras la
revisión de este PR se comprobó que `develop` de ese repo incorporó los PRs #5 y
#6 (`8b80271`, `c595ecc`) con la reconciliación de migraciones y la restricción
única de `usuarios.auth_user_id`; no exigen cambios en E11.

## Registro reproducible

Desde la raíz, con Node.js 22:

~~~sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
~~~

Referencias: `app-desktop/tests/resumen-comisiones.test.cjs` y
`app-desktop/tests/dashboard.test.cjs`. El transporte de Supabase se sustituye
por una implementación en memoria; no se consultó Supabase Cloud ni se aplicó
SQL.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Sin cafetería (`null`, `undefined`, vacío o espacios) | Resumen en cero y cero consultas | Aprobado |
| Movimientos `pendiente`, `disponible` y `revertida`, más una reversión | Totales por estado, cada pedido contado una vez y la reversión sin restarse dos veces | Aprobado |
| Movimiento de otra cafetería devuelto por RLS | Se descarta; no aporta ventas ni comisiones | Aprobado |
| Error de Supabase | Se propaga como error de comisiones | Aprobado |
| Falla de comisiones con pedidos cargados | Ventas visibles, `dbError` nulo, aviso de comisiones y resumen nulo | Aprobado |
| Reintento visible | Limpia el aviso anterior, vuelve a consultar y muestra el resumen | Aprobado |
| Cambio de cafetería con respuesta tardía | Se descarta el resumen de la cafetería anterior | Aprobado |
| Render del panel con aviso y datos | El aviso, las ventas, el resumen y `Reintentar` aparecen juntos | Aprobado |

## Resultado

- Escritorio: 151/151 pruebas aprobadas sobre `develop` con E13 integrado (8 nuevas de E11: 7 del resumen y 1 de render).
- `npm run build --prefix app-desktop`: código de salida 0.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron, un navegador real ni una consulta HTTP/PostgREST contra
Cloud: el resumen se validó con un transporte en memoria y un render estático de
React. Las cifras reales dependen de que V08, V09 y V11 estén generando
movimientos en el entorno desplegado; Diego confirma que su SQL ya está en
Cloud, pero este trabajo no lo verificó directamente. No se aplicó SQL ni se
modificaron despliegues.
