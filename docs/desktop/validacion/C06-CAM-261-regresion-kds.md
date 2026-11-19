# C06 / CAM-261 — Regresión de entrega desde el KDS

El 19 de noviembre de 2026 se probó la corrección local de `quiet-orchid`, un worktree con cambios sin commit sobre `2c1ddca`. Se usaron Node.js 22.23.5, Edge en modo headless, Desktop con Vite en `127.0.0.1:5206`, `ms-pedidos` del mismo worktree en `127.0.0.1:3922` y Supabase local `db_CoffeeFaster`. La rama C06 en la carpeta principal conservaba el código base durante la prueba.

Se inició sesión en Comandas con un empleado de la cafetería de prueba. Se cargó un PNG con el QR del primer pedido y se ingresó manualmente el código de contingencia del segundo. Se reinició el diálogo entre intentos y se repitió cada credencial. Se registraron las respuestas de red y los campos persistidos antes y después.

| Caso | Pedido | Estado | `qr_usado` | `entregado_en` (UTC) | Respuesta HTTP |
| --- | ---: | --- | --- | --- | --- |
| QR por imagen | 105 | `listo → entregado` | `false → true` | `null → 2026-11-19T05:23:52.329Z` | `200`, `valido: true`, `entregado` |
| QR repetido | 105 | `entregado → entregado` | `true → true` | Sin cambio | `200`, `valido: false`, `ya_entregado` |
| Token manual | 106 | `listo → entregado` | `false → true` | `null → 2026-11-19T05:23:56.351Z` | `200`, `valido: true`, `entregado` |
| Token repetido | 106 | `entregado → entregado` | `true → true` | Sin cambio | `200`, `valido: false`, `ya_entregado` |

El KDS mostró «¡Entrega Validada Exitosamente!» en los dos primeros retiros y «Este pedido ya fue entregado» en las repeticiones. Cada intento emitió un único `POST /api/pedidos/validar-qr`. La traza no registró escrituras directas a Supabase. En la [línea base C08](https://linear.app/camilodarwitg/issue/CAM-242/c08-verificar-entrega-por-qr-y-token-desde-kds), la secuencia HTTP fue `503 → 409 → 200` y Desktop persistió la entrega con `qr_usado=false`.

Se verificó la eliminación de los pedidos y las cuentas Auth temporales. La prueba usó pedidos sin afiliación. La comisión queda pendiente de [V11](https://linear.app/camilodarwitg/issue/CAM-179/v11-habilitar-comision-en-la-entrega-efectiva) y [C09](https://linear.app/camilodarwitg/issue/CAM-255/c09-probar-segunda-validacion-de-retiro). Cámara física, Electron y gateway quedaron fuera de esta corrida.

## Pruebas reproducibles

El script [de regresión HTTP](../../../Microservices/ms-pedidos/scripts/regresion-entrega-qr.cjs) crea pedidos temporales en Supabase local y registra estados y respuestas. Cubre las dos credenciales, el segundo uso, el uso cruzado de credenciales, la concurrencia y los rechazos por credencial, estado, rol y cafetería. Se ejecuta con `node scripts/regresion-entrega-qr.cjs` desde `Microservices/ms-pedidos` con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y `MS_PEDIDOS_URL` del entorno local. Complementa la prueba desde el KDS.

Las suites de Node.js 22 se ejecutan desde la raíz con `npm test --prefix Microservices/ms-pedidos -- --ci` y `npm test --prefix app-desktop`. El build de Desktop se comprueba con `npm run build --prefix app-desktop`.
