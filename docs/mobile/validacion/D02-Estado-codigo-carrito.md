# D02 · Conectar estado del código al carrito

## Descripción de los cambios

Base: `develop` en `111c892`, con D01 y C02 integradas. Rama:
`S3-T02-DiegoC-Conectar_estado_del_Codigo_al_Carrito`.

El código seleccionado vive en el contexto del carrito, no en la pantalla. Se
conserva al navegar y al modificar productos de la misma cafetería. Se limpia al
vaciar el carrito, retirar su último producto o reemplazarlo por otra cafetería.
El borrador del campo también se reinicia al crear otro carrito.

La cafetería se deriva de los productos del carrito activo. Visitar el menú de
otra cafetería sin reemplazar el carrito no cambia su pertenencia ni su código.
El cambio real usa la confirmación existente «Vaciar y agregar».

Cada cambio de productos o código invalida la cotización e incrementa una
revisión. `guardarCotizacion(resultado, revision)` solo acepta resultados de la
revisión vigente; la revisión debe capturarse antes de iniciar la consulta.
Volver a la cafetería anterior tampoco permite recuperar una respuesta antigua.

No se cambia el envío del checkout de D01 ni se implementa el endpoint de
[cotización de C02](../../contratos-integracion-afiliados.md). El estado de
cotización se comprueba con respuestas controladas del formato de C02. El total
visible mantiene el cálculo existente; esta entrega no valida códigos ni aplica
descuentos. Código y cotización permanecen en memoria durante la apertura de la
app; AsyncStorage conserva únicamente los productos, como antes.

## Archivos e interacción

- `app-mobile/src/context/estadoCodigoCarrito.js`: reglas de pertenencia,
  limpieza e invalidación atómica de código/cotización junto con los productos.
- `app-mobile/src/context/CartContext.js`: expone ese estado y sus acciones;
  conserva hidratación, actualizadores funcionales y persistencia del carrito.
- `app-mobile/App.tsx`: entrega código, acción de edición e identidad del
  carrito a la pantalla existente.
- `app-mobile/src/screens/CartScreen.js`: recibe el código compartido y usa la
  identidad del carrito para reiniciar el campo de D01.
- `app-mobile/src/context/CodigoCarrito.test.js`: monta contexto, pantalla y
  campo reales; comprueba cambios de carrito, navegación y respuestas tardías.
- `app-mobile/src/screens/CartScreen.test.js`: adapta las regresiones de D01 al
  código controlado por props.
- `docs/README.md`, `docs/estado-actual.md` y este registro: alcance y evidencia.

## Criterios de Aceptación Verificados

Pruebas locales del 17 de noviembre de 2026 en Windows, Node.js 22.19.0.
Sin servicios externos, compras ni cambios de datos en Supabase.

| Paso ejecutado en la prueba | Estado resultante comprobado |
|---|---|
| Carrito de cafetería 7, aplicar `NORTE`, guardar cotización y salir/volver | Se conservan cafetería 7, código y cotización |
| Reemplazar por productos de cafetería 12 | Código vacío, entrada vacía y cotización `null` |
| Seleccionar retiro y continuar desde cafetería 12 | El cuerpo de `/api/pedidos` usa cafetería 12 y omite `codigo` |
| Escribir un borrador sin aplicar y cambiar de cafetería | El borrador desaparece |
| Cambiar 7 → 12 → 7 y recibir una cotización de la primera revisión | Código vacío; respuesta tardía descartada |
| Vaciar y agregar a la misma cafetería en una sola actualización de React | Nueva identidad de carrito, código vacío y cotización `null` |
| Cambiar cantidades en la misma cafetería | Conserva código, invalida cotización y descarta su respuesta pendiente |
| Editar o quitar el código | Invalida cotización y descarta la respuesta anterior |
| Retirar el último producto | Carrito vacío, sin cafetería, código ni cotización |

Comandos desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Resultado: **96 pruebas aprobadas en 14 suites**, incluidas 9 nuevas de D02.
TypeScript y formato sin errores. Exportación Android aprobada con Metro,
sin cargar `.env`, desde `app-mobile`:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
node node_modules/expo/bin/cli export --platform android --output-dir "$env:TEMP/coffeefast-d02-android"
```

La exportación comprueba el empaquetado JavaScript y recursos, no un APK ni una
ejecución en dispositivo. Los resultados de A02 revisados por separado
no se cuentan: A02 todavía no está en esta base de `develop`.

## Cómo comprobarlo en Mobile

1. Agregar un producto de la cafetería A, abrir el carrito, escribir un código y
   pulsar Aplicar. Salir al listado y volver al carrito: conserva la selección.
2. Abrir el menú de la cafetería B y agregar un producto. Confirmar «Vaciar y
   agregar». Abrir el carrito: campo vacío y «Sin código seleccionado».
3. Volver a crear un carrito de A: el código anterior no debe reaparecer.
4. Para comprobar otro carrito de la misma cafetería, aplicar un código, retirar
   todos los productos y agregar uno nuevo: debe aparecer sin código.

La revisión visual en dispositivo está pendiente. La cotización aún no tiene
una consulta ni representación propia en la app: su invalidación se acredita
mediante el registro automatizado anterior, no mediante una captura de un descuento.
