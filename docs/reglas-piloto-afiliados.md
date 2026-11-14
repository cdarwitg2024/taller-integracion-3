# C01 · Reglas del piloto de afiliados

## Reglas comunes

- **Un descuento de afiliado por usuario en todo CoffeeFast.** Cualquier usuario puede usar un código válido, aunque ya haya comprado antes. El beneficio se consume al pagar un pedido con el descuento y el límite se comparte entre todas las cafeterías, códigos y campañas. Varias personas pueden usar el mismo código.
- **Descuento.** El dueño fija un porcentaje para productos a precio normal y uno menor para productos en oferta. Este último se aplica sobre el precio en oferta. En un carrito mixto se aplica el porcentaje correspondiente a cada grupo. El beneficio debe estar disponible y el código debe corresponder a una campaña vigente y activa para esa cafetería al confirmar el pago.
- **Comisión.** El dueño de cada cafetería aprueba quién puede gestionar sus campañas y fija la comisión de cada campaña. El afiliado gana la comisión cuando el pedido que usó su código se marca como entregado. Se calcula sobre el subtotal de productos después del descuento.
- **Compra con código propio.** El afiliado puede usar su código y consumir su beneficio como cualquier cliente. Si es el comprador, la comisión de ese pedido es $0.
- **Porcentajes de campaña.** Los dos descuentos y la comisión quedan fijos desde el inicio. Si el dueño cambia alguno antes de esa fecha, se avisa a los afiliados aprobados y conservan sus códigos.
- **Redondeo.** Se redondea al peso chileno más cercano, con $0,50 hacia arriba. Se calcula y redondea el descuento sobre el subtotal de cada grupo de productos (normal y en oferta). Se restan ambos descuentos y se calcula y redondea la comisión sobre el resultado.
- **Cancelación.** Si se cancela un pedido con descuento antes de la entrega y se reembolsa por completo, el usuario recupera su beneficio para usarlo en CoffeeFast. La Wallet recibe el importe pagado y la comisión queda en $0. Las devoluciones después de la entrega quedan fuera del piloto.
- **Pausa.** Una campaña pausada deja de aplicar a nuevas compras. Puede reanudarse mientras siga vigente, con los mismos porcentajes y fecha de término. Los pedidos ya pagados conservan sus condiciones. La comisión que corresponda se genera al entregar.

## Acuerdo simulado de la Cafetería A

El dueño ficticio aprueba estas reglas, autoriza al encargado a gestionar la campaña de su cafetería y fija un descuento del 15 % sobre productos a precio normal, un 5 % sobre productos en oferta y una comisión del 10 %.

## Matriz de casos

Los ejemplos están en pesos chilenos y usan pedidos sin cargos adicionales. El carrito mixto incluye una promoción por producto.

| Caso | Decisión | Ejemplo | Tarea que usa la regla |
|---|---|---|---|
| Primer pedido con código | Si el código es válido y la campaña está activa, se aplica el descuento. La comisión se genera al entregar. | En un pedido de $10.000, el descuento es $1.500 y el usuario paga $8.500. Al entregar, el afiliado gana $850. | Aplicar el código y registrar la comisión al entregar |
| Primer pedido sin código | El usuario conserva el beneficio para una compra posterior. | Paga $10.000 y la comisión es $0. | Registrar el uso del beneficio al confirmar el pago |
| Segunda compra o posterior | El usuario puede usar un código válido si todavía tiene el beneficio. Una vez usado, el límite se aplica también en otras cafeterías. | Ana ya compró cinco veces sin código. Usa su beneficio en la Cafetería A y paga $8.500 por un pedido de $10.000. Si después pide en la Cafetería B por $10.000, paga $10.000. | Validar el uso del beneficio por usuario en todo CoffeeFast |
| Promoción vigente | Se valida el código y la campaña al confirmar el pago. Se redondea el descuento antes de calcular la comisión. | De $9.990 se descuentan $1.499 tras redondear $1.498,50. El usuario paga $8.491 y el afiliado gana $849 al entregar. | Validar vigencia y calcular importes |
| Cancelación antes de la entrega | Un reembolso total recupera el beneficio y deja la comisión en $0. | Si el usuario pagó $8.500, recibe $8.500 en su Wallet y puede volver a usar un código válido. | Cancelar, reembolsar y recuperar el beneficio |
| Pausa entre pago y entrega | Se respetan las condiciones del pedido pagado. Las compras nuevas quedan sin el descuento de la campaña mientras siga pausada. | Si el usuario ya pagó $8.500, el afiliado gana $850 al entregar. Si se cancela con reembolso total antes de entregar, gana $0. | Pausar campañas y registrar comisiones de pedidos pendientes |
| Carrito mixto | El descuento de afiliado se calcula sobre el precio normal o en oferta, según el producto. | Sobre $10.000 a precio normal y $8.000 en oferta, el ahorro adicional es $1.900. El cliente paga $16.100. | Cotizar carritos con promociones por producto |
| Compra con código propio | Se aplica el descuento y se consume el beneficio. La comisión es $0. | Diego paga $8.500 por su pedido de $10.000. Al entregar, su comisión es $0. | Calcular la comisión al entregar |

## Relación con el flujo actual

El flujo actual ya gestiona [promociones por producto y reembolsos a Wallet](base-datos/promociones-configuracion-dueno.md). La implementación deberá respetar los estados en los que el flujo permite cancelar. Los ejemplos de integración están en [C02](contratos-integracion-afiliados.md).
