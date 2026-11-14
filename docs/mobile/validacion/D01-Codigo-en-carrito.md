# D01 · Agregar campo de código al carrito

## Alcance y archivos

- `app-mobile/src/components/CodigoAfiliadoCarrito.js`: entrada y acciones Aplicar/Quitar; reutiliza Input, Button y Card. Editar descarta la selección anterior.
- `app-mobile/src/screens/CartScreen.js`: conserva el código seleccionado y lo entrega a `onCheckout` junto a la franja. Bloquea la edición durante el pago.
- `app-mobile/src/services/crearPedidoDesdeCarrito.ts`: construye y envía el pedido mediante `backendClient.apiPost`; elimina espacios externos y omite `codigo` vacío. Conserva productos, precios esperados, franja y timeout.
- `app-mobile/App.tsx`: conecta el checkout con ese servicio, manteniendo las verificaciones de sesión, disponibilidad y resultado de pago.
- `app-mobile/src/screens/CartScreen.test.js`: prueba la interacción del carrito hasta el cuerpo recibido por `apiPost`; simula ese límite externo, sin red ni cobros.

El contrato del campo `codigo` corresponde a [C02](../../contratos-integracion-afiliados.md). D01 incorpora la entrada y el envío: el backend vigente todavía no procesa el código ni aplica su descuento. El total conserva el cálculo existente. El código es local a la pantalla; no se persiste entre aperturas del carrito.

## Registro de prueba automatizada

Ejecución local: 14 de noviembre de 2026, Windows, Node.js 22.19.0.

| Paso ejecutado en la prueba | Estado observado |
|---|---|
| Abrir carrito con productos y seleccionar retiro | Se conserva la franja del checkout |
| Escribir `  DIEGO-PROMO1  ` y pulsar Aplicar | `Código seleccionado: DIEGO-PROMO1` |
| Pulsar Proceder al Pago | `POST /api/pedidos`, cuerpo con `codigo: "DIEGO-PROMO1"`, productos y franja |
| Editar a `CORREGIDO` | `Sin código seleccionado`; el valor anterior deja de enviarse |
| Pulsar Aplicar y proceder al pago | El cuerpo contiene `codigo: "CORREGIDO"` |
| Pulsar Quitar después de aplicar y proceder al pago | El cuerpo no contiene la propiedad `codigo` |
| Continuar con vacío, espacios, texto borrado o sin aplicar | El cuerpo no contiene la propiedad `codigo` |
| Renderizar con pago en curso | Entrada no editable y acciones bloqueadas |

Comandos desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Resultado: 11 suites y 76 pruebas aprobadas, incluidas 8 nuevas de D01. TypeScript sin errores. `git diff --check` sin errores.

## Comprobación visual en Mobile

1. Iniciar la app con `npm start --prefix app-mobile` y abrirla en Android/Expo.
2. Iniciar sesión, elegir cafetería y agregar un producto al carrito.
3. Abrir el carrito; buscar Código de afiliado debajo del aviso de preparación y antes del resumen.
4. Escribir `DIEGO-PROMO1`, pulsar Aplicar y comprobar el mensaje de selección.
5. Corregir el texto y comprobar que desaparece la selección anterior; pulsar Aplicar para seleccionar el nuevo código.
6. Pulsar Quitar y comprobar el campo vacío y el mensaje Sin código seleccionado.

Esta comprobación visual queda pendiente de ejecución en dispositivo. No hace falta confirmar una compra real para revisar el campo. La ausencia de `codigo` en el envío queda acreditada por las pruebas automatizadas anteriores.
