<!-- Registro de validación de la aprobación de afiliados y la gestión de códigos desde el panel del dueño (E10). -->
# E10 — Aprobar afiliados y gestionar códigos desde la cafetería

Rama: `S3-T10-Elias-Aprobar-afiliados-y-gestionar-codigos`.
Base: `origin/develop`, commit `1f92411` (incluye E04, V05 y C05).
Validación local: 20 de noviembre de 2026, Node.js 24.18.0.

## Alcance

La vista `/dueno/afiliados` ya mostraba el contexto de la cafetería asignada al
perfil del dueño (V01). E10 conecta esa pantalla con el contrato C05 para listar
las solicitudes de cada campaña y resolverlas. El panel permite elegir campaña,
ver la comisión vigente, filtrar por estado, aprobar, rechazar y desactivar
códigos, y reintentar cuando falla una carga. Las aprobaciones pueden proponer un
código; si se deja vacío, la RPC V05 lo genera.

Las dependencias E04, V05 y C05 ya estaban mergeadas en `develop`, así que no se
rehicieron. No se implementó `reenviar-aviso`: el endpoint no existe en el código
actual y no está en los criterios de E10. La pertenencia a la cafetería se valida
en SQL, no en el cliente.

Archivos modificados:

- `app-desktop/src/pages/dueno/Afiliados.jsx` (vista de solicitudes y decisiones)
- `app-desktop/src/services/campanasAfiliados.js` (listado paginado y PATCH C05)
- `app-desktop/tests/afiliados.test.cjs` (pruebas de vista y servicio)
- `docs/README.md` (índice de documentación)
- `docs/estado-actual.md` (estado funcional)

Archivo nuevo: este registro.

## Decisiones

- El filtro por estado es local: el GET de C05 solo admite `?antes_de` y rechaza
  cualquier otro parámetro con `400 parametros_no_admitidos`.
- El listado sigue `siguiente_antes_de` hasta agotarse y valida que el cursor sea
  un entero positivo decreciente; una respuesta mal formada se reporta como error.
- El PATCH envía `decision` y solo incluye `codigo` al aprobar y cuando el dueño
  escribió un valor. Los errores `codigo_en_uso` y `sin_acceso_cafeteria` se
  traducen a mensajes del panel en el listado de campañas, en el listado de
  solicitudes y en la resolución.
- Las solicitudes solo se consultan cuando la campaña pertenece al contexto de
  campañas vigente; al cambiar de cafetería se espera a cargar sus campañas antes
  de pedir solicitudes, sin consultar una campaña de la cafetería anterior.
- Cada carga lleva el identificador de la petición y el contexto de cafetería y
  campaña; las respuestas que llegan después de un cambio se descartan.
- Cambiar de campaña o de cafetería limpia la decisión pendiente y evita aplicar
  una resolución sobre un contexto distinto.

## Comprobación

Comandos ejecutados desde la raíz del repositorio:

~~~powershell
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
~~~

Resultados:

- Escritorio: 129/129 pruebas aprobadas tras integrar E07; incluye dieciséis escenarios nuevos de
  carga por campaña, filtro local, aprobación con código en uso, rechazo,
  desactivación, descarte de respuesta atrasada, cambio de cafetería, reintentos,
  paginación, cuerpos PATCH, errores C05 y respuestas tardías de decisión,
  incluido el regreso a la campaña inicial con un PATCH anterior todavía pendiente.
- Compilación de producción: correcta, código de salida 0.
- `git diff --check`: sin errores.

## Límites de la evidencia

No se ejecutó Electron ni un navegador real: la interfaz se cubre con pruebas de
componentes. El servicio se ejerce con el cliente del gateway sustituido por
respuestas en memoria; la integración HTTP contra `ms-pedidos`, Auth, RPC y RLS
corresponde al arnés desechable de C05 y no se repitió aquí. No se aplicó SQL en
Cloud, no se publicó nada y no se abrió PR. Si el destino no tiene las
migraciones externas 0020/0021/0023/0024, las RPC de C05 responden `503` y el
panel muestra ese error con opción de reintento.
