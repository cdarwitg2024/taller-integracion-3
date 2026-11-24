# D12 · Corregir inconsistencias de Wallet tras cancelar

La regresión monta App, Pedidos y Wallet con Supabase y el gateway simulados.
El pedido #52 tiene subtotal de $6.000 y cobro confirmado de $5.100.

| Paso | Resultado esperado y observado tras el ajuste |
|---|---|
| Abrir Wallet y luego el detalle del pedido pendiente | Wallet muestra $4.900 y el pedido ofrece cancelar. |
| Confirmar la cancelación con HTTP 200 | El detalle muestra «Pedido cancelado», el aviso informa el reembolso de $5.100 y Wallet queda en $10.000. |
| Volver a Pedidos, simular una lectura atrasada y repetir la cancelación | El gateway devuelve HTTP 409 con `ya_cancelado`. El detalle vuelve a mostrar «Pedido cancelado» y el aviso comunica que ya estaba cancelado, sin anunciar otro reembolso. Wallet sigue en $10.000 aunque falle la consulta posterior. |
| Dejar pendiente la consulta de Wallet después del reembolso y avanzar tres segundos | Los $10.000, «Recargar», «Actualizar», las estadísticas y el historial siguen visibles. Los conteos pendientes muestran guiones y el historial dice «Cargando movimientos...». |
| En un caso separado, rechazar la primera cancelación con HTTP 409 | Wallet conserva los $4.900 confirmados. |

Antes del ajuste, la regresión fallaba al comprobar el detalle después de
`ya_cancelado`: el aviso era correcto, pero el detalle seguía pendiente.
El rechazo de una cancelación repetida no produjo un abono extra durante
la reproducción. La prueba ampliada también detectó que la consulta pendiente
dejaba invisibles las acciones, las estadísticas y el historial de Wallet.

Desde la raíz del repositorio:

~~~powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/WalletCancelacion.test.tsx
~~~

El caso de reintento verifica el estado visible y dos solicitudes de
cancelación. La persistencia del reembolso único está documentada en
[C12](../../microservicios/validacion/C12-CAM-262-cancelacion-reembolso.md).
D12 no repite operaciones en Cloud ni usa un dispositivo.
