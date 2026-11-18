<!-- Registro de validación del listado de campañas del dueño por cafetería (E04 / CAM-225). -->
# E04 / CAM-225 — Listado de campañas por cafetería del dueño

Rama: `S3-T4-Elias-Conectar-listado-campanas-dueno`.
Base: `origin/develop`, commit `111c892` (incluye C03 / #68).
Validación local: 17 de noviembre de 2026, Node.js 22.16.0 (CI) y 24.18.0.

## Alcance

Se ajusta la vista ya construida en [E03 / CAM-290](E03-CAM-290-Vista-Campanas.md)
para que el listado pertenezca siempre a la cafetería de `currentUser.cafeteria_id`.
No se añaden endpoints: se sigue usando
`GET /api/afiliados/cafeterias/:id/campanas/administracion` a través de
`campanasAfiliados.listar`. No se implementan C04, E07 ni E08.

Archivos modificados:

- `app-desktop/src/pages/dueno/Campanas.jsx`
- `app-desktop/src/pages/empleado/Comandas.jsx`
- `app-desktop/src/services/kdsRealtime.js`
- `app-desktop/src/services/pedidosService.js`
- `app-desktop/src/components/EscanearQrDialog.jsx`
- `app-desktop/src/components/DetallePedidoDialog.jsx`
- `app-desktop/tests/campanas.test.cjs`

Archivos nuevos:

- `app-desktop/tests/kds-cambio-cafeteria.test.cjs`
- `app-desktop/tests/kds-reintentos.test.cjs`
- este registro de validación

Quedan fuera del cambio: `AGENTS.md`, `docs_local/`, `.agents/`, `.playwright-mcp/` y `database/pendientes/`.

## Problema y corrección

El estado del listado se guardaba sin recordar a qué cafetería pertenecía. Al
cambiar de perfil, el primer render ya tenía la cafetería nueva pero todavía
mostraba las filas de la anterior; el vaciado ocurría después, en un efecto. Lo
mismo pasaba con el error y con las vistas de resumen y edición.

Ahora el estado es un único objeto `{ cafeteriaId, campanas, loading, error }`.
Los valores que consume la vista se derivan y solo se publican cuando
`cafeteriaId` coincide con la cafetería vigente del render; si no coincide se
usan lista vacía, carga activa y sin error. Así ni el primer render ni las
respuestas que llegan fuera de orden pueden mezclar datos de dos cafeterías.
El descarte por número de solicitud y el guardado ligado a la cafetería de origen
se conservan.

Al recargar la misma cafetería, las tarjetas ya visibles permanecen en pantalla
con un indicador discreto «Actualizando campañas». El indicador de carga de
página completa queda para una cafetería que aún no tiene filas cargadas.

## Registro de prueba reproducible

Desde la raíz del repositorio, con Node.js 22:

```sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
```

`app-desktop/tests/campanas.test.cjs` incorpora cinco pruebas nuevas. Cuatro
montan `Campanas` directamente; tres aplican el cambio de cafetería con
`tree.update()` fuera de `act`, de modo que se observa el render inmediato antes
de que corran los efectos (que es el primer render real tras recibir el perfil
nuevo). La cuarta comprueba la recarga de la misma cafetería y la quinta recorre
el alta con el App completo.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Cafetería 7 con filas visibles; cambiar el perfil a la 12 antes de que responda su carga | El render inmediato no muestra filas de la 7, no muestra el estado vacío y mantiene el indicador de carga con «Cafetería #12» | Aprobado |
| Resolver después la carga de la 12 | Se muestran solo las filas de la 12 | Aprobado |
| La carga de la 12 falla y la respuesta de la 7 llega después | Se mantiene el error de la 12; no aparecen filas de la 7 | Aprobado |
| Reintentar la 12 y recibir una lista vacía | Estado vacío «Aún no hay campañas», sin datos de la 7 | Aprobado |
| Resumen de una campaña de la 7; cambiar el perfil a la 12 | El render inmediato no muestra la campaña ni sus tasas; tras cargar la 12 aparece «No se encontró la campaña» | Aprobado |
| Guardar una campaña en la 12 y recargar el listado | Se consulta la 12 y no se reutilizan filas de la 7 | Aprobado |
| Recargar la cafetería 7 con filas visibles y respuesta pendiente | Las tarjetas siguen visibles y aparece «Actualizando campañas» hasta recibir el resultado | Aprobado |

Resultado final: `campanas.test.cjs` 33/33, `kds-cambio-cafeteria.test.cjs` 24/24,
`kds-reintentos.test.cjs` 2/2 y suite `app-desktop` 103/103 aprobadas. Las
pruebas del render inmediato y del resumen fallan con la implementación
anterior, por lo que acreditan la corrección. `npm run build` finaliza
correctamente con la advertencia habitual por chunks superiores a 500 kB, sin
cambios de configuración. `git diff --check` no informa problemas.

## Evidencia del cambio de contexto con solicitudes pendientes

El entregable de E04 se interpreta como la prueba funcional con dos cafeterías
y una solicitud en curso, no como una prueba de rendimiento. Los pasos usan
promesas diferidas: la petición de la cafetería A queda sin responder mientras
el perfil pasa a la B; después se resuelve A y se comprueba qué se muestra.
`node --test app-desktop/tests/kds-cambio-cafeteria.test.cjs` y
`node --test app-desktop/tests/kds-reintentos.test.cjs` reproducen cada fila.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| KDS A con comandas y detalle abierto; cambiar a B antes de que responda `getById` de A | El primer render no muestra A, cierra el detalle y descarta snapshot y eventos Realtime atrasados | Aprobado |
| Llega tarde el detalle completo de A estando ya en B | No se reabre el modal ni se publican productos de A | Aprobado |
| Fallar la precarga de impresión de A y abrir B | B no imprime la comanda de A ni hereda su chip de estado | Aprobado |
| Terminar el envío a impresión de A después de abrir B | El aviso de A no aparece en B; un UPDATE del mismo pedido sí conserva su impresión | Aprobado |
| Cambiar a B con el escáner abierto y escanear después con el gateway caído | `validarQrEntrega` recibe la cafetería vigente B, no la A | Aprobado |
| Escanear en A, cambiar a B o cerrar antes de responder el gateway con éxito | La respuesta tardía no muestra resultado ni suena | Aprobado |
| Escanear en A, cambiar a B o cerrar y que el gateway falle o rechace el QR | No se llama a `validarQrEntrega`; el pedido de A no se marca entregado ni genera su log | Aprobado |
| Cambiar de pedido o de cafetería mientras se genera el PDF de A | `guardarArchivoConUbicacion` no se llama; un UPDATE del mismo pedido sí conserva la impresión | Aprobado |
| Cerrar el canal Realtime y recibir un callback pendiente | El callback se descarta; no se publica estado tras `cerrar()` | Aprobado |
| Una inserción llega sin productos y el reintento de detalles responde | Se normaliza el pedido con los datos recuperados; si el reintento falla, se conserva la normalización previa | Aprobado |

## Corrección tras la ejecución independiente

Una ejecución independiente con Node 22 canceló `campanas.test.cjs` en la prueba
13, «respuestas invertidas de dos cafeterías no mezclan filas ni errores», con
`Promise resolution is still pending but the event loop has already resolved`.
El fallo estaba en la prueba, no en la vista: las cargas diferidas se resolvían
dentro de `act` sin esperar su microtask, de modo que la continuación del efecto
podía publicar el estado fuera del alcance de `act` y dejar la espera pendiente
según la programación de tareas del entorno.

Se añadió `completarCarga`, que entrega el resultado dentro de `act` y espera una
microtask antes de cerrar el alcance. Se usa para las resoluciones y el rechazo
de las pruebas de `montarListado` y para la resolución del perfil en la
prueba del alta. La lógica de `Campanas.jsx` no se modificó.

Verificación histórica de esa corrección puntual, anterior a las pruebas KDS:

| Comprobación | Resultado |
|---|---|
| Node 22.16.0, `npm test --prefix app-desktop` | 76/76 aprobadas, 0 canceladas |
| Node 22.0.0, `node --test tests/*.test.cjs` | 76/76 aprobadas, 0 canceladas |
| Node 22.16.0, prueba 13 aislada repetida 25 veces | 25/25 aprobadas |
| Node 24.18.0, `npm test --prefix app-desktop` | 76/76 aprobadas, 0 canceladas |
| `git diff --check` | Sin salida |

`npm run build --prefix app-desktop` ya había finalizado correctamente en la
validación original y no se repitió en esta corrección puntual.

Verificación final de la rama: `npm test --prefix app-desktop` 103/103 aprobadas
en Node 22.16.0 y en Node 24.18.0, `npm run build --prefix app-desktop` con
salida cero en ambos y `git diff --check` sin salida. La cifra 76/76 de la tabla
registra una ejecución histórica y no representa la suite final.

## Corrección tras la revisión del PR #75

Camilo Darwitg y Ariel Díaz señalaron dos fugas de contexto que las pruebas
originales no cubrían. `EscanearQrDialog` ahora lleva un contador de generación:
se incrementa al cerrar, al cambiar `cafeteriaId` o `usuarioId` y al reiniciar la
lectura; el cambio de contexto también limpia el resultado y permite reintentar
de inmediato. Cada continuación posterior al `await` comprueba que siga vigente
antes de publicar resultado, sonar o usar la cafetería del fallback. Tras el
segundo comentario de Camilo Darwitg se adelantó la comprobación antes de las dos
llamadas a `validarQrEntrega`: un gateway caído o un rechazo tardío ya no ejecuta
el fallback con la cafetería anterior, que podía marcar entregado el pedido y
escribir su log aunque la pantalla descartara el resultado. La prueba cubre las
tres respuestas del gateway —éxito, fallo y rechazo— al cerrar o cambiar de
cafetería, y verifica cero llamadas al fallback en los dos casos tardíos.

`DetallePedidoDialog` comprueba la vigencia justo después de generar el blob y
antes de llamar a `guardarArchivoConUbicacion`, e invalida las operaciones
pendientes al desmontar. La clave de vigencia sigue basada solo en el ID del
pedido, de modo que un UPDATE del mismo pedido no cancela su impresión. Dos
pruebas nuevas cubren el cambio de pedido y el cambio de cafetería con la
generación del PDF en curso.

## Límites de la evidencia

Las pruebas usan sesiones y campañas ficticias en memoria y sustituyen el
cliente del gateway; no validan JWT, políticas del servidor ni el ejecutable de
Electron con cuentas reales. No se modificaron SQL, `ms-pedidos`, Kubernetes ni
Cloud. La activación y la pausa (E07) y el ajuste de guardado (E08) siguen
pendientes. El registro de prueba exigido por el criterio 3 es este documento:
cada fila indica el paso que produce el estado y el resultado observado. No se
adjunta imagen porque la ejecución es de componentes con `react-test-renderer`;
las capturas de `.playwright-mcp/` son artefactos locales y no se versionan.
No se midió rendimiento: «prueba de carga» alude a las solicitudes pendientes
durante el cambio de contexto, no a una prueba de estrés con Fortio o k6.
