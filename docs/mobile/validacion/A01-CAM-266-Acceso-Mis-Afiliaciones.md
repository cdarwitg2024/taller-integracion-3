# A01 / CAM-266 · Acceso a Mis afiliaciones desde el perfil

## Cambio

Se agrega «Mis afiliaciones» al perfil existente del estudiante, después de sus
datos personales. El acceso requiere sesión, un perfil vinculado al UUID de Auth
y rol de estudiante leído desde `usuarios`. No se muestra al invitado ni a los
roles de empleado o dueño. Esta condición controla la presentación del acceso;
los endpoints futuros deberán autorizar sus operaciones en el servidor.

La sección se abre dentro de Perfil y conserva sus datos. Permite regresar con
la flecha del encabezado, «Volver al perfil» o Atrás de Android. Al cambiar de
cuenta o salir de la sesión, no conserva la sección abierta del usuario anterior.

Esta tarea incorpora el acceso. La pantalla informa que las solicitudes y códigos
estarán disponibles próximamente; no consulta afiliaciones ni simula una lista
vacía. Ver las [reglas del piloto](../../reglas-piloto-afiliados.md) y sus
[contratos de integración](../../contratos-integracion-afiliados.md).

## Registro automatizado

Entorno: Windows, Node.js 22.19.0, validación del 15 de noviembre de 2026. Pruebas en
`app-mobile/src/screens/PerfilAfiliaciones.test.js`, con el perfil, la sección y
los controles reales; se sustituyen las consultas y suscripciones de Supabase.
La identidad de las pruebas es ficticia y no representa una sesión Auth real.

| Paso que produce el estado | Estado comprobado |
|---|---|
| Montar Perfil con sesión y fila de estudiante vinculada | «Mi Perfil» y acceso «Mis afiliaciones» |
| Pulsar «Mis afiliaciones» | Encabezado «Mis afiliaciones» y pantalla de destino |
| Pulsar «Volver al perfil» | «Mi Perfil», nombre del estudiante y acceso conservados, sin nuevas consultas |
| Abrir la sección y pulsar la flecha | Regreso a «Mi Perfil» |
| Abrir la sección y disparar Atrás de Android | Regreso a «Mi Perfil» y liberación del manejador |
| Montar como invitado, empleado, dueño o perfil sin vínculo Auth | Acceso ausente |
| Cerrar sesión o cambiar de cuenta con la sección abierta | La sección anterior deja de mostrarse |

Comandos desde la raíz:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Resultados: **77/77 pruebas aprobadas en 12 suites**, incluidas las 9 pruebas
nuevas de A01. TypeScript (`tsc --noEmit`) aprobado. `git diff --check` aprobado
y enlaces relativos del documento comprobados.

La primera ejecución tuvo un error en la aserción de texto de A01, corregido
antes de repetir la suite, y un timeout de 5 segundos en una prueba existente
de Pedidos. La ejecución completa posterior pasó con un límite de 20 segundos
por prueba, sin cambiar la prueba de Pedidos ni la configuración de Jest.

Las dependencias locales estaban incompletas. Se instalaron mediante
`npm.cmd ci --prefix app-mobile --legacy-peer-deps --no-audit --no-fund`, después
de que la instalación sin esa opción quedara detenida al resolver dependencias.
No se modificaron los manifiestos ni el archivo de bloqueo.

## Comprobación manual con sesión real

**APROBADA el 15 de noviembre de 2026.** El usuario inició sesión personalmente
con su cuenta de prueba y confirmó «listo, ya entré». Después, el agente operó
los controles del emulador y observó el estado resultante mediante capturas de
pantalla en esta conversación. El perfil mostró la etiqueta «Estudiante».
No se guardan el correo ni las credenciales en este registro.

- Dispositivo: emulador Pixel 7a, imagen de sistema Android API 37.2 x86_64.
- Cliente: Expo Go 2.32.19, proyecto Expo SDK 52 / React Native 0.76.9.
- Versión de la app: código base `6f5c9d8` con los cambios locales A01 de la rama
  `codex/a01-acceso-mis-afiliaciones`, todavía sin commit al ejecutar la prueba.
- Inicio desde la raíz:

  ```powershell
  npm.cmd run start --prefix app-mobile -- --localhost --android --port 8081 --max-workers 2
  ```

| Paso ejecutado | Estado visual observado | Resultado |
|---|---|---|
| Con la sesión iniciada por el usuario, pulsar Perfil en la barra inferior | Encabezado «Mi Perfil», etiqueta «Estudiante» y entrada «Mis afiliaciones» debajo de los datos personales | PASS |
| Pulsar «Mis afiliaciones» | Encabezado «Mis afiliaciones», texto «Tu espacio de afiliaciones», aviso de disponibilidad futura y botón «Volver al perfil»; pestaña Perfil seleccionada | PASS |
| Pulsar «Volver al perfil» | Regreso a «Mi Perfil» con la misma identidad visible, etiqueta de estudiante y acceso conservados | PASS |
| Abrir nuevamente «Mis afiliaciones» y pulsar la flecha del encabezado | Regreso a «Mi Perfil» con los mismos datos visibles | PASS |
| Abrir nuevamente «Mis afiliaciones» y pulsar Atrás en los controles del emulador | Regreso a «Mi Perfil», sin ir a Cafeterías ni salir de la app | PASS |

Este registro relaciona cada estado observado con el paso que lo produjo y sirve
como evidencia de los tres criterios de A01. Las capturas se inspeccionaron en
la conversación; no se agregan imágenes con datos personales al repositorio.

**Límites:** la pantalla de Cafeterías mostró «Sin conexión con el servidor» antes
de entrar a Perfil. Esa incidencia del catálogo no impidió el recorrido de A01
y no se considera corregida ni validada por esta prueba. No se ejecutaron
compras, retiros ni operaciones de afiliación, no se crearon cuentas y no se
aplicaron cambios de esquema ni configuración en Supabase Cloud. La pantalla de
afiliaciones sigue siendo el punto de entrada para tareas posteriores.
