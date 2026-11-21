# D07 · Mantener la clave del intento de compra

## Descripción de los cambios

Base actualizada: develop en `43fa980`, con D02 y C02 integradas.
Rama: `S3-T7-DiegoC-Mantener_clave_del_intento_de_compra`.

Cada confirmación persiste UUID y cuerpo original antes del POST, separados
por cuenta. El cliente envía `Idempotency-Key` según
[C02](../../contratos-integracion-afiliados.md). No guarda credenciales.
El cuerpo conserva cafetería, productos, cantidades, precios, código y franja.
El avance automático del reloj no cambia el intento guardado.

Una compra nueva consulta disponibilidad. Si existe un pago pendiente, App
conserva el intento y ofrece **Revisar pedidos**, sin consultar stock ni repetir
el POST: el primer pago pudo consumir la última unidad. El backend todavía no
interpreta `Idempotency-Key`; reenviar podría duplicar el cobro. Los registros
anteriores sin estado también se consideran pendientes. El servicio permite
recuperar el cuerpo original; la interfaz no lo reenvía ante un resultado incierto.

Un HTTP 401 definitivo (`ApiError`, sin resultado incierto) invalida el intento
antes de propagar el error. El carrito permanece disponible y, con la sesión
recuperada, otra confirmación genera una clave nueva y usa el JWT actual.
No se repite el POST automáticamente. Red, timeout, respuesta incompleta y otros
errores HTTP conservan el intento; no se asumen rechazos seguros para todos ellos.

El reinicio escribe un marcador persistente `{invalidado:true}`, sin depender
de un Set en memoria ni de removeItem. El checkout espera los reinicios
pendientes. Un pago confirmado espera esa escritura antes de limpiar el carrito
y anunciar éxito. Si falla, conserva el carrito y muestra un diagnóstico con
acceso a Pedidos y reinicio explícito. Reiniciar no envía pagos y advierte que
primero debe comprobarse si existe un cobro confirmado.

El vaciado se detecta desde el estado resultante, incluso con dos eliminaciones
o decrementos agrupados. Confirmar, reemplazar la cafetería y cerrar sesión
esperan el reinicio. Una compra posterior, aunque sea idéntica, recibe otra clave.

## Archivos e interacción

- `app-mobile/src/services/intentoCompra.ts`: UUID, cuerpo original, cola por
  cuenta, estado pendiente, marcador persistente y errores con diagnóstico.
- `app-mobile/src/services/crearPedidoDesdeCarrito.ts`: prepara el cuerpo,
  marca el intento pendiente antes del envío y reinicia ante rechazo explícito
  o HTTP 401 definitivo, esperando su persistencia antes de propagar el error.
- `app-mobile/src/services/backendClient.ts`: transmite la clave con sesión y timeout.
- `app-mobile/src/hooks/useCicloIntentoCompra.ts`: observa el carrito vacío,
  permite esperar el reinicio y comunica fallos de almacenamiento.
- `app-mobile/src/services/avisarErrorIntentoCompra.ts`: diagnóstico, acceso a
  Pedidos y reinicio explícito sin enviar compras.
- `app-mobile/src/services/verificarDisponibilidadCheckout.ts`: conserva la
  validación y los mensajes de disponibilidad, extraídos de App.
- `app-mobile/App.tsx`: separa compra nueva y pago incierto; bloquea doble toque
  y espera la invalidación persistente antes de completar el flujo.
- `app-mobile/src/screens/CartScreen.js`: devuelve la promesa del checkout.
- `app-mobile/package.json` y `package-lock.json`: expo-crypto compatible con
  Expo 52 para UUID nativos.
- `app-mobile/__tests__/CheckoutIntento.test.tsx` y `RecuperacionIntento.test.tsx`:
  montan App y CartScreen reales. Comparten preparación en
  `app-mobile/tests/support/checkoutPrueba.tsx`.
- `app-mobile/src/services/crearPedidoDesdeCarrito.test.ts` e
  `intentoCompraPersistencia.test.ts`: transporte, cuerpo, cuentas, concurrencia,
  persistencia y recuperación desde otra instancia del módulo.
- Las regresiones de App, CartScreen y CodigoCarrito adaptan sus dobles al
  almacenamiento asíncrono. El índice y estado funcional enlazan esta evidencia.

## Criterios de Aceptación Verificados

Ejecución local del 21 de noviembre de 2026, Windows y Node.js 22.19.0.
K1 y K2 representan UUID sintéticos distintos del doble de prueba.

| Paso ejecutado | Estado resultante comprobado |
|---|---|
| Confirmar dos veces antes del siguiente render | Una consulta de stock y un POST con K1 |
| Recibir HTTP 401, recuperar sesión y confirmar desde CartScreen | Invalida K1 sin vaciar el carrito; el segundo POST usa JWT nuevo y K2, y el pago confirmado limpia el carrito |
| Responder HTTP 401 o 500 desde el transporte del servicio | Propaga el ApiError original; solo el 401 definitivo persiste el marcador, el 500 conserva el intento pendiente |
| Perder la respuesta, avanzar de las 12:14 a las 12:16 y volver a pagar | Conserva K1 y cuerpo original; no consulta stock ni repite POST |
| Repetir con respuesta incompleta | Mismo registro pendiente; ofrece revisar Pedidos |
| Primer pago consume la última unidad, pierde su respuesta y deja stock cero | El siguiente toque ofrece revisar Pedidos; una consulta de stock y un POST en total |
| Recuperar desde otra instancia del módulo con otra franja | Devuelve K1 y cuerpo original sin otro UUID |
| Confirmar y agregar productos iguales tras cambiar la franja | Otra compra usa K2 y franja actual |
| Eliminar dos productos en el mismo act | Carrito vacío, marcador persistido y K2 al comprar otra vez |
| Decrementar dos veces la última cantidad en el mismo act | Carrito vacío, marcador y clave nueva |
| Simular fallo de removeItem, reiniciar y cargar otra instancia | No usa removeItem; el marcador permite generar K2 |
| Fallar setItem al invalidar después de un pago confirmado | Conserva carrito, muestra diagnóstico y bloquea otro POST |
| Reintentar invalidación tras fallo de escritura | Persiste marcador; deja de existir un intento pendiente |
| Corromper registro y pagar | Diagnóstico específico sin POST; ofrece revisar Pedidos o reiniciar |
| Pulsar Reiniciar intento ante registro dañado | Persiste marcador sin pagar; permite una confirmación posterior |
| Leer registro antiguo sin estado | Se considera pendiente, no una compra nueva |
| Retener o fallar escritura inicial | No hay POST hasta persistir correctamente |
| Cambiar cuenta o datos en pruebas del servicio | Registro independiente o nueva confirmación según corresponda |

Resultados: **298 pruebas aprobadas en 29 suites**, dos integraciones optativas
omitidas. Las cuatro suites de D07 suman **32 casos**. TypeScript y exportación
Android aprobados. Comandos desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Exportación desde app-mobile, sin cargar .env:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
node node_modules/expo/bin/cli export --platform android --output-dir "$env:TEMP/coffeefast-d07-android"
```

## Cómo comprobar la tarea y límites

La clave no se muestra en la interfaz. Para repetir las nuevas regresiones
sin compras reales, desde la raíz:

```powershell
npm test --prefix app-mobile -- --ci --runInBand --runTestsByPath __tests__/RecuperacionIntento.test.tsx src/services/intentoCompraPersistencia.test.ts
```

Las pruebas usan App y CartScreen reales con reloj, Auth, almacenamiento, UUID,
catálogo y transporte controlados. No acreditan deduplicación del servidor ni
recuperación automática por clave: Pedidos permite revisar el resultado.
El 401 de la regresión es una respuesta HTTP simulada mediante fetch y el JWT
nuevo es ficticio; no se ejecutó un gateway ni una renovación real de Supabase.
No se ejecutaron compras reales, pruebas visuales nuevas en dispositivo ni
operaciones Cloud. La exportación comprueba JavaScript y recursos; no es un APK
ni ejecuta el módulo nativo de UUID.
