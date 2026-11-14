<!-- Documento de validación de la vista principal de campañas del dueño (E03 / CAM-290). -->
# E03 / CAM-290 — Vista principal de campañas del dueño

Rama: `ecaranza2024/cam-290-e03-construir-vista-principal-de`.
Base: `origin/develop`, commit `6f5c9d8` (incluye V01 / #63 y C02 / #62).
Validación local: 14 de noviembre de 2026, Node.js 22.16.0.

## Alcance

Se construye la vista principal de campañas de afiliados del dueño dentro de
`app-desktop`. Reutiliza `ProtectedRoute`, `AuthenticatedLayout`, el Sidebar y
`PageHeader` existentes, y un nuevo servicio que sigue el contrato C02
(`/api/afiliados/cafeterias/:id/campanas`) a través del cliente del gateway.

Rutas añadidas bajo el contexto de Afiliados de V01:

| Ruta | Vista |
|---|---|
| `/dueno/afiliados` | Acceso desde el menú; botón «Administrar campañas» (V01) |
| `/dueno/afiliados/campanas` | Listado de campañas de la cafetería activa |
| `/dueno/afiliados/campanas/nueva` | Formulario de creación |
| `/dueno/afiliados/campanas/:id/editar` | Formulario de edición |
| `/dueno/afiliados/campanas/:id` | Resumen de la campaña |

La cafetería siempre se obtiene de `currentUser.cafeteria_id` (perfil
autorizado). La URL y sus parámetros no intervienen en la selección de
cafetería. El listado, el formulario y el resumen viven en un mismo componente
padre con rutas anidadas: al abrir el formulario el listado ya cargado no se
desmonta, y al volver se conserva la cafetería y el estado del listado sin una
nueva solicitud.

Las respuestas se descartan por número de solicitud: si el perfil cambia de
cafetería durante una carga, la respuesta atrasada de la cafetería anterior no
se publica.

## Registro de prueba reproducible

Desde la raíz del repositorio, con Node.js 22:

```sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
git diff --check
```

La suite `app-desktop/tests/campanas.test.cjs` ejecuta el App, el router, el
layout, el Sidebar, `PageHeader`, Afiliados y Campanas reales. Sustituye
únicamente los servicios externos (Supabase, perfil y campañas) y la
presentación MUI; las sesiones y campañas son datos ficticios en memoria, sin
Cloud. Una prueba carga además el servicio real de campañas y sustituye solo el
cliente autenticado del gateway para comprobar el contrato C02. No hay capturas: el estado resultante queda registrado por las
aserciones del paso que lo produce.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Dueño en Afiliados, pulsar «Administrar campañas» | Ruta `/dueno/afiliados/campanas` | Aprobado |
| Abrir el listado con perfil de cafetería 7 | Consulta a la cafetería 7 y muestra sus campañas | Aprobado |
| Añadir `?cafeteria_id=999` a la URL | Se conserva la cafetería del perfil | Aprobado |
| Listado sin campañas | Estado vacío «Aún no hay campañas» | Aprobado |
| Error de carga | Alerta con el motivo y acción «Reintentar» | Aprobado |
| Abrir el formulario y volver al listado | Ruta `/nueva` y regreso con el listado y la cafetería conservados, sin recargar | Aprobado |
| Abrir «Ver resumen» y volver | Ruta `/:id` con tasas, vigencia y estado; regreso al listado | Aprobado |
| Perfil sin cafetería válida | Aviso y ninguna consulta de campañas | Aprobado |
| Cambiar de cafetería durante una carga | Se descarta la respuesta atrasada de la cafetería anterior | Aprobado |
| Abrir directamente `/:id/editar` | Espera el listado, precarga la campaña y sus fechas en el formulario | Aprobado |
| Abrir directamente `/:id` | Espera el listado y muestra el resumen sin aviso de «no encontrada» | Aprobado |
| Servicio real con el cliente del gateway | Rutas GET/POST/PATCH del contrato C02 y validación del cuerpo de creación | Aprobado |

Resultado: 12 pruebas de E03 y 38 regresiones existentes (V01, panel y Dashboard),
50/50 aprobadas. `npm run build` finaliza correctamente con la advertencia
habitual por chunks superiores a 500 kB; no se modificó la configuración para
ocultarla.

## Límites de la evidencia

La ruta de campañas en `ms-pedidos` (C03) aún no está publicada, por lo que la
vista muestra el error informado por el gateway y permite reintentar; no se
fabricaron respuestas exitosas. Las pruebas verifican navegación, contexto y
estado del cliente. No prueban la firma del JWT, las políticas del servidor ni
el ejecutable de Electron con cuentas reales. Esta entrega no cambia SQL,
`ms-pedidos` ni configuración de Cloud. La activación y la pausa (E07) y el
ajuste de guardado (E08) corresponden a tareas posteriores.
