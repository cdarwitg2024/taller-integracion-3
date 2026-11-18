# A02 / CAM-267 · Pantalla Mis afiliaciones

## Alcance

A02 parte de la entrada de [A01](A01-CAM-266-Acceso-Mis-Afiliaciones.md), conservando
la sesión, el vínculo Auth y la restricción de acceso del estudiante. Agrega una
pantalla central con tres accesos: **Oportunidades**, **Mis códigos** y **Ganancias**.
Cada acceso abre una vista propia. Las pestañas permiten cambiar directamente
entre las tres; la flecha, el botón inferior y Atrás de Android regresan primero
al menú de afiliaciones y, desde él, al perfil.

La cuenta activa se identifica con el nombre del perfil. La vista se reinicia
al cambiar de cuenta y se deja de mostrar al cerrar sesión. No se crean sesiones
nuevas al navegar ni se vuelve a consultar el perfil por cada cambio de vista.

Rama: `S3-T2-Ariel-Diaz-Construir-pantalla-Mis-afiliaciones`.
Base: `c8cbe78`, A01 con la corrección de accesibilidad y la integración de D01.

Actualización del 17 de noviembre de 2026: la rama se avanzó a `origin/develop`
en `111c892` y se restauraron los cambios locales de A02. Los tres archivos de
código móvil y pruebas de A02 conservaron exactamente su contenido; los enlaces
y el estado funcional se combinaron con la documentación nueva del equipo.
Validación posterior a la actualización, en Windows con Node.js 22.19.0:
95/95 pruebas móviles en 13 suites, TypeScript, `git diff --check` y enlaces
relativos aprobados con los comandos de este registro. No se repitió la prueba
visual ni se ejecutaron pruebas nuevas del backend o escritorio en esta actualización.

## Archivos

- `app-mobile/src/screens/MisAfiliacionesScreen.js`: menú, pestañas, tres vistas,
  identificación de la cuenta y navegación interna accesible.
- `app-mobile/src/screens/PerfilScreen.js`: entrega el nombre de la cuenta y
  monta la sección con una clave por UUID de Auth.
- `app-mobile/src/screens/PerfilAfiliaciones.test.js`: ocho casos nuevos de A02,
  además de las regresiones existentes de A01.
- `docs/README.md`, `docs/estado-actual.md` y este registro: alcance y evidencia.

## Relación con C02

El [contrato C02](../../contratos-integracion-afiliados.md) define oportunidades
por cafetería (`GET /api/afiliados/cafeterias/:id/campanas?postulables=true`) y
solicitudes/códigos del usuario autenticado (`GET /api/afiliados/mi-perfil`). No
define una consulta de ganancias. Las [reglas C01](../../reglas-piloto-afiliados.md)
sitúan la comisión en la entrega del pedido y excluyen la compra con código propio.

**Esta entrega construye las vistas y la navegación.** Sus paneles explican el
contenido previsto e indican que la consulta estará disponible próximamente.
No llaman endpoints de afiliados ni muestran campañas, códigos o montos de
ejemplo como si fueran datos del usuario. Conectar listados y solicitudes requiere
las tareas de integración posteriores; consultar ganancias requiere además
definir su contrato. No se modifica C02 ni se inventa un endpoint.

La actualización de C03 incorporada el 17 de noviembre separa el listado del
dueño (`.../campanas/administracion`) del estudiantil. La ruta de oportunidades
`.../campanas?postulables=true` sigue pendiente de C04 y devuelve 501 explícito
(`listado_postulable_pendiente`) en el código actual. A02 conserva su alcance de
navegación y no sustituye esa consulta por la administrativa.

## Registro de prueba automatizada

16 de noviembre de 2026, Windows y Node.js 22.19.0. Se montan el Perfil,
Mis afiliaciones, Header, botones y pestañas reales con React Test Renderer.
Supabase se sustituye por consultas y suscripciones controladas y una sesión
ficticia. Esta evidencia no es una autenticación real ni una ejecución Android.

| Paso que produce el estado | Estado resultante comprobado | Resultado |
|---|---|---|
| Montar Perfil con estudiante vinculado y pulsar Mis afiliaciones | Se abre el menú desde la entrada de A01 | PASS |
| Pulsar Oportunidades | Encabezado Oportunidades, cuenta activa y panel de campañas | PASS |
| Volver al menú y pulsar Mis códigos | Encabezado Mis códigos y cuenta activa | PASS |
| Volver al menú y pulsar Ganancias | Encabezado Ganancias y cuenta activa | PASS |
| Cambiar por pestañas entre Mis códigos, Ganancias y Oportunidades | Cambia el encabezado y hay una sola pestaña seleccionada; conserva el objeto sesión y no agrega consultas de perfil | PASS |
| Pulsar la flecha desde cada vista y volver al perfil desde el menú | Regreso a Mis afiliaciones y luego Mi Perfil, con la misma sesión | PASS |
| Pulsar el botón inferior de Mis códigos | Vuelve al menú de Mis afiliaciones | PASS |
| Abrir Ganancias y disparar Atrás de Android dos veces | Primero Mis afiliaciones, después Mi Perfil | PASS |
| Cerrar sesión con Ganancias abierta | La sección y la cuenta anterior dejan de mostrarse | PASS |
| Cambiar de cuenta con Mis códigos abierta y entrar de nuevo | Abre el menú inicial con el nombre de la cuenta nueva | PASS |

Comandos desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Resultados: **95/95 pruebas en 13 suites aprobadas**, incluidas las 9 de A01 y
las 8 nuevas de A02. TypeScript, `git diff --check` y enlaces relativos del
documento aprobados.

Después de reforzar las aserciones de contenido de las tres vistas, una ejecución
focalizada tuvo un timeout de 20 segundos al montar el primer caso de A01 durante
el arranque del emulador; los otros 16 casos pasaron. La repetición de la suite
completa con el mismo límite aprobó los 95 casos. No se cambió la configuración
de Jest ni se amplió nuevamente el límite de espera.

## Comprobación visual con cuenta real

**APROBADA el 16 de noviembre de 2026.** Prueba visual ejecutada por el agente
con la sesión de estudiante ya iniciada por el usuario en el emulador Pixel 7a,
API 37.2 y Expo Go 2.32.19. Versión: los cambios locales A02 de la rama indicada
arriba, todavía sin commit. Se inspeccionaron las capturas de cada estado en la
conversación, sin agregar el correo ni las credenciales al repositorio.

Inicio desde PowerShell, sin modificar `.env` ni archivos de configuración:

```powershell
$env:EXPO_OFFLINE = '1'
npm.cmd run start --prefix app-mobile -- --localhost --port 8081 --max-workers 2
```

La opción offline omite las comprobaciones externas de Expo; no sustituye las
consultas de la app. Se abrió Android desde Expo y se recargó el proyecto. Se
descartó expresamente la pantalla anterior de A01 y se comenzó a contar evidencia
solo cuando aparecieron los tres accesos nuevos y la cuenta activa en A02.

| Paso ejecutado | Estado observado en Android | Resultado |
|---|---|---|
| Abrir Perfil y pulsar Mis afiliaciones | Menú con Oportunidades, Mis códigos y Ganancias, y nombre de la cuenta activa | PASS |
| Pulsar Oportunidades | Encabezado Oportunidades, panel Campañas de cafeterías y pestaña seleccionada | PASS |
| Pulsar la pestaña Mis códigos | Encabezado Mis códigos y panel Tus códigos de afiliado, conservando la cuenta | PASS |
| Pulsar la pestaña Ganancias | Encabezado Ganancias y panel Comisiones por entregas, conservando la cuenta | PASS |
| Pulsar Atrás en los controles del emulador desde Ganancias | Regresa al menú central de Mis afiliaciones | PASS |
| Abrir Mis códigos desde su tarjeta del menú | Abre directamente la vista de códigos | PASS |
| Pulsar Volver a Mis afiliaciones desde Mis códigos | Regresa al menú central | PASS |
| Abrir Ganancias desde su tarjeta del menú y pulsar la flecha del encabezado | Abre Ganancias y luego vuelve al menú central | PASS |
| Pulsar Volver al perfil desde el menú central | Regresa a Mi Perfil con la misma identidad y etiqueta Estudiante | PASS |

Este registro vincula cada estado con el paso que lo produce. La validación
visual es nueva y no reutiliza la evidencia de A01 del 15 de noviembre.

**Límites:** los paneles muestran los mensajes de consulta aún no disponible;
no se validaron respuestas reales de campañas, códigos o ganancias. Cafeterías
mostró un error de conexión antes del recorrido, que no impidió probar A02 y no
se considera resuelto. No se compró ni generaron comisiones, no se modificaron
datos Cloud y no se compiló un APK ni se ejecutaron Maestro o TalkBack. El cambio
de cuenta y el cierre de sesión se verificaron en las pruebas automatizadas,
sin cerrar ni reemplazar la sesión real del usuario durante la prueba visual.
