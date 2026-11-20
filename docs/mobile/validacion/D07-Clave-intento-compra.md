# D07 · Mantener la clave del intento de compra

## Descripción de los cambios

Base: `develop` en `1f92411`, con D02 y C02 integradas. Rama:
`S3-T7-DiegoC-Mantener_clave_del_intento_de_compra`.

Cada confirmación guarda un UUID antes de enviar el pedido. Las solicitudes de
la misma cuenta con el mismo cuerpo reutilizan ese UUID mediante la cabecera
`Idempotency-Key` de [C02](../../contratos-integracion-afiliados.md). La lectura
y escritura se serializan por cuenta para que dos llamadas simultáneas no creen
claves diferentes. No se persisten JWT, contraseñas ni claves de servidor.

El cuerpo incluye cafetería, productos, cantidades, precios esperados, franja y
código aplicado. Cambiar esos datos produce otra confirmación y otra clave.
Los espacios externos del código se eliminan antes de identificar el intento.
Un error de red, timeout o resultado incierto conserva la clave; no se agregan
reintentos automáticos. Al confirmar el pedido, vaciar el carrito, retirar su
último producto, reemplazarlo por otra cafetería o cerrar sesión se reinicia el
intento de esa cuenta. Otra compra idéntica también obtiene una clave nueva.

AsyncStorage conserva el intento entre instancias de la app, siempre que se
repita el mismo cuerpo. Esto no restaura campos que el carrito no persiste: el
código aplicado sigue teniendo el alcance en memoria de D02 y la franja se
calcula al confirmar. Una franja o código diferente inicia otra confirmación.

## Archivos e interacción

- `app-mobile/src/services/intentoCompra.ts`: UUID, almacenamiento por cuenta,
  comparación del cuerpo, serialización y reinicio del intento.
- `app-mobile/src/services/crearPedidoDesdeCarrito.ts`: prepara el cuerpo de D01,
  recupera/persiste la clave y llama al cliente HTTP con ella.
- `app-mobile/src/services/backendClient.ts`: añade `Idempotency-Key` al POST
  cuando se proporciona, conservando el Bearer de la sesión y el timeout.
- `app-mobile/App.tsx`: bloqueo síncrono del doble toque con una referencia;
  libera el bloqueo al terminar o fallar la disponibilidad y reinicia el intento
  en los recorridos de otra compra/vaciado existentes.
- `app-mobile/package.json` y `package-lock.json`: `expo-crypto ~14.0.2`, compatible
  con Expo 52, para generar UUID con el generador nativo.
- `app-mobile/src/services/crearPedidoDesdeCarrito.test.ts`: transporte HTTP real
  del cliente con `fetch`, Auth, AsyncStorage y UUID controlados.
- `app-mobile/__tests__/CheckoutIntento.test.tsx`: monta App y su checkout real;
  sustituye la presentación de catálogo/menú/carrito y los límites externos.
- `app-mobile/__tests__/App.test.tsx`, `src/screens/CartScreen.test.js` y
  `src/context/CodigoCarrito.test.js`: adaptan los límites de las regresiones
  existentes a la generación asíncrona de la clave.
- `docs/README.md`, `docs/estado-actual.md` y este registro: alcance y evidencia.

## Criterios de Aceptación Verificados

Ejecución local del 20 de noviembre de 2026, Windows y Node.js 22.19.0.
Las claves siguientes son sintéticas, generadas por el doble de UUID del test:
`K1 = 00000000-0000-4000-8000-000000000001` y
`K2 = 00000000-0000-4000-8000-000000000002`.

| Paso ejecutado | Estado resultante comprobado |
|---|---|
| Invocar dos veces el checkout de App antes del siguiente render | Una consulta de disponibilidad y un POST con K1 |
| Perder la respuesta y confirmar de nuevo sin cambiar datos | Se conserva el carrito; el siguiente POST usa K1 y el mismo cuerpo |
| Agotar el timeout del transporte y reintentar | Ambos envíos usan K1 |
| Recuperar el intento desde otra instancia del módulo | AsyncStorage devuelve K1 sin generar otra clave |
| Enviar dos solicitudes simultáneas directamente desde el servicio | Ambas cabeceras usan K1; una sola generación de UUID |
| Confirmar un pedido y agregar otra vez los mismos productos desde App | El siguiente pedido usa K2 |
| Retirar el último producto y crear otro carrito idéntico | El siguiente pedido usa K2 |
| Cambiar cantidad, cafetería, precio, código o franja | Otra confirmación usa K2 |
| Cambiar de cuenta y volver a consultar la primera | Cada cuenta conserva su registro independiente |
| Retener la escritura del registro | No hay POST hasta completar la persistencia |
| Fallar la escritura o recuperar un registro dañado | No se envía el pedido |
| Fallar la disponibilidad y volver a confirmar | Se libera el bloqueo y el siguiente intento puede enviarse |

Comandos desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Resultado: **175 pruebas aprobadas en 20 suites**; una prueba de integración
existente queda omitida por ser opt-in. D07 añade 19 casos. TypeScript y formato
sin errores. Exportación Android aprobada, desde `app-mobile`, sin cargar `.env`:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
node node_modules/expo/bin/cli export --platform android --output-dir "$env:TEMP/coffeefast-d07-android"
```

## Cómo comprobar la tarea y límites

La clave no se muestra en la interfaz. Para comprobarla sin compras reales,
ejecutar las pruebas `CheckoutIntento.test.tsx` y
`crearPedidoDesdeCarrito.test.ts`: verifican las cabeceras y el estado resultante
de cada paso de la tabla. No se ejecutó una prueba visual nueva en dispositivo.

El backend vigente no interpreta todavía `Idempotency-Key`: esta entrega
acredita la gestión y el envío de la clave por Mobile, **no deduplicación de
cobros en el servidor**. No se ejecutaron compras reales ni pruebas nuevas de
JWT/RLS, Electron o servicios Cloud. La exportación verifica JavaScript y
recursos; no es una compilación APK ni una ejecución del módulo nativo.
