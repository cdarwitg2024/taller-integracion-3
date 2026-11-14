# V01 / CAM-223 — acceso Afiliados del dueño

Rama: `V01-CAM-223-Agregar_acceso_Afiliados_al_menu`.
Base: `origin/develop`, commit `bf7da62`.
Validación local: 14 de noviembre de 2026, Node.js 22.16.0.

## Alcance

Se añade Afiliados al menú del dueño, la ruta `/dueno/afiliados` y su cabecera.
Se reutilizan `ProtectedRoute`, `AuthenticatedLayout` y el Sidebar existentes.
La sección presenta `currentUser.cafeteria_id` y muestra una advertencia cuando
no es un entero positivo seguro. No usa la cafetería de parámetros de URL ni
una cafetería predeterminada. El contenido se deriva del perfil en cada render,
sin conservar una copia de su cafetería en otro estado.

El perfil actual toma la primera asignación disponible de `cafeteria_usuarios`.
V01 no incorpora un selector ni cambia ese comportamiento. La nueva pantalla
no consulta campañas, afiliados ni comisiones; los listados, formularios y
acciones corresponden a tareas posteriores. No se presenta un listado vacío
como si se hubiera consultado el servidor.

## Registro de prueba reproducible

Desde la raíz del repositorio, con Node.js 22:

```sh
npm test --prefix app-desktop
npm run build --prefix app-desktop
```

La suite `app-desktop/tests/afiliados.test.cjs` ejecuta el App, router de React,
layout, Sidebar, cabecera y pantalla Afiliados reales. Sustituye servicios
externos, presentación MUI y páginas ajenas a V01; comprueba que los imports de
iconos existen. Las sesiones y cafeterías son datos ficticios en memoria, sin Cloud.
Se declara `react-test-renderer` 18.3.1 como dependencia de desarrollo, compatible
con React 18.3.1 fijado en el lockfile.

| Paso de prueba | Resultado esperado | Resultado observado |
|---|---|---|
| Dueño en Dashboard, pulsar Afiliados | Ruta protegida, menú seleccionado y cabecera Afiliados | Aprobado |
| Abrir la ruta con perfiles de cafeterías 7, 12 y 25 | Cada perfil muestra su cafetería | Aprobado |
| Añadir `?cafeteria_id=999` a la URL | Se conserva la cafetería del perfil | Aprobado |
| Perfil sin cafetería o con ID inválido | Advertencia, sin cafetería inventada | Aprobado para siete valores inválidos |
| Empleado abre directamente `/dueno/afiliados` | Redirección a Comandas y sin opción Afiliados | Aprobado |
| Abrir sin sesión o con rol desconocido | No se muestra el contexto de Afiliados | Aprobado |
| Recuperar perfil real con cafetería 12, habiendo iniciado con la 7 en caché | El contexto pasa a la 12 | Aprobado |
| Recuperar perfil sin asignación, habiendo iniciado con la 7 en caché | Se retira el contexto anterior y aparece aviso | Aprobado |
| Cerrar sesión desde Afiliados | Vuelve a login sin menú ni contexto anterior | Aprobado |

Resultado: 17 pruebas de V01 y 21 regresiones existentes, 38/38 aprobadas.
Compilación de producción comprobada aparte de los mocks de presentación.
El build finalizó correctamente con una advertencia por chunks superiores a
500 kB; no se modificó la configuración para ocultarla.

## Límites de la evidencia

Las pruebas verifican navegación y estado del cliente. No prueban la firma de
un JWT, las políticas del servidor ni el ejecutable de Electron con cuentas
reales. Esta entrega no cambia SQL, servicios de API o configuración de Cloud.
