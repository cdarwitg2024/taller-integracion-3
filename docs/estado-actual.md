# Estado actual de CoffeeFast

Revisión documental del 11 de noviembre de 2026. El estado del código y las pruebas locales se contrastó con el repositorio. El módulo de campañas de afiliados se añadió el 15 de noviembre y se corrigió el 16 de noviembre. Las observaciones de Cloud y Kubernetes conservan la fecha de su verificación.

## Arquitectura

- Mobile: React Native + Expo. Auth, perfil, wallet, menú con stock, lectura de pedidos/QR y Realtime usan Supabase; cafeterías, creación de pedidos y cambios de estado utilizan el gateway. Cancelación mantiene respaldo a su RPC autenticada. La configuración local apunta al gateway de Compose, no a backend-node.
- Desktop: React/Vite/Electron. Usa Supabase para lecturas y gestión; estados de pedidos y validación QR se envían al gateway.
- Gateway Nginx: /api/cafeterias → ms-cafeterias:3002; /api/menus → ms-menus:3003; /api/pedidos y /api/afiliados → ms-pedidos:3005. POST /api/menus/precios es interno y está bloqueado en el gateway.
- `backend-node` sigue presente como servidor legacy y conserva el cliente de inventario anterior.
- Se retiraron de backend-node el catálogo duplicado, sus dos mocks exclusivos y el endpoint de pago no implementado. Se conserva lo que aún tiene dependencias legacy; ver [alcance del retiro](backend-node/guias/README.md).
- `BotTelegramCoffeFaster` es un servicio separado para alertas de stock.

## Estado funcional

| Área | Código actual / evidencia | Pendiente |
|---|---|---|
| Identidad | Auth UUID → usuarios.auth_user_id → usuarios.id → cafeteria_usuarios | Sin asociación se bloquea la operación; no asumir cafetería 1 |
| Mis afiliaciones móvil (A01) | Entrada desde el perfil de estudiante vinculado a Auth; ida y regreso por botón, flecha y Atrás de Android comprobados con sesión real en emulador el 15 de noviembre de 2026. [Registro de validación](mobile/validacion/A01-CAM-266-Acceso-Mis-Afiliaciones.md) | Consulta y gestión de afiliaciones en tareas posteriores |
| Acceso Afiliados (V01) | Menú y ruta protegida del dueño; contexto desde el perfil y aviso sin asignación. [Pruebas locales](desktop/validacion/V01-CAM-223-Acceso-Afiliados.md) | Listados, formularios y gestión de solicitudes en tareas posteriores |
| Dashboard | Indicadores y ranking sin filtro diario; solo ventas por hora usa hoy. Realtime y respaldo cada 10 s | Comprobar con usuarios del entorno definitivo |
| Stock manual | UPDATE real, alcance por cafetería y comprobación de stock anterior en los formularios afectados | No se modificaron existencias Cloud para probarlo |
| Productos e inventario del dueño | Una sola pantalla en /dueno/productos: catálogo, precio, stock, mínimos, valorización y exportación CSV; Realtime de productos/pedidos y respaldo cada 5 s | /dueno/inventario redirige; eliminadas Inventario.jsx y GestorPrecioStock.jsx |
| Solicitudes | Empleado crea; dueño resuelve pendiente → aprobado/rechazado con fecha y autor | Política reforzada preparada en SQL, no aplicada remotamente |
| Configuración de cafetería | Lectura y guardado real por cafetería de la sesión, campos existentes, validaciones y detección de edición concurrente | Comprobar permisos efectivos del entorno; políticas preparadas localmente |
| Promociones | Tabla/RPC activadas en Cloud el 1 de noviembre; mayor descuento por producto sin acumulación | Crear campañas reales desde el panel; no se insertaron promociones de ejemplo |
| Campañas de afiliados | Rutas GET/POST/PATCH en ms-pedidos sobre `public.campanas`; mapeo C02, `dueno_campana_id` como función, versionado del servidor, extensión del trigger V05 para oferta y aceptación real. Escritorio muestra descuento normal, oferta y comisión; `NULL` se muestra como «No especificado». Validación local con Jest, PostgreSQL 15 y CI preparado | Aceptación anticipada según C02, listado estudiantil C04, avisos y decisión sobre campañas existentes sin oferta; SQL no aplicado en Cloud |
| QR | Apertura del detalle con QR y token confirmada en Android. La lista mostró únicamente los pedidos de la cuenta activa en la prueba con dos cuentas | Escaneo, entrega y rechazo del segundo uso en el entorno final |
| Compra y cancelación | Activadas en Cloud: descuento/reposición transaccional y marca stock_descontado | Verificadas con compra/cancelación reversibles; pedidos históricos conservan marca false |
| Voz KDS | voz-pedido publicada; validación del empleado rol 4 comprobada sin generar audio | Confirmar reproducción audible con un pedido real |

El aviso de voz se dispara por un pedido nuevo recibido por Realtime con voz activada. No se dispara al abrir la pantalla, por polling ni al pasar a listo. Los comentarios sobre PEDIDO_LISTO no demuestran una integración existente.

## SQL: código preparado frente a Cloud

- app-mobile/tabla_mobile/rpc_qr.sql: procesar_pago, valida cantidades/stock, agrupa productos repetidos, bloquea productos por ID antes de wallet y marca stock_descontado=true al comprar.
- app-mobile/tabla_mobile/rpc_cancelar_pedido.sql: propietario, pendiente/pagado; bloquea pedido → productos → wallet. Repone solo con stock_descontado=true; reembolso y cierre son atómicos. Conserva pagos.estado; registra el reembolso en movimientos_wallet.
- Ambas definiciones añaden la columna de forma idempotente, sin marcar pedidos históricos. Aplicarlas coordinadamente antes de habilitar el ciclo nuevo.
- La primera inspección del 1 de noviembre encontró ausente `stock_descontado`. Tras la autorización del usuario se aplicó `database/fixes/activar_stock_promociones_cloud.sql` y se verificó su existencia en la API. La pantalla del dueño relee `productos.stock`; no vuelve a descontarlo en JavaScript.
- database/fixes/resolver_solicitudes_stock_seguro.sql limita la resolución al dueño asociado. Aprobar no significa incrementar stock.
- database/fixes/administrar_campanas_afiliados.sql integra la administración con `public.campanas`: agrega `tasa_descuento_oferta` nullable, crea el versionado de condiciones, extiende el trigger V05 para incluir la oferta en inmutabilidad y nueva versión, y crea las RPC de alta, edición y listado administrativo. Conserva `confirmar_condiciones_campana` y su restricción de vigencia. No se aplicó en Cloud.
- get_current_user_id y otras dependencias base no están totalmente versionadas: el repositorio no permite asumir una reconstrucción completa de Cloud desde cero.
- No ejecutar todos los fixes ni seeds como una migración global. Solo se aplicó la migración reconciliada indicada; la política de solicitudes sigue pendiente.
- **Autorización posterior del usuario: activar en Cloud stock y dependencias del panel.** Ejecutado con respaldo, ensayo reversible y publicación transaccional. La definición Cloud conserva `generar_token_retiro`, `codigo_pedido`, validación de franja y el contrato anterior de credenciales; agrega el alias `codigo_retiro` para Mobile. Ver [promociones y configuración](base-datos/promociones-configuracion-dueno.md).

## Últimas validaciones registradas

- Mobile: 68 pruebas en 11 suites, con regresiones de sesión vencida y recuperación de pedidos. Las lecturas reintentan una vez tras renovar el JWT. El flujo de compra y cancelación conserva sus llamadas de escritura sin reintento automático por vencimiento.
- Desktop: 40 pruebas locales, incluidas 13 de campañas. Backend legacy: 36 pruebas vigentes aprobadas. Microservicios: 214, además de 5 de shared. Telegram: 11, incluida una integración con PostgreSQL.
- PostgreSQL aislado: 18 escenarios de compra, cancelación y concurrencia. Catálogo: 7 escenarios HTTP con PostgREST y PostgreSQL. Las pruebas detectaron 11 defectos introducidos en copias temporales.
- La ejecución en GitHub Actions, la prueba manual de retiro y la cobertura completa de Supabase Auth/RLS se verifican por separado. Ver [evidencia y alcance](calidad/validacion/revision-pruebas.md).

Comandos desde la raíz, para el código actual:

~~~powershell
npm --prefix app-desktop test
npm --prefix app-desktop run build
npm --prefix app-mobile test -- --runInBand
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
npm --prefix Microservices/ms-pedidos test -- --runInBand
node app-mobile/tabla_mobile/tests/run-procesar-pago.cjs
git diff --check
~~~

El runner SQL crea y elimina una BD temporal cf_panel_test_* en PostgreSQL local. Requiere Docker y, por defecto, supabase_db_db_CoffeeFaster; puede configurarse TEST_POSTGRES_CONTAINER. Nunca apunta a Cloud.

Ver [puesta en marcha](microservicios/operacion/puesta_en_marcha_flujo_pedidos.md), [estado Kubernetes](kubernetes/estado-actual.md) y [voz del KDS](desktop/notificaciones/notificaciones_voz_elevenlabs.md).
