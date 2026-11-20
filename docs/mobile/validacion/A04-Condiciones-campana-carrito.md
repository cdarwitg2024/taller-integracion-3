# A04 · Condiciones de campaña de carrito completo

Implementación y validación local del **18 de noviembre de 2026**, Windows,
Node.js 22.19.0. Rama: `S3-T4-Ariel-Diaz-Mostrar-condiciones-campana-carrito`.
Base: A03, commit `df4fa67`, PR #78; A04 depende de su integración.

Orden de integración: primero aprobar y fusionar A03 (#78) en `develop`;
después actualizar esta rama con `develop` y fusionar A04 (#79). A04 no absorbe
ni sustituye el PR de A03. Mientras #78 siga abierto, es esperable que #79
muestre sus cambios compartidos; revisar A04 respecto de la rama de A03 permite
aislar el incremento. No se duplican los archivos ni se fusiona #79 primero.

Corrección tras la revisión de `4aa51e6`: el encabezado del beneficio especifica
«en productos a precio normal» junto a la tasa de C04. Se mantiene la nota
que remite al carrito para los productos en oferta; C04 no proporciona su tasa
y la vista no la inventa. El ejemplo y los cálculos no cambian.
Validación puntual del ajuste: `CondicionesCampana.test.js` **9/9 PASS** con
Node.js 22.19.0 y `git diff --check` aprobado. No se repitieron el runner
desechable ni la prueba visual para este cambio de texto.

## Recorrido y comportamiento

Perfil → Mis afiliaciones → Oportunidades → seleccionar cafetería →
**Ver condiciones de [campaña]**.

Las condiciones se despliegan dentro de la tarjeta existente. El botón pasa a
«Ocultar condiciones», con estado accesible `expanded`, y permite volver al
listado sin recargar ni perder la cafetería seleccionada. No se añade otra ruta
ni otra barra de navegación. Solo aparece para `tipo = carrito_completo`.
El regreso al menú de afiliaciones y al perfil conserva el comportamiento A01/A02.

Se distinguen «Beneficio de tu referido» y «Tu ganancia como afiliado». Las
tasas proceden de `tasa_descuento` y `tasa_comision` de C04, no de constantes
de demostración. La vista explica las reglas de [C01](../../reglas-piloto-afiliados.md):

- El comprador necesita su beneficio disponible: un descuento de afiliado por
  usuario en todo CoffeeFast, aunque ya haya comprado antes.
- El afiliado necesita aprobación de la cafetería y un código asignado. Ver una
  oportunidad no equivale a estar aprobado; no se afirma elegibilidad personal.
- La comisión se calcula sobre el subtotal de productos después del descuento
  y se genera al entregar el pedido.
- El uso de código propio puede consumir el beneficio, pero genera comisión $0.
- Cancelar antes de entregar con reembolso total recupera el beneficio y deja
  comisión $0. Una pausa no cambia las condiciones de pedidos ya pagados.
- El código debe corresponder a la cafetería y la campaña debe estar activa y
  vigente al pagar.

## Ejemplo explicativo

Con los porcentajes 15 % y 10 % recibidos de una campaña:

| Concepto | Importe del ejemplo |
|---|---|
| Productos a precio normal, sin cargos adicionales | $10.000 |
| Ahorro del comprador: 15 % de $10.000 | $1.500 |
| Pago del comprador después del descuento | $8.500 |
| Comisión del afiliado: 10 % de $8.500 | $850, cuando el pedido se entrega |

El ejemplo cambia con las tasas de la campaña. Con 20 % de descuento y 5 % de
comisión, el comprador ahorra $2.000, paga $8.000 y el afiliado gana $400 al
entregar. Aplica el redondeo de C01: primero el descuento y después la comisión,
al peso chileno más cercano, con $0,50 hacia arriba.

El subtotal ilustrativo es $10.000; no procede del carrito ni representa un
pedido. La vista lo identifica como ejemplo, no como cotización ni ganancia
registrada. C04 no informa otro porcentaje para productos en oferta: no se
inventa ni se aplica su tasa a un carrito mixto; se indica confirmar ese
descuento y el total final al cotizar el carrito.

Una tasa nula se muestra «No especificado» y oculta el ejemplo numérico. Cero
sí es un dato válido. Cambiar de cafetería o vencer la campaña retira sus
condiciones; actualizar la misma campaña recalcula el ejemplo con la respuesta
vigente, sin conservar importes anteriores.

## Archivos

- [OportunidadesScreen.js](../../../app-mobile/src/screens/afiliaciones/OportunidadesScreen.js):
  botón accesible, despliegue dentro de la tarjeta y limpieza al cambiar cafetería.
- [CondicionesCampana.js](../../../app-mobile/src/screens/afiliaciones/CondicionesCampana.js):
  beneficio, comisión, elegibilidad y ejemplo informativo.
- [ejemploCampanaCarrito.ts](../../../app-mobile/src/utils/ejemploCampanaCarrito.ts):
  cálculo separado del descuento y la comisión para el ejemplo de C01.
- [CondicionesCampana.test.js](../../../app-mobile/src/screens/afiliaciones/CondicionesCampana.test.js)
  y [ejemploCampanaCarrito.test.ts](../../../app-mobile/src/utils/ejemploCampanaCarrito.test.ts):
  componentes reales con respuestas controladas y cálculo con redondeo.
- [OportunidadesIntegracion.test.js](../../../app-mobile/src/screens/afiliaciones/OportunidadesIntegracion.test.js):
  amplía el recorrido real de A03 con el despliegue de condiciones.
- `docs/README.md`, `docs/estado-actual.md` y este registro.

## Registro reproducible del estado resultante

Comandos desde la raíz, con dependencias instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand CondicionesCampana.test.js ejemploCampanaCarrito.test.ts
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
node .github/scripts/test-mobile-campanas.cjs
git diff --check
```

La prueba de integración requiere Docker y la preparación descrita en el
[registro de A03](A03-Campanas-activas.md). Crea y elimina un entorno desechable
con Auth/GoTrue, JWT real, gateway nginx, servicios reales, PostgREST y PostgreSQL.
La pantalla se monta en Jest; solo se sustituye la lectura local de sesión para
entregar el JWT real y se adapta `fetch` al transporte HTTP de Node.

| Paso que produce el estado | Resultado observado |
|---|---|
| Elegir Norte y pulsar «Ver condiciones de Campaña Norte» | Dos bloques distintos para comprador y afiliado; ejemplo ahorro $1.500, pago $8.500 y comisión $850 al entregar |
| Leer las condiciones | Aprobación/código asignado, beneficio único, código propio, cancelación y vigencia explicados sin afirmar aprobación de la cuenta |
| Ocultar condiciones | Conserva campaña y selección; no realiza nuevas consultas ni operaciones |
| Cambiar a Sur con tasas 20 % / 5 % | Desaparecen las condiciones de Norte; al desplegar Sur muestra ahorro $2.000, pago $8.000 y comisión $400 |
| Actualizar la misma campaña con nuevas tasas controladas | Recalcula los importes sin conservar el ejemplo anterior |
| Recibir una tasa nula | «No especificado» y aviso de ejemplo no disponible; no inventa importes |
| Recibir tasas cero | Ejemplo con ahorro $0 y comisión $0, sin confundirlos con ausencia de datos |
| Llegar al vencimiento con las condiciones abiertas | Retira la tarjeta y las condiciones; muestra el estado vacío |
| Recibir otro tipo de campaña | No aplica las condiciones de carrito completo a ese alcance |
| Calcular el caso C01 de $9.990 con 15 % / 10 % | Descuento $1.499, pago $8.491 y comisión $849 |
| En la integración real: seleccionar Norte A03 y desplegar Activa A03 | Tasas reales de C04; ahorro $1.500, pago $8.500 y comisión $850; aprobación previa visible |
| Elegir Sur A03 sin campañas en esa integración | Estado vacío y desaparición del ejemplo de Norte |

Pruebas específicas: **16/16 PASS**. Suite móvil completa: **155/155 PASS en
18 suites**, con `--testTimeout=20000`, sin modificar la configuración de Jest.
Se conserva ese límite por el timeout local de Pedidos documentado en A01.
El caso opt-in aparece omitido en la suite normal y se ejecutó por separado:
integración con C04 y datos persistidos desechables **1/1 PASS**.

TypeScript, 86 enlaces relativos y `git diff --check`: **PASS**. Exportación
Android: **PASS**, 776 módulos y bundle Hermes, sin cargar `.env` y usando
valores públicos sintéticos. No construye un APK.

Para repetir la exportación, desde `app-mobile`:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:CI = '1'
$env:EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = 'ci-public-placeholder'
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080'
node node_modules/expo/bin/cli export --platform android --max-workers 2 --output-dir "$env:TEMP/coffeefast-a04-android"
```

La primera ejecución detectó que la extracción de texto de las pruebas añadía
espacios entre fragmentos JSX. Se unificaron las frases dinámicas en un solo
texto y las repeticiones aprobaron el ejemplo sin cambiar sus importes.

## Límites

El cálculo es informativo: no cotiza, paga ni registra comisiones. Las reglas
se presentan desde C01 y los porcentajes desde C04. No consulta el estado de
aprobación de la cuenta ni si el comprador ya consumió su beneficio; no se
simulan como aprobados o disponibles. No agrega solicitudes de afiliación.

No se modifican contratos, SQL, microservicios, `.env` ni datos Cloud. La
integración local acredita el estado de la pantalla montada con servicios reales,
no una nueva prueba visual en emulador ni un APK desplegado. Los contenedores y
datos de prueba se eliminan al finalizar.
