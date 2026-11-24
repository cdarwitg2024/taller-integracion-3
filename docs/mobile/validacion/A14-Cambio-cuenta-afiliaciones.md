# A14 · Verificar cambio de cuenta

23 de noviembre de 2026. Rama `S3-T14-Ariel-Diaz-Verificar-cambio-de-cuenta`.
Dependencias: A06 y A10. Base: A10 corregida (`da6fb72`) más `develop`
(`ada07de`), combinadas sin conflictos. Al iniciar A14, el PR de A10 seguía
abierto; esta rama incorpora esa dependencia y no realiza su merge en `develop`.

## Problema reproducido y corrección

`PerfilScreen` ya comprueba la identidad para abrir Mis afiliaciones y monta
esa sección con la clave del usuario Auth. Sus consultas y las de saldo,
comisiones y retiros descartan respuestas al desmontarse.

Faltaba aislar el propio perfil en App: si se sustituía A por B sin pasar por
la pantalla de inicio de sesión, React reutilizaba la instancia del perfil.
Mientras llegaba la consulta de B, seguían visibles el nombre y correo de A.
Además, una consulta pendiente del perfil A podía actualizar esa instancia
después de cargar B. La prueba reprodujo la visualización de A durante la
carga de B antes de aplicar la corrección.

[App](../../../app-mobile/App.tsx) ahora monta `PerfilScreen` con una clave
basada en `session.user.id`, con una clave distinta para invitado. Al cambiar
de cuenta se desmonta el perfil anterior, se limpian sus estados y se muestra
la carga del nuevo estudiante. Una respuesta del componente desmontado no
puede publicar datos en la nueva instancia. Renovar el token del mismo UUID
conserva el perfil y la sección abierta. No se añade navegación ni se modifican
los permisos, los contratos HTTP o SQL.

## Prueba reproducible

[CambioCuentaAfiliaciones.test.js](../../../app-mobile/__tests__/CambioCuentaAfiliaciones.test.js)
monta App, Login, Perfil, Mis afiliaciones, saldo y ambos historiales reales.
Mantiene los servicios reales de A06/A10 y el cliente HTTP que añade el token
de la sesión. Sustituye Auth, las respuestas del SDK Supabase y `fetch` por
datos controlados; el catálogo inicial se sustituye porque no interviene en
el recorrido. No sustituye las pantallas de afiliaciones por vistas de prueba.

Dos estudiantes ficticios, ambos aprobados en cafetería 7 y campaña 31:

| Dato controlado | Estudiante A | Estudiante B |
|---|---|---|
| ID interno | 901 | 902 |
| UUID Auth | `00000000-0000-4000-8000-000000000010` | `00000000-0000-4000-8000-000000000011` |
| Código personal | `CODIGO-A14-A` | `CODIGO-A14-B` |
| Comisión pendiente | $111 | $222 |
| Comisión disponible antes de retiros | $1.121 | $2.242 |
| Disponible neto V12 simulado | $1.111 | $2.222 |
| Retiro confirmado | $10 | $20 |
| Referencia del retiro | `00000000-0000-4000-8000-000000000001` | `00000000-0000-4000-8000-000000000002` |

Los importes y referencias son ficticios. Los saldos controlados descuentan
el retiro una sola vez y mantienen fuera la comisión pendiente.

Desde la raíz, con Node.js 22 y las dependencias instaladas:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000 --runTestsByPath __tests__/CambioCuentaAfiliaciones.test.js
node app-mobile/node_modules/typescript/bin/tsc --noEmit --project app-mobile/tsconfig.json
git diff --check
```

Para la suite móvil completa:

```powershell
npm.cmd test --prefix app-mobile -- --ci --runInBand --testTimeout=20000
```

## Pasos y estado resultante

| Paso que produce el estado | Resultado comprobado |
|---|---|
| Con la sesión inicial A, abrir Perfil → Mis afiliaciones → Historial | Código A, disponible $1.111, comisión del pedido 501 y comprobante A |
| Pulsar Actualizar mis solicitudes, Actualizar saldo, Actualizar retiros y Actualizar comisiones, reteniendo sus cuatro respuestas A | Las cuatro consultas quedan pendientes sin resolver ni avanzar un reloj real |
| Volver al perfil, pulsar Cerrar sesión y confirmar los dos diálogos del flujo existente | Se llama a `signOut`, aparece Login y desaparecen el nombre, código, saldo y referencia de A |
| Completar el correo y contraseña ficticios de B en Login y pulsar Iniciar sesión | Login llama al SDK; el evento `SIGNED_IN` activa B. No aparece contenido de A |
| Abrir las afiliaciones y el historial de B | Código B, disponible $2.222, comisión del pedido 502 y comprobante B; las consultas usan la cuenta B |
| Resolver las respuestas antiguas A en orden retiros → comisiones → saldo → solicitudes | Tras cada respuesta, B conserva su nombre y referencia; no reaparece ningún código, saldo, comisión o comprobante de A |
| Repetir el recorrido sustituyendo la sesión directamente por B, sin un `SIGNED_OUT` intermedio | Se borra la sección A y el historial nuevo sigue perteneciendo a B, incluso tras las cuatro respuestas tardías |
| Dejar pendiente una actualización del perfil A, cambiar a B y retener también el perfil B | Se muestra «Cargando datos del estudiante», sin nombre ni correo de A |
| Resolver el perfil B, abrir su historial y después resolver el perfil A | La pantalla sigue en el historial B; la respuesta A no lo reemplaza |
| Emitir `TOKEN_REFRESHED` con el mismo UUID de A mientras está abierto Historial | Se conserva la sección y su comprobante; no se llama a cerrar sesión |

Se prueban el cierre mediante controles reales y la sustitución directa que
también debe ser segura. El caso de identidad conserva las dos consultas
pendientes por separado y resuelve A después de haber publicado el historial B.

## Alcance de la evidencia

Es un registro automatizado de estados, no una captura de un APK. Auth y las
respuestas de red son simuladas: no acredita JWT reales, RLS, GoTrue, Cloud ni
un dispositivo. Las promesas controladas permiten invertir el orden de llegada
sin esperas reales. No se usan cuentas, contraseñas ni datos productivos; no se
ejecutan compras, retiros o migraciones. La prueba visual en emulador queda
pendiente y no es necesaria para reproducir estos cuatro casos automatizados.

## Resultados locales

Windows, Node.js 22.19.0:

- **4/4 escenarios A14 aprobados**. La regresión del perfil mostraba datos de A
  durante la carga de B antes de añadir la clave por UUID; después pasa.
- Suite móvil completa: **375 pruebas aprobadas**, dos integraciones opt-in
  omitidas y 37 suites aprobadas, con límite de 20 segundos por prueba.
- TypeScript y `git diff --check`: **PASS**.

Se usó `--watchman=false --roots src __tests__ tests` en Jest para acotar la
búsqueda local de archivos. Incluye las carpetas con todos los casos móviles;
no cambia la configuración de CI ni omite pruebas de esas carpetas. La
ejecución remota de CI corresponderá al futuro PR de A14.
