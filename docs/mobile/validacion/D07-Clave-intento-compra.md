# D07 · Mantener la clave del intento de compra

## Descripción de los cambios

Base: `develop` en `1f92411`, con D02 y C02 integradas. Rama:
`S3-T7-DiegoC-Mantener_clave_del_intento_de_compra`.

Cada confirmación guarda un UUID y el cuerpo original antes de enviar el pedido.
Los reintentos de la misma cuenta y compra reutilizan ese UUID mediante la cabecera
`Idempotency-Key` de [C02](../../contratos-integracion-afiliados.md). La lectura
y escritura se serializan por cuenta para que dos llamadas simultáneas no creen
claves diferentes. No se persisten JWT, contraseñas ni claves de servidor.

El cuerpo incluye cafetería, productos, cantidades, precios esperados, franja y
código aplicado. Cambiar cafetería, productos, cantidades, precios o código
produce otra confirmación y otra clave. La franja se calcula automáticamente:
su cambio por el reloj no inicia otra compra. Se recuperan y envían la clave y
el cuerpo original completos, incluida la franja, para evitar que el reintento
se convierta en otra solicitud o mezcle una clave antigua con datos nuevos.
Los espacios externos del código se eliminan antes de identificar el intento.
Un error de red, timeout o resultado incierto conserva la clave; no se agregan
reintentos automáticos. Al confirmar el pedido, vaciar el carrito, retirar su
último producto, reemplazarlo por otra cafetería o cerrar sesión se reinicia el
intento de esa cuenta. Otra compra idéntica también obtiene una clave nueva.

AsyncStorage conserva el intento entre instancias de la app, incluida su franja
original. La firma almacenada ya contiene el cuerpo JSON completo, por lo que
se recuperan también los registros creados antes de esta corrección. El código
aplicado sigue teniendo el alcance en memoria de D02; cambiarlo inicia otra
confirmación.

## Archivos e interacción

- `app-mobile/src/services/intentoCompra.ts`: UUID, almacenamiento por cuenta,
  comparación de la compra, recuperación del cuerpo original y reinicio del intento.
- `app-mobile/src/services/crearPedidoDesdeCarrito.ts`: prepara el cuerpo de D01,
  recupera/persiste el intento y llama al cliente HTTP con su clave y cuerpo originales.
- `app-mobile/src/services/backendClient.ts`: añade `Idempotency-Key` al POST
  cuando se proporciona, conservando el Bearer de la sesión y el timeout.
- `app-mobile/App.tsx`: bloqueo síncrono del doble toque con una referencia;
  libera el bloqueo al terminar o fallar la disponibilidad y reinicia el intento
  en los recorridos de otra compra/vaciado existentes.
- `app-mobile/package.json` y `package-lock.json`: `expo-crypto ~14.0.2`, compatible
  con Expo 52, para generar UUID con el generador nativo.
- `app-mobile/src/services/crearPedidoDesdeCarrito.test.ts`: transporte HTTP real
  del cliente con `fetch`, Auth, AsyncStorage y UUID controlados.
- `app-mobile/__tests__/CheckoutIntento.test.tsx`: monta App, CartScreen y el
  reloj del carrito reales; sustituye catálogo/menú y los límites externos.
- `app-mobile/src/screens/CartScreen.js`: devuelve la promesa del checkout para
  esperar el resultado desde las pruebas de la pantalla.
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
| Recuperar el intento desde otra instancia del módulo con la franja actual cambiada | AsyncStorage devuelve K1 y el cuerpo original sin generar otra clave |
| Enviar dos solicitudes simultáneas directamente desde el servicio | Ambas cabeceras usan K1; una sola generación de UUID |
| Confirmar un pedido y agregar otra vez los mismos productos desde App tras cambiar la franja | El siguiente pedido usa K2 y la franja actual |
| Retirar el último producto y crear otro carrito idéntico | El siguiente pedido usa K2 |
| Cambiar cantidad, cafetería, precio o código | Otra confirmación usa K2 |
| Pantalla real: perder la respuesta a las 12:14, avanzar a las 12:16 y volver a pagar | La pantalla actualiza su franja a 12:15–12:30, pero el POST conserva K1 y el cuerpo original con 12:00–12:15 |
| Repetir el recorrido anterior con respuesta HTTP incompleta | Conserva K1 y el mismo cuerpo original |
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

Resultado: **177 pruebas aprobadas en 20 suites**; una prueba de integración
existente queda omitida por ser opt-in. D07 añade 21 casos. TypeScript y formato
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

## Corrección tras la revisión

La revisión detectó que comparar todo el cuerpo incluía la franja automática.
Se reprodujo antes de corregirlo con App y CartScreen reales y el reloj fijo:
en los dos casos de respuesta perdida/incompleta, el segundo envío generaba K2.
Tras corregirlo, ambas regresiones conservan K1 y la igualdad exacta de los
cuerpos enviados. También se mantiene la prueba de otra compra confirmada que
sí recibe K2 y una franja nueva. No se crea una franja nueva para un intento
pendiente; su aceptación o repetición corresponde al backend de C02.

El backend vigente no interpreta todavía `Idempotency-Key`: esta entrega
acredita la gestión y el envío de la clave por Mobile, **no deduplicación de
cobros en el servidor**. No se ejecutaron compras reales ni pruebas nuevas de
JWT/RLS, Electron o servicios Cloud. La exportación verifica JavaScript y
recursos; no es una compilación APK ni una ejecución del módulo nativo.
