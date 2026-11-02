# Promociones y configuración del dueño

Estado: 1 de noviembre de 2026. **Activación autorizada y aplicada en Supabase Cloud**, proyecto `yvkpmqcynpygqjvaoiwn`. Se respaldó la definición anterior, se ensayó con ROLLBACK y se publicó en una sola transacción.

## Qué cambia

- Configuración lee la cafetería de la sesión real y guarda nombre, descripción, teléfono, imagen, horarios y visibilidad. No usa dirección, correo o RUT inventados: esas columnas no existen actualmente en `cafeterias`. La dirección mostrada procede de `campus_sedes` y no se modifica aquí.
- Promociones permite crear, editar, pausar y eliminar campañas de la cafetería autorizada, con producto opcional y fechas de inicio/fin. Sin tabla o permisos se informa el error y no se muestra éxito.
- Mobile cotiza el precio promocional al cargar y actualizar el menú. Muestra precio base tachado y precio vigente; el carrito recibe ese precio.
- La RPC de pago recalcula el precio desde el producto bloqueado y las campañas PostgreSQL. `precio_esperado` solo detecta cambios; nunca establece el importe cobrado.

## Reglas de descuento

1. Porcentaje de 1 a 99 %, hasta dos decimales.
2. Producto específico o todos los productos de la misma cafetería.
3. Solo campañas habilitadas, con `inicio <= ahora < fin`; extremos vacíos significan sin límite.
4. Se aplica el porcentaje mayor por producto. No se acumulan descuentos.
5. Redondeo por unidad a CLP, con mínimo de 1 CLP. El precio base de `productos` no se modifica.
6. El precio efectivo queda en `detalles_pedido.precio_unitario` y determina pago, débito wallet y posterior reembolso. Los pedidos anteriores no se recalculan al editar/eliminar campañas.
7. Si el precio/promoción cambia mientras un producto está en el carrito, `procesar_pago` devuelve `precio_actualizado` antes de escribir stock, wallet, pedido o pago. El usuario debe revisar el menú y volver a agregar el producto.

## Archivos SQL y definición publicada

- [Gestión de promociones](../../database/fixes/gestion_promociones_cafeteria.sql): tabla, restricciones, RLS de dueño por asociación, validación de producto/cafetería, cálculo de precio y cotización pública limitada a productos activos. Incluye políticas de consulta/actualización de la propia cafetería.
- [Pago](../../app-mobile/tabla_mobile/rpc_qr.sql): descuento de stock, consulta opcional al cálculo promocional y control de precio esperado.
- [Cancelación](../../app-mobile/tabla_mobile/rpc_cancelar_pedido.sql): devolución del importe realmente cobrado y reposición solo si había descuento de existencias.

La definición efectivamente publicada es [activar_stock_promociones_cloud.sql](../../database/fixes/activar_stock_promociones_cloud.sql). Reconcilia los componentes anteriores con el pago encontrado en Cloud; conserva tokens aleatorios de `generar_token_retiro`, `codigo_pedido`, franja obligatoria y ambos nombres de código de retiro. No se sustituyó por la versión local simplificada usada en las pruebas aisladas. El archivo contiene una comprobación del hash previo y no debe reejecutarse sobre una base ya actualizada sin revisar.

La ausencia de `cotizar_promociones` se reconoce por `PGRST202/42883` y permite mantener el menú anterior a la activación con precios base. Otros errores de cotización bloquean la carga; no se presentan descuentos sin verificar. El pago conserva el comportamiento anterior cuando el helper promocional no está instalado.

La tabla `promociones`, `pedidos.stock_descontado`, `cancelar_pedido` y `cotizar_promociones` ya están publicados. Se verificó la cotización desde la API que usa Mobile (200). No quedaron productos ni campañas de prueba. Los ensayos de compras se revirtieron; no quedaron cargos de prueba.

Se conservan las políticas previas de cafeterías y se agregan las del dueño asociado. La cancelación exige pago Wallet aprobado por el total del pedido; no devuelve saldo de un pedido fabricado o simulado. Un trigger impide al cliente alterar `stock_descontado` o cancelar mediante UPDATE directo. Se retiró la política de cancelación directa del propietario para obligar a usar la RPC.

## Solicitudes de reposición

Aceptar una solicitud registra la autorización administrativa, fecha y responsable. **No aumenta stock.** Cuando se recibe mercadería se registra desde Productos y Stock. No cambiar esta semántica mediante dos UPDATE separados desde el navegador: si se incorpora recepción automática en el futuro, requiere una operación PostgreSQL atómica e idempotente.

## Validación local

- 58 pruebas existentes de Mobile, TypeScript y 7 pruebas de servicios Desktop.
- 8 escenarios de compra, 8 de cancelación y concurrencia en PostgreSQL aislado.
- Comprobaciones adicionales de promoción: mayor descuento, ámbito por producto/cafetería, vigencia, rechazo de precio cambiado sin escrituras, total e histórico con descuento, stock, reembolso y RLS de dueño/estudiante.
- Servicios y pantallas comprobados con transporte controlado: guardar y recargar, conservar formulario ante errores, versiones concurrentes, validaciones y ausencia de tabla. Estas comprobaciones no escriben en Cloud.

### Comprobación posterior a la publicación

Con las funciones ya publicadas, en una transacción terminada en ROLLBACK, se verificaron: stock 10 → compra 1 → 9 → cancelación → 10; doble cancelación; varias unidades/productos y líneas repetidas; stock insuficiente; precio esperado distinto; promoción 25 % con cobro real de 75 sobre base 100; reembolso del importe con descuento; conservación de QR/token; y bloqueo de modificación de la marca desde authenticated. Los datos de prueba no se conservaron. Las secuencias de IDs pueden avanzar durante pruebas revertidas, sin crear pedidos persistidos.
