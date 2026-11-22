# D07 · Mantener la clave del intento de compra

Base: develop en `7952432`, con D02, C02 y C07 integradas.

La app guarda la clave y el cuerpo por cuenta antes de enviar el pedido. El
cliente obtiene el JWT antes de marcar el intento como enviado y espera esa
escritura antes del POST. Un fallo de sesión deja el intento preparado. Un
HTTP 400/401 definitivo o un rechazo explícito lo invalida de forma persistente.

El checkout comprueba si hay un envío pendiente antes de consultar stock.
Una respuesta perdida, incompleta o un fallo de resultado incierto conserva
el registro aunque cambie la franja o se vacíe, reconstruya o cambie el carrito.
C07 mantiene la compra anterior cuando el móvil envía solo la clave sin
`total_aceptado`; ese flujo todavía no deduplica pagos.

En el aviso, **Revisar pedidos** abre los pedidos. Al volver al carrito y
confirmar, el aviso permite **Reiniciar intento** y pide declarar que ya se
revisaron los pedidos. Esa acción solo invalida el registro; otra compra
requiere una confirmación manual y recibe una clave nueva. No hay conciliación
automática con el servidor. Si el resultado sigue sin aclararse, el aviso
indica esperar antes de comprar otra vez.

## Evidencia

| Paso | Resultado comprobado |
|---|---|
| Doble toque o respuesta perdida/incompleta seguida de cambio de franja | Un POST; se conserva la clave y el cuerpo originales |
| Perder la respuesta y agotar stock | Revisar Pedidos sin otra consulta de stock ni POST |
| Vaciar con eliminaciones/decrementos agrupados y reconstruir | El intento incierto sobrevive y bloquea otro envío |
| Confirmar el reinicio explícito y luego pagar manualmente | El reinicio no envía pagos; el nuevo POST usa otra clave |
| Fallar al leer sesión y recuperar el JWT | Cero POST durante el fallo; después se puede confirmar |
| Recibir 400 y editar, o recibir 401 y recuperar sesión | Otra confirmación usa otra clave |
| Confirmar un pago y comprar otra vez | Clave nueva; la invalidación se espera antes de limpiar el carrito |
| Fallar al persistir, leer un registro dañado o reiniciar el módulo | Los errores se muestran; el marcador persistido impide reutilizar una clave invalidada |

Desde la raíz, con Node 22:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/CheckoutIntento.test.tsx __tests__/RecuperacionIntento.test.tsx src/services/crearPedidoDesdeCarrito.test.ts src/services/intentoCompraPersistencia.test.ts
```

Las regresiones de pantalla montan App y CartScreen y simulan Auth,
almacenamiento y transporte. No se hicieron compras reales ni se verificó
deduplicación de pagos en servidor.

Validación local del 22 de noviembre de 2026 con Node 22.19.0: 297 pruebas
aprobadas y dos integraciones optativas omitidas. TypeScript y exportación
Android correctos.
