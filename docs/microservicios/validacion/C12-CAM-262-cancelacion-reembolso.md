# C12 / CAM-262 — Cancelación y reembolso integrados en Cloud

Validación del 23 de noviembre de 2026, hora de Santiago. Se usó la app móvil con el gateway local y Supabase Cloud con V08, V09 y la regla de elegibilidad por comprador y código.

| Paso | Resultado esperado | Resultado observado en el pedido #49 |
| --- | --- | --- |
| Comprar con código afiliado | Registrar un débito por el total descontado y una comisión pendiente. | Cloud registró un débito de $6.100 CLP, saldo de $126.000 CLP y comisión pendiente de $5.490 CLP. La app mostró un error porque el servicio rechazó la respuesta exitosa de V08 al confundir el estado del pedido con el estado del pago. [Contrato C07](C07-cotizacion-compra-gateway.md) |
| Cancelar desde Mis pedidos antes de la entrega | Reembolsar el importe cobrado y revertir la comisión pendiente. | El pedido quedó `cancelado`. Cloud registró un reembolso de $6.100 CLP y el saldo volvió a $132.100 CLP. La comisión original de $5.490 CLP quedó `revertida` y se registró una compensación de −$5.490 CLP vinculada al movimiento original. En la app del afiliado, el saldo pendiente bajó a $0 CLP. |
| Volver a cotizar con el mismo código | Recuperar la elegibilidad tras el reembolso total. | El carrito volvió a mostrar el descuento. La comprobación terminó antes de pagar. |
| Repetir `cancelar_pedido(49)` con el contexto del comprador | Rechazar el segundo intento. | SQL Editor devolvió `{"ok":false,"motivo":"ya_cancelado","estado_actual":"cancelado"}`. La prueba se hizo dentro de una transacción con `ROLLBACK`. Una consulta posterior confirmó saldo de $132.100 CLP, un reembolso y una reversión persistidos. |

El segundo intento en Cloud se comprobó a nivel RPC. El HTTP 409 equivalente se verificó previamente en el gateway local con datos desechables. [C12 en Linear](https://linear.app/camilodarwitg/issue/CAM-262)

## Comprobaciones locales posteriores

El 23 de noviembre de 2026, con Node.js 22.23.5 y PostgreSQL 15 desechable:

- `ms-pedidos` aprobó 155 pruebas. La regresión nueva usa la respuesta real de V08 `{"ok":false,"motivo":"saldo_insuficiente","cobrado":false}` y comprueba HTTP 422 con `{"error":"saldo_insuficiente","cobrado":false}`; también se conserva la forma anterior `{"error":"saldo_insuficiente"}`.
- La migración de [límite por comprador y código](../../../database/fixes/limitar_beneficio_por_comprador_y_codigo.sql) se aplicó sobre V07, V08 y V09 reales de `db_CoffeeFaster` en una base temporal. Se comprobaron la compra previa sin código, dos códigos distintos de la misma cafetería, dos compras simultáneas con claves distintas y un solo débito, y la recompra tras un reembolso total.
- No se aplicó SQL en Supabase Cloud. La evidencia de Cloud anterior se conserva sin cambios.
