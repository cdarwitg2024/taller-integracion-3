# D04 · Mostrar motivos de código no aplicable

Base develop `0192fe5`, con D03 integrada. La pantalla interpreta el campo
`error` del HTTP 422 de C07. Un error de disponibilidad mantiene su aviso
separado. Los motivos desconocidos tienen un mensaje general.

## Registro de prueba

| Paso | Respuesta simulada | Resultado en el carrito |
|---|---|---|
| Aplicar un código que no corresponde a la cafetería | `codigo_invalido` | «El código no es válido para esta cafetería.» |
| Aplicar un código desactivado o de campaña pausada | `codigo_desactivado` o `campana_pausada` | «El código está inactivo o su campaña no está disponible.» |
| Aplicar con una cuenta que ya usó el beneficio | `beneficio_usado` | «Ya usaste este beneficio y no puedes aplicarlo otra vez.» |
| Corregir el código y pulsar Aplicar | Cotización válida | Desaparece el aviso y se muestra el total cotizado de $8.500. |
| Pulsar Quitar y seleccionar retiro | Cotización vigente sin código | Desaparece el aviso, el descuento vuelve a $0 y queda habilitado el pago con el total de $11.000. |

Desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/CotizacionCarrito.test.js __tests__/PagoCotizado.test.tsx
```

Las pruebas montan el carrito y simulan el transporte de C07. Para probarlo
en Android, usar un gateway local con la cotización habilitada y probar los
tres casos con datos de prueba. Sin ese flag, C07 devuelve 503.

Validación local con Node 22: 315 pruebas aprobadas, dos omitidas y
TypeScript correcto.
