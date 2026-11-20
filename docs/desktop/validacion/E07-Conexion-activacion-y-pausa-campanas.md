<!-- Registro de validación de la conexión real de activación y pausa de campañas desde escritorio (E07). -->
# E07 — Conexión de activación y pausa de campañas

Rama: `S3-T7-Elias-Conectar-activacion-y-pausa`.
Base: `origin/develop`, commit `09e4846` (incluye el merge de E06 / PR #84).
Validación local: 20 de noviembre de 2026, Node.js 24.18.0 y Docker 29.9.1.

## Alcance

E06 acreditó el alta y la edición, pero la interfaz aún no podía pausar ni
reactivar una campaña. E07 agrega esa acción al listado y al resumen usando el
mismo PATCH del contrato C02, con un cuerpo exclusivo `{ pausada }` para no
sobrescribir nombre, tasas ni vigencia. La decisión de qué botones mostrar se
toma con `estado_db` y con la aceptación vigente (`confirmada_por_dueno` y
`version_confirmada = version_condiciones`), para no ofrecer acciones que la
RPC rechazaría: solo `activa`/`aceptada` se pueden pausar, solo `pausada` se
puede activar, y una campaña finalizada o sin aceptar no admite ninguna. Así una
campaña heredada sin aceptación no queda atrapada en `pausada`, porque la RPC
no podría reactivarla.

Archivos modificados:

- `app-desktop/src/pages/dueno/Campanas.jsx`
- `app-desktop/src/services/campanasAfiliados.js`
- `app-desktop/tests/campanas.test.cjs`
- `.github/scripts/test-afiliados-auth-integration.cjs`
- `docs/README.md` (índice de documentación)
- `docs/estado-actual.md` (estado funcional)

Archivo nuevo: este registro.

## Comprobación

Las pruebas de componentes cubren el contrato del servicio, el recorrido
pausar → activar con recarga del listado, la acción disponible según
`estado_db`, el botón del resumen y el error con reintento.

El arnés desechable de `ci-functional.yml` ya levanta PostgreSQL, Auth,
PostgREST, `ms-pedidos` y nginx reales. Se agregó un escenario que usa los
archivos reales `backendApi.js` y `campanasAfiliados.js` del escritorio, con el
JWT que Auth emitió para el dueño de la cafetería 7. La copia temporal solo
resuelve extensiones ESM y sustituye la base del gateway; ambos cambios están
protegidos por `assert`. El escenario encadena:

1. `crear` con inicio futuro y `confirmar_condiciones_campana` por RPC real.
   Como C02 exige inicio futuro al dar de alta y la aceptación exige campaña
   vigente, se anticipa la vigencia solo en la base desechable, antes de
   aceptar, para que quede `activa` y sea candidata móvil; ningún usuario puede
   hacerlo por la API.
2. `cambiarEstado(..., true)`, comprobando `estado`/`estado_db` `pausada` en la
   respuesta, en `listar` y en la fila persistida de `public.campanas`.
3. `cambiarEstado(..., false)`, comprobando que vuelve a `activa` y que `listar`
   devuelve el estado nuevo.

## Resultado

- Integración desechable: 14 escenarios aprobados, incluido el nuevo, con Auth,
  JWT, gateway, PostgREST, RPC y RLS reales; sin Cloud ni archivos `.env`.
- Escritorio: 113/113 pruebas aprobadas y compilación de producción correcta.
- `git diff --check` sin errores.

Tras la revisión de cdarwitg2024 en el PR #89 se separó el error de la operación
del error de carga: si falla Pausar o Activar, el aviso y las tarjetas ya
cargadas se muestran juntos, tanto en el listado como en el resumen. Las pruebas
verifican ese estado antes de reintentar y que el aviso desaparece después.

## Límites de la evidencia

No se ejecutó Electron ni un navegador real: la interfaz se cubre con pruebas de
componentes y el servicio se cubre aquí contra servicios reales. Este arnés no
carga la migración 0024 de C04, por lo que no consulta la RPC
`listar_oportunidades_campana`; comprueba el estado que esa RPC filtra. La
exclusión efectiva de campañas pausadas de las oportunidades móviles ya está
acreditada con esa migración oficial en el registro de A03. Se intentó repetir
ese registrador (`test-mobile-campanas.cjs`) en esta sesión, pero falló con
`fetch failed` al descargar la migración fijada por SHA: sin red no hay nueva
evidencia móvil. No se aplicó SQL en Cloud ni se publicaron campañas reales.
