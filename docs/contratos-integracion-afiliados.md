# C02 · Contratos de integración de afiliados

Contrato propuesto para implementar las [reglas de C01](reglas-piloto-afiliados.md). Las rutas de afiliados y los campos nuevos son parte del diseño del piloto. Los identificadores, fechas y sesiones de los ejemplos son ficticios. Los montos son enteros en CLP y las fechas usan ISO 8601 con zona horaria.

Todas las solicitudes usan `Authorization: Bearer <sesion>` y, cuando llevan JSON, `Content-Type: application/json`. Las tablas indican de quién es la sesión. El servidor obtiene la identidad desde la sesión, comprueba el rol y el acceso a la cafetería, y valida que los recursos pertenezcan a ella. Una sesión ausente o vencida devuelve `401` y una operación fuera del alcance del usuario devuelve `403`.

## 1. Campañas

| Sesión | Solicitud | Éxito | Error |
|---|---|---|---|
| Dueño, escritorio | `GET /api/afiliados/cafeterias/7/campanas/administracion` | `200 {"campanas":[...]}` con todas las campañas de su cafetería | `403 {"error":"sin_acceso_cafeteria"}` |
| Dueño, escritorio | `POST /api/afiliados/cafeterias/7/campanas` | `201 {"id":31,"cafeteria_id":7,"estado":"programada"}` | `403 {"error":"sin_acceso_cafeteria"}` |
| Estudiante, móvil | `GET /api/afiliados/cafeterias/7/campanas` | `200 {"campanas":[...]}`; contrato oficial en [C04](microservicios/validacion/S3-T4-consulta-campanas-vigentes.md) | `401` sin sesión válida; `403` sin estudiante activo |
| Dueño, escritorio | `PATCH /api/afiliados/cafeterias/7/campanas/31` con `{"descuento_normal_pct":12}` | Antes del inicio, `200 {"id":31,"descuento_normal_pct":12}` | Desde el inicio, `409 {"error":"porcentajes_fijados"}` |
| Dueño, escritorio | Misma ruta con `{"pausada":true}` o `{"pausada":false}` | `200 {"id":31,"estado":"pausada"}` o `200 {"id":31,"estado":"activa"}` | Al reanudar después del término, `409 {"error":"campana_finalizada"}` |

La consulta C04 usa la RPC `listar_oportunidades_campana` (BD `0023` + `0024`). Solo lista campañas vigentes de cafeterías activas. Enviar `?postulables=true` devuelve `400`. El alta y la edición de C03 conservan sus URL y operan sobre `public.campanas`.

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
| Dueño, escritorio | `PATCH /api/afiliados/cafeterias/7/campanas/31/solicitudes/82` con `{"decision":"desactivar"}` | `200 {"id":82,"estado":"aprobada","codigo":"DIEGO-PROMO1","codigo_activo":false}` | `409 {"error":"resolucion_en_conflicto"}` si la solicitud no está aprobada |
| Dueño, escritorio | `POST /api/afiliados/cafeterias/7/campanas/31/solicitudes/82/reenviar-aviso` | `202 {"estado":"aviso_pendiente"}` | `409 {"error":"solicitud_no_aprobada"}` |

C05 devuelve `201` en la primera solicitud y `200` con el mismo ID y el estado persistido al repetirla. La aprobación admite una propuesta opcional de `codigo`. Si se omite, SQL lo genera. Las respuestas aprobadas incluyen `codigo_activo`. Al desactivar, el código queda reservado y un reintento de aprobación conserva la desactivación. El correo y el reenvío corresponden a una tarea posterior. [Validación de C05](microservicios/validacion/C05-solicitudes-afiliacion.md).

Los dos listados devuelven hasta 100 solicitudes por página, en orden descendente de ID. Si hay más filas, la respuesta incluye `siguiente_antes_de`. Para continuar, repite el mismo GET con la misma sesión y añade `?antes_de=<siguiente_antes_de>`. Cuando el campo está ausente, llegaste al final. Una página puede traer menos de 100 filas por el límite de PostgREST. La autorización se verifica en cada página.

El formulario de «Promocionar» exige una explicación y admite un enlace público opcional. Si el dueño invita a alguien, esa persona usa el mismo formulario. Una campaña admite varios afiliados con sus propios códigos. El dueño asigna el código al aprobar y el servidor comprueba su unicidad en todo CoffeeFast. Una aprobación guarda el código en el perfil y dispara el aviso por correo. Si falla el correo, el código sigue visible y el dueño puede reenviar el aviso. Una aprobación anticipada permite compartir el código, con canje desde el inicio y mientras la campaña esté activa.

### Lectura del panel móvil A06/A09

C05 devuelve solicitudes y códigos, no saldo ni historial financiero. El panel
móvil consulta `public.movimientos_comision` con la sesión Supabase del usuario,
de acuerdo con el permiso SELECT y RLS de V04 (`0020`). Filtra la afiliación
aprobada devuelta por C05, incluso si `codigo_activo` pasa a `false`.
Las revertidas y sus compensaciones quedan en el historial sin sumar un crédito
o descontarlo dos veces. El resumen de A09 usa la RPC oficial V12
`consultar_saldo_afiliado()` con ese mismo JWT, sin parámetros de identidad.
Devuelve `pendiente_clp`, `disponible_clp` y `retirado_clp` para todas las
afiliaciones del estudiante en una instantánea. El disponible ya resta los
retiros confirmados; el móvil no los descuenta nuevamente ni añade pendientes.
Requiere instalar la migración V12 del [commit oficial 884f256](https://github.com/Diego24Vas/db_CoffeeFaster/commit/884f25698e76df7d50a08b8a0d0a81a1059733e9)
en el entorno de destino. No hay fallback a sumas locales si la RPC falta.
No se implementa una operación de retiro en esta pantalla ni se modifica la Wallet.

Ver [A06](mobile/validacion/A06-Solicitudes-aprobacion.md) para paginación,
comprobaciones del historial y [A09](mobile/validacion/A09-Comisiones-saldo-disponible.md)
para el saldo V12, sus dependencias y el alcance de la transición de entrega controlada.

### Captura local de retiro simulado (A11)

A11 permite preparar un monto entero positivo en CLP, no superior al
`disponible_clp` confirmado de V12. Muestra como destino de prueba
«Cuenta de prueba CoffeeFast (destino ficticio)», de solo lectura y sin
campos bancarios. No establece un contrato HTTP de retiro ni genera un
comprobante: revisar el formulario no envía, reserva o descuenta saldo.
La validación local deberá complementarse con la revalidación del servidor
cuando se integre la operación de retiro. [Registro A11](mobile/validacion/A11-Solicitud-retiro-simulado.md).

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

## Nota de implementación C03 sobre el esquema V05

### Separación de los listados C03 y C04 / E04

El listado administrativo de C03 usa exclusivamente
`GET /api/afiliados/cafeterias/:cafeteriaId/campanas/administracion`. Exige JWT
válido y dueño con usuario y rol activos asociado a esa cafetería. Devuelve
`{campanas: []}` cuando no hay resultados. Cada elemento conserva las columnas
de `public.campanas` (incluidas versión y aceptación) y agrega los alias
`descuento_normal_pct`, `descuento_oferta_pct`, `comision_pct`, `inicio`, `fin`,
`estado` y `estado_db`. Sus estados externos son `programada`, `activa`,
`pausada` y `finalizada`; un estado administrativo no acredita que sea postulable.

C04 usa `GET /api/afiliados/cafeterias/:cafeteriaId/campanas` con el JWT del
estudiante y sin parámetros de consulta. Devuelve `200 {"campanas":[...]}` o
`200 {"campanas":[]}` cuando no hay resultados. Cada campaña incluye `id`,
`nombre`, `cafeteria_id`, `cafeteria_nombre`, `tipo`, `estado`, `vigencia_desde`,
`vigencia_hasta`, `tasa_descuento`, `tasa_comision` y `estado_vigencia`.

La RPC exige un estudiante activo. Solo devuelve campañas en estado `activa`
de cafeterías activas, con inicio inclusivo y fin exclusivo. Una sesión inválida
devuelve `401`; una cuenta sin acceso estudiantil devuelve `403`. Los parámetros
de consulta, incluido `postulables=true`, devuelven
`400 {"error":"parametros_no_admitidos"}`. Si la consulta no está disponible,
devuelve `503`. El [registro C04](microservicios/validacion/S3-T4-consulta-campanas-vigentes.md)
incluye el ejemplo completo y la evidencia de validación.

La administración de campañas usa `public.campanas`, la tabla que consume escritorio. El mapeo aplicado es `descuento_normal_pct → tasa_descuento`, `descuento_oferta_pct → tasa_descuento_oferta` (columna nueva, nullable), `comision_pct → tasa_comision`, `inicio → vigencia_desde` y `fin → vigencia_hasta`.

`public.campanas` no tiene el estado `programada`. La API deriva `programada` para una campaña creada pero no activa y publica el estado real en `estado_db`: `pendiente_aceptacion` al crearla, `aceptada` si ya fue aceptada y todavía no inicia, `activa`, `pausada` o `finalizada`. Las campañas existentes conservan `tasa_descuento_oferta = NULL`; no se reinterpreta su descuento normal como descuento de oferta.

La aceptación de V05 se conserva: activar sin `confirmada_por_dueno` y `version_confirmada = version_condiciones` devuelve `409 {"error":"aceptacion_requerida"}`. Pausar y reanudar no cambian las condiciones, la versión ni la aceptación.

Cada cambio de nombre, descripción, tasas, oferta o vigencia en una campaña no confirmada genera una nueva `version_condiciones` desde el servidor (`1.0 → 1.1`, etc.). Enviar valores idénticos no cambia la versión. El trigger V05 extendido exige esa versión y bloquea cualquier cambio de condiciones después de la aceptación. La oferta se incluye en ambas reglas.

`confirmar_condiciones_campana` conserva su restricción de vigencia: no acepta una campaña antes de `vigencia_desde`. C02 describe la aceptación antes del inicio; esa diferencia queda pendiente y no se modificó V05 para facilitar la prueba.

**Conflicto pendiente de negocio:** este contrato permite editar porcentajes antes del inicio, pero el trigger de V05 impide cambiar las condiciones de una campaña ya aceptada. La implementación conserva la inmutabilidad y devuelve `409 {"error":"condiciones_aceptadas"}`. El trigger no se relajó; solo se extendió para incluir `tasa_descuento_oferta`. Si se decide permitir la edición previa al inicio, debe definirse si se invalida la aceptación, si se emite una nueva `version_condiciones` y cómo se avisa a los afiliados.
