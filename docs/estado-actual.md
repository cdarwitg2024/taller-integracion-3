# Estado actual de CoffeeFast

Revisión: 1 de noviembre de 2026. Distingue código del working tree, pruebas locales y servicios publicados. No es una certificación del freeze de main.

## Arquitectura

- Mobile: React Native + Expo. Auth, perfil, wallet, menú con stock, lectura de pedidos/QR y Realtime usan Supabase; cafeterías, creación de pedidos y cambios de estado utilizan el gateway. Cancelación mantiene respaldo a su RPC autenticada. La configuración local apunta al gateway de Compose, no a backend-node.
- Desktop: React/Vite/Electron. Usa Supabase para lecturas y gestión; estados de pedidos y validación QR se envían al gateway.
- Gateway Nginx: /api/cafeterias → ms-cafeterias:3002; /api/menus → ms-menus:3003; /api/pedidos → ms-pedidos:3005. POST /api/menus/precios es interno y está bloqueado en el gateway.
- backend-node sigue presente como legacy: contiene FCM y el cliente de inventario anterior. No es el backend objetivo de la compra Mobile actual.
- Se retiraron de backend-node el catálogo duplicado, sus dos mocks exclusivos y el endpoint de pago no implementado. Se conserva lo que aún tiene dependencias legacy; ver [alcance del retiro](../backend-node/README.md).
- BotTelegramCoffeFaster es un servicio separado. Telegram no equivale a push móvil.

## Estado funcional

| Área | Código actual / evidencia | Pendiente |
|---|---|---|
| Identidad | Auth UUID → usuarios.auth_user_id → usuarios.id → cafeteria_usuarios | Sin asociación se bloquea la operación; no asumir cafetería 1 |
| Dashboard | Indicadores y ranking sin filtro diario; solo ventas por hora usa hoy. Realtime y respaldo cada 10 s | Comprobar con usuarios del entorno definitivo |
| Stock manual | UPDATE real, alcance por cafetería y comprobación de stock anterior en los formularios afectados | No se modificaron existencias Cloud para probarlo |
| Productos e inventario del dueño | Una sola pantalla en /dueno/productos: catálogo, precio, stock, mínimos, valorización y exportación CSV; Realtime de productos/pedidos y respaldo cada 5 s | /dueno/inventario redirige; eliminadas Inventario.jsx y GestorPrecioStock.jsx |
| Solicitudes | Empleado crea; dueño resuelve pendiente → aprobado/rechazado con fecha y autor | Política reforzada preparada en SQL, no aplicada remotamente |
| Configuración de cafetería | Lectura y guardado real por cafetería de la sesión, campos existentes, validaciones y detección de edición concurrente | Comprobar permisos efectivos del entorno; políticas preparadas localmente |
| Promociones | Tabla/RPC activadas en Cloud el 1 de noviembre; mayor descuento por producto sin acumulación | Crear campañas reales desde el panel; no se insertaron promociones de ejemplo |
| QR | Credencial completa persistida, sin construir códigos desde IDs en Mobile | Prueba física del escaneo en el entorno final |
| Compra y cancelación | Activadas en Cloud: descuento/reposición transaccional y marca stock_descontado | Verificadas con compra/cancelación reversibles; pedidos históricos conservan marca false |
| Voz KDS | voz-pedido publicada; validación del empleado rol 4 comprobada sin generar audio | Confirmar reproducción audible con un pedido real |
| Push | FCM implementado en backend legacy; sin registro/recepción Mobile ni disparo en ms-pedidos | Integración completa pendiente |

El aviso de voz se dispara por un pedido nuevo recibido por Realtime con voz activada. No se dispara al abrir la pantalla, por polling ni al pasar a listo. Los comentarios sobre PEDIDO_LISTO no demuestran una integración existente.

## SQL: código preparado frente a Cloud

- app-mobile/tabla_mobile/rpc_qr.sql: procesar_pago, valida cantidades/stock, agrupa productos repetidos, bloquea productos por ID antes de wallet y marca stock_descontado=true al comprar.
- app-mobile/tabla_mobile/rpc_cancelar_pedido.sql: propietario, pendiente/pagado; bloquea pedido → productos → wallet. Repone solo con stock_descontado=true; reembolso y cierre son atómicos. Conserva pagos.estado; registra el reembolso en movimientos_wallet.
- Ambas definiciones añaden la columna de forma idempotente, sin marcar pedidos históricos. Aplicarlas coordinadamente antes de habilitar el ciclo nuevo.
- La primera inspección del 1 de noviembre encontró ausente `stock_descontado`. Tras la autorización del usuario se aplicó `database/fixes/activar_stock_promociones_cloud.sql` y se verificó su existencia en la API. La pantalla del dueño relee `productos.stock`; no vuelve a descontarlo en JavaScript.
- database/fixes/resolver_solicitudes_stock_seguro.sql limita la resolución al dueño asociado. Aprobar no significa incrementar stock.
- get_current_user_id y otras dependencias base no están totalmente versionadas: el repositorio no permite asumir una reconstrucción completa de Cloud desde cero.
- No ejecutar todos los fixes ni seeds como una migración global. Solo se aplicó la migración reconciliada indicada; la política de solicitudes sigue pendiente.
- **Autorización posterior del usuario: activar en Cloud stock y dependencias del panel.** Ejecutado con respaldo, ensayo reversible y publicación transaccional. La definición Cloud conserva `generar_token_retiro`, `codigo_pedido`, validación de franja y el contrato anterior de credenciales; agrega el alias `codigo_retiro` para Mobile. Ver [promociones y configuración](base-datos/promociones-configuracion-dueno.md).

## Validaciones de esta revisión

- Mobile: 58 tests / 10 suites aprobadas; TypeScript sin errores.
- Desktop: build aprobado y 7 pruebas de servicios aprobadas.
- ms-pedidos: 131 tests aprobados.
- PostgreSQL aislado: 8 escenarios de compra + 8 de cancelación, con concurrencia de compra y cancelación aprobadas.
- Estas pruebas no sustituyen una compra/escaneo/voz E2E en Cloud.

Comandos desde la raíz, para el código actual:

~~~powershell
node --test app-desktop/tests/panel-dueno.test.cjs
npm --prefix app-desktop run build
npm --prefix app-mobile test -- --runInBand
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
npm --prefix Microservices/ms-pedidos test -- --runInBand
node app-mobile/tabla_mobile/tests/run-procesar-pago.cjs
git diff --check
~~~

El runner SQL crea y elimina una BD temporal cf_panel_test_* en PostgreSQL local. Requiere Docker y, por defecto, supabase_db_db_CoffeeFaster; puede configurarse TEST_POSTGRES_CONTAINER. Nunca apunta a Cloud.

Ver [puesta en marcha](puesta_en_marcha_flujo_pedidos.md), [estado Kubernetes](kubernetes/estado-actual.md), [voz](notificaciones_voz_elevenlabs.md) y [push](notificaciones_push_fcm.md).
