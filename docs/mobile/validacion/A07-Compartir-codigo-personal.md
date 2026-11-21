# A07 · Copiar y compartir código personal

Implementación del 18 de noviembre, actualizada el 20 de noviembre de 2026.
Rama `S3-T7-Ariel-Diaz-Compartir-codigo-personal`, basada en A06 (`a9e1f1c`)
con permisos e historial corregidos. A03 y A04 ya están integradas en develop;
A06 sigue pendiente de aprobación. No se publica directamente en develop.

## Comportamiento

Perfil → Mis afiliaciones → Mis códigos. Cada tarjeta identifica cafetería,
campaña y código de C05. Las acciones también aparecen en las tarjetas del inicio.

- Copiar escribe únicamente el código de esa tarjeta mediante
  `expo-clipboard ~7.0.1`, versión indicada por Expo 52 en su manifiesto
  `bundledNativeModules.json`. Confirma «Código copiado» solo tras el éxito.
- Compartir usa `Share.share` de React Native con ese código y los IDs de
  cafetería/campaña. No inventa nombres, enlaces ni descuentos garantizados.
  El sistema operativo elige los destinos. Cancelar no anuncia un envío.
- Solo se ofrecen acciones con aprobación, código activo y consulta confirmada.
  Pendientes, rechazadas, desactivadas y estados sin confirmar no las muestran.
- Los botones tienen rol y nombre accesibles con campaña/cafetería. Durante
  una operación se bloquean los toques repetidos. Un fallo permite reintentar.
- Cambiar campaña, código, cuenta o estado descarta confirmaciones tardías.

No se envían mensajes automáticamente ni se generan códigos ni se modifica
C05. El código previamente copiado no se borra al desactivarse: el servidor
determina su validez al usarlo. En Android, la resolución de Share acredita
la apertura del selector, no la entrega del mensaje.

## Archivos

- [Acciones de código](../../../app-mobile/src/screens/afiliaciones/AccionesCodigoAfiliado.js).
- [Tarjeta de estado](../../../app-mobile/src/screens/afiliaciones/EstadoAfiliacion.js).
- [Pruebas A07](../../../app-mobile/src/screens/afiliaciones/CompartirCodigo.test.js).
- [Dependencias](../../../app-mobile/package.json), lockfile y mock de portapapeles
  en [preparación Jest](../../../app-mobile/jest.setup.js).
- Índice y estado funcional.

## Registro reproducible de componentes

Windows, Node.js 22.19.0, React Native 0.76.9 y Expo 52. Desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --runTestsByPath src/screens/afiliaciones/CompartirCodigo.test.js --testTimeout=20000
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Las tarjetas son reales; portapapeles y Share se sustituyen en Jest. Los códigos
son fixtures públicos de prueba, no datos productivos.

| Paso que produce el estado | Resultado observado |
|---|---|
| Montar Norte, cafetería 7/campaña 31 (`CF-NORTE-31`), y Sur, cafetería 8/campaña 41 (`CF-SUR-41`) | Ambas tarjetas muestran su código y acciones con contexto accesible |
| Pulsar Copiar en Sur | Escribe `CF-SUR-41`; confirma «Código copiado: CF-SUR-41» |
| Pulsar Copiar en Norte | La última escritura es `CF-NORTE-31` |
| Pulsar Compartir en Sur | Share recibe `CF-SUR-41`, campaña 41 y cafetería 8; no contiene `CF-NORTE-31` |
| Dejar copia pendiente y pulsar dos veces | Una llamada; sin confirmación anticipada y acciones bloqueadas |
| Fallar copia o apertura del selector; reintentar | Error visible; la siguiente operación puede completarse |
| Cancelar el selector | Sin error ni mensaje de envío completado |
| Mostrar pendiente, rechazada, desactivada o sin confirmación | No hay acciones de copiar/compartir |
| Cambiar a Sur durante la copia de Norte | No muestra la confirmación anterior en Sur |
| Desactivar durante una copia | Retira acciones y descarta confirmación tardía |

Pruebas específicas: **12/12 PASS**. Suite móvil: **211/211 PASS en 21 suites**,
con dos integraciones omitidas en la ejecución normal. El límite de 20 segundos
conserva la configuración de Jest y responde al timeout local de Pedidos
documentado en A01. TypeScript y exportación Android: **PASS**.
La exportación usó `EXPO_NO_DOTENV=1`, `CI=1`, URLs locales sintéticas,
clave pública ficticia y `expo export --platform android --max-workers 2`.
No construye un APK ni instala el módulo nativo en un binario existente.

## Prueba nativa en emulador · 20 de noviembre

PASS con AVD Pixel_7a, Android API 37, Expo Go 2.32.19 y SDK 52. Se inició
el emulador directamente, sin Android Studio, con 1.536 MB y dos núcleos.
Se montaron los componentes reales `EstadoAfiliacion` y `AccionesCodigoAfiliado`
en una entrada temporal con los dos fixtures de la tabla anterior. La pantalla
se identifica como «Datos controlados» y «No es una sesión de estudiante».

El entorno configurado de la app apunta a servidores locales apagados y no se
dispone de una configuración Cloud utilizable en este equipo. No se validaron
las credenciales proporcionadas ni una sesión real. No se crearon cuentas,
solicitudes o aprobaciones para obtener estas capturas.

| Paso ejecutado | Resultado nativo observado | Captura |
|---|---|---|
| Pulsar Copiar en Sur y después leer con `Clipboard.getStringAsync()` | Confirma `CF-SUR-41`; Android devuelve exactamente `CF-SUR-41` | [Copia Sur](evidencias/A07/copia-sur.png) |
| Pulsar Compartir en Sur | Se abre el selector Android con `CF-SUR-41`, campaña 41 y cafetería 8 | [Compartir Sur](evidencias/A07/compartir-sur.png) |
| Cancelar, pulsar Copiar en Norte y repetir la lectura nativa | Confirma `CF-NORTE-31`; reemplaza el texto anterior por `CF-NORTE-31` | [Copia Norte](evidencias/A07/copia-norte.png) |
| Pulsar Compartir en Norte | Selector con `CF-NORTE-31`, campaña 31 y cafetería 7; no usa el código Sur | [Compartir Norte](evidencias/A07/compartir-norte.png) |
| Cancelar el selector con Atrás | Vuelve a las tarjetas sin error ni mensaje de envío | Comprobado mediante el árbol nativo de la interfaz |

Las APIs nativas no se sustituyeron. Se usó un control de prueba adicional que
lee el portapapeles mediante `Clipboard.getStringAsync()` y muestra su resultado;
ese control no forma parte de la app. El texto nativo y las etiquetas se
comprobaron con `adb shell uiautomator dump`; las capturas son `screencap` del
emulador y no contienen datos productivos. No se eligió ningún destinatario.

La entrada original `app-mobile/index.js` se respaldó y restauró exactamente
al terminar, comprobado con `git diff --exit-code`. Se eliminaron los archivos
temporales del proyecto y se cerraron Metro y el emulador para liberar memoria.
No se añadió una ruta de demostración ni un modo de acceso sin autenticación.

## Pendiente: recorrido completo con cuenta real

La prueba nativa acredita copiar y abrir el selector desde los componentes
reales con dos campañas controladas. Falta repetir el recorrido completo de
CoffeeFast con el servidor disponible y una afiliación aprobada de la cuenta:

1. Instalar dependencias con `npm ci` desde `app-mobile`. Abrir la app con una
   sesión de estudiante y una afiliación aprobada/activa en el entorno de pruebas.
   Expo Go compatible con SDK 52 incluye el módulo; un binario propio debe
   reconstruirse para incorporar `expo-clipboard`.
2. Ir a Perfil → Mis afiliaciones → Mis códigos. Registrar campaña, cafetería
   y código de la cuenta de prueba.
3. Pulsar Copiar, capturar la confirmación y pegar en un campo local para
   comparar el texto exacto.
4. Pulsar Compartir en esa tarjeta, capturar el selector y comprobar el código
   y contexto. Cancelar sin enviar a terceros.
5. Repetir con otra campaña si está disponible. Volver al perfil y comprobar
   que conserva la sesión. No capturar datos de cuentas productivas.

No se modificaron Cloud, SQL, credenciales ni archivos `.env`.
