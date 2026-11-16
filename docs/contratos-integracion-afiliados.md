# C02 · Contratos de integración de afiliados

Contrato propuesto para implementar las [reglas de C01](reglas-piloto-afiliados.md). Las rutas de afiliados y los campos nuevos son parte del diseño del piloto. Los identificadores, fechas y sesiones de los ejemplos son ficticios. Los montos son enteros en CLP y las fechas usan ISO 8601 con zona horaria.

Todas las solicitudes usan `Authorization: Bearer <sesion>` y, cuando llevan JSON, `Content-Type: application/json`. Las tablas indican de quién es la sesión. El servidor obtiene la identidad desde la sesión, comprueba el rol y el acceso a la cafetería, y valida que los recursos pertenezcan a ella. Una sesión ausente o vencida devuelve `401` y una operación fuera del alcance del usuario devuelve `403`.

## 1. Campañas

| Sesión | Solicitud | Éxito | Error |
|---|---|---|---|
| Dueño, escritorio | `POST /api/afiliados/cafeterias/7/campanas` | `201 {"id":31,"cafeteria_id":7,"estado":"programada"}` | `403 {"error":"sin_acceso_cafeteria"}` |
| Cliente, móvil | `GET /api/afiliados/cafeterias/7/campanas?postulables=true` | `200 {"campanas":[{"id":31,"nombre":"Semana del café","estado":"programada","descuento_normal_pct":15,"descuento_oferta_pct":5,"comision_pct":10,"inicio":"2026-12-01T08:00:00-03:00","fin":"2026-12-15T20:00:00-03:00"}]}` | `401 {"error":"sesion_invalida"}` |
| Dueño, escritorio | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"descuento_normal_pct":12}` | Antes del inicio, `200 {"id":31,"descuento_normal_pct":12}` | Desde el inicio, `409 {"error":"porcentajes_fijados"}` |
| Dueño, escritorio | Misma ruta con `{"pausada":true}` o `{"pausada":false}` | `200 {"id":31,"estado":"pausada"}` o `200 {"id":31,"estado":"activa"}` | Al reanudar después del término, `409 {"error":"campana_finalizada"}` |

Cuerpo de creación:

```json
{
  "nombre": "Semana del café",
  "descuento_normal_pct": 15,
  "descuento_oferta_pct": 5,
  "comision_pct": 10,
  "inicio": "2026-12-01T08:00:00-03:00",
  "fin": "2026-12-15T20:00:00-03:00"
}
```

El dueño define los tres porcentajes. Si cambia alguno antes del inicio, se avisa a los afiliados aprobados y se mantienen sus códigos. La edición a 12 % ilustra una operación independiente. Los ejemplos de compra usan la campaña original de 15 % y 5 %. Al reanudar se conservan los porcentajes y las fechas originales.

## 2. Solicitud, decisión y perfil

| Sesión | Solicitud | Éxito | Error |
|---|---|---|---|
| Diego, móvil | `POST /api/afiliados/cafeterias/7/campanas/31/solicitudes` con `{"plan_promocion":"Compartiré un video en la comunidad universitaria.","enlace_publico":"https://example.com/diego"}` | `201 {"id":82,"estado":"pendiente"}` | `422 {"error":"plan_promocion_requerido"}` |
| Dueño, escritorio | `GET /api/afiliados/cafeterias/7/campanas/31/solicitudes` | `200 {"solicitudes":[{"id":82,"solicitante":"Diego","estado":"pendiente","plan_promocion":"Compartiré un video en la comunidad universitaria.","enlace_publico":"https://example.com/diego"}]}` | `403 {"error":"sin_acceso_cafeteria"}` |
| Dueño, escritorio | `PATCH /api/afiliados/cafeterias/7/campanas/31/solicitudes/82` con `{"decision":"aprobar","codigo":"DIEGO-PROMO1"}` o `{"decision":"rechazar"}` | `200 {"id":82,"estado":"aprobada","codigo":"DIEGO-PROMO1"}` o `200 {"id":82,"estado":"rechazada"}` | `409 {"error":"codigo_en_uso"}`. La solicitud sigue pendiente. |
| Diego, móvil | `GET /api/afiliados/mi-perfil` | `200 {"solicitudes":[{"id":82,"cafeteria_id":7,"campana_id":31,"estado":"aprobada","codigo":"DIEGO-PROMO1"}]}` | `401 {"error":"sesion_invalida"}` |
| Dueño, escritorio | `POST /api/afiliados/cafeterias/7/campanas/31/solicitudes/82/reenviar-aviso` | `202 {"estado":"aviso_pendiente"}` | `409 {"error":"solicitud_no_aprobada"}` |

El formulario de «Promocionar» exige una explicación y admite un enlace público opcional. Si el dueño invita a alguien, esa persona usa el mismo formulario. Una campaña admite varios afiliados con sus propios códigos. El dueño asigna el código al aprobar y el servidor comprueba su unicidad en todo CoffeeFast. Una aprobación guarda el código en el perfil y dispara el aviso por correo. Si falla el correo, el código sigue visible y el dueño puede reenviar el aviso. Una aprobación anticipada permite compartir el código, con canje desde el inicio y mientras la campaña esté activa.

## 3. Cotización y compra

Ana envía su sesión desde móvil. La cotización calcula el precio vigente sin cobrar ni consumir el beneficio.

```http
POST /api/afiliados/cotizaciones
Authorization: Bearer <sesion-ana>
Content-Type: application/json

{"cafeteria_id":7,"items":[{"producto_id":41,"cantidad":1}],"codigo":"DIEGO-PROMO1"}
```

- **200** `{"subtotal":10000,"descuento_afiliado":1500,"total":8500}`. Para un carrito de $10.000 a precio normal y $8.000 en oferta, el subtotal es $18.000, el descuento adicional es $1.900 y el total $16.100.
- **422** `{"error":"campana_no_iniciada","inicio":"2026-12-01T08:00:00-03:00"}`. Otros motivos son `codigo_invalido`, `campana_pausada`, `campana_finalizada` y `beneficio_usado`.

```http
POST /api/pedidos
Authorization: Bearer <sesion-ana>
Content-Type: application/json
Idempotency-Key: 9853fd16-92e4-4ab6-994a-477832a4a502

{"cafeteria_id":7,"items":[{"producto_id":41,"cantidad":1}],"franja_retiro":"12:30-12:45","codigo":"DIEGO-PROMO1","total_aceptado":8500}
```

| Resultado | Respuesta de ejemplo | Comportamiento |
|---|---|---|
| Compra confirmada | `201 {"pedido_id":501,"estado":"pagado","descuento_afiliado":1500,"total_pagado":8500}` | Cobro, pedido y consumo del beneficio se confirman juntos. Dos compras simultáneas con distintas claves respetan el límite de un beneficio por usuario. |
| Total actualizado | `409 {"error":"precio_actualizado","motivo":"campana_pausada","total_aceptado":8500,"total_actualizado":10000,"descuento_afiliado":0,"cobrado":false}` | Móvil explica el motivo y ofrece «Continuar y pagar $10.000» o «Volver al carrito». Si Ana acepta, envía $10.000 con una clave nueva y omite el código. Su beneficio sigue disponible. El mismo flujo aplica con `campana_finalizada` o con un cambio de precio que exige otra confirmación. |
| Pago rechazado | `422 {"error":"saldo_insuficiente","cobrado":false}` | Ana conserva el beneficio. El código puede usarse mientras la campaña siga vigente y activa. |
| Respuesta perdida | Repetir la solicitud original con la misma clave devuelve el mismo resultado registrado. | El servidor asocia la clave al usuario y a los datos del intento. Si la misma clave llega con datos distintos, devuelve `409 {"error":"clave_reintento_en_conflicto"}`. El código de afiliado es independiente de la clave interna. |

**Total actualizado en escritorio.** Si Ana confirma $10.000, el pedido pagado se puede consultar desde escritorio con sesión del dueño de la Cafetería A, por ejemplo `GET /api/pedidos/502` → `200 {"id":502,"cafeteria_id":7,"estado":"pagado","total_pagado":10000}`. Si Ana vuelve al carrito tras el `409`, ese intento no crea un pedido para el panel. Una consulta fuera del alcance de la cafetería devuelve `403`.

## 4. Retiro y comisión

Se mantienen las credenciales de retiro existentes. Los siguientes resultados describen el comportamiento que debe integrar el piloto, siguiendo el flujo actual de [compra y retiro](microservicios/operacion/puesta_en_marcha_flujo_pedidos.md).

| Sesión | Solicitud | Éxito | Error |
|---|---|---|---|
| Ana, móvil | `GET /api/pedidos/501/qr` o `GET /api/pedidos/501/token-contingencia` | Móvil muestra la credencial persistida. El respaldo devuelve `200 {"token":"TOKEN-EJEMPLO"}`. | `403` si el pedido pertenece a otro usuario. |
| Empleado, escritorio | Escaneo con `POST /api/pedidos/validar-qr` y `{"qr_token":"QR-EJEMPLO"}`, o ingreso manual con el flujo vigente de contingencia. | El retiro válido de un pedido listo confirma `entregado` y habilita la comisión una sola vez. Ejemplo de validación: `200 {"valido":true}`. | Si ya se entregó, escritorio informa «Este pedido ya fue entregado». Una credencial inválida o ajena a la cafetería impide la entrega. |

La comisión se registra al confirmar la transición a `entregado`. La respuesta `valido: true` de la comprobación de una credencial por sí sola es insuficiente. En el panel del dueño, el pedido de Ana pagado por $8.500 genera $850 para Diego al entregarse. La compra de Diego con su propio código cuesta $8.500 y genera $0 de comisión. Una campaña pausada después del pago conserva la comisión pactada para ese pedido. Un reembolso total antes de la entrega deja la comisión en $0 y libera el beneficio.

## Trazabilidad para implementación

| Decisión o hallazgo | Caso que lo justifica | Tarea que usa el contrato |
|---|---|---|
| Fijar porcentajes desde el inicio y avisar cambios previos | Diego recibe su código antes de publicar y el dueño cambia el descuento de una campaña futura. | Gestión de campañas en escritorio y avisos |
| Guardar código único al aprobar y mantenerlo visible si falla el correo | Dos solicitudes reciben la misma propuesta de código o Diego no recibe el aviso. | Solicitudes en móvil, decisión en escritorio y perfil de afiliado |
| Cotizar con el precio vigente y pedir confirmación ante un cambio | La campaña se pausa y el total sube de $8.500 a $10.000. | Cotización y confirmación en móvil, consulta de pedidos en escritorio |
| Reutilizar la clave para el mismo intento y aplicar el beneficio al cobrar | Se pierde la respuesta del servidor después de confirmar el pedido. | Compra y reintentos en móvil |
| Habilitar una sola comisión al entregar, con excepción para código propio | Se repite el escaneo o Diego compró con su propio código. | Retiro en escritorio y registro de comisiones |
