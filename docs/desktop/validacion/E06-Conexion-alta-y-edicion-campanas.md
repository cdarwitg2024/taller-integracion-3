<!-- Registro de validación de la conexión real de alta y edición de campañas desde escritorio (E06). -->
# E06 — Conexión de alta y edición de campañas con el gateway

Rama: `S3-T6-Elias-Conectar-alta-y-edicion-campanas`.
Base: `origin/develop`, commit `4ddbda2` (incluye E04 y E05).
Validación local: 19 de noviembre de 2026, Node.js 24.18.0 y Docker 29.9.1.

## Alcance

E05 entregó el formulario con errores por campo y dejó declarado que la conexión
real de alta y edición correspondía a E06. El servicio `campanasAfiliados.js` ya
contiene las rutas POST y PATCH del contrato C02 y el formulario ya las invoca;
E06 no cambia ese contrato ni la lógica de validación. Aporta la evidencia de que
ese recorrido funciona contra `ms-pedidos`, con JWT emitido por Auth y datos
persistidos por la RPC de C03. La activación y la pausa desde la interfaz siguen
siendo E07.

Archivos modificados:

- `.github/scripts/test-afiliados-auth-integration.cjs`
- `docs/README.md` (índice de documentación)
- `docs/estado-actual.md` (estado funcional)

Archivo nuevo: este registro.

## Comprobación

El arnés desechable de `ci-functional.yml` ya levanta PostgreSQL, Auth,
PostgREST, `ms-pedidos` y nginx reales. Se agregó un escenario que usa los
archivos reales `backendApi.js` y `campanasAfiliados.js` de `app-desktop`: se
copian a un directorio temporal sin alterar su lógica, se resuelven las
extensiones que Vite agrega y se sustituye únicamente la base del gateway por la
del contenedor. El módulo `supabase.js` del entorno de prueba devuelve el JWT
real que emitió Auth para el dueño de la cafetería 7.

El escenario encadena las tres operaciones que hace el panel:

1. `crear` con nombre, tres tasas e inicio/término ISO; comprueba que la RPC
   devuelve un id y que `listar` encuentra la campaña persistida con ese nombre.
2. `actualizar` con las tasas iniciales y un descuento normal mayor; comprueba
   que el gateway devuelve 200 y que la tasa editada quedó persistida.
3. `actualizar` con inicio y término vacíos; comprueba que la RPC conserva la
   vigencia anterior en vez de borrarla, igual que en el PATCH de E05.

## Resultado

- Integración desechable: 13 escenarios aprobados, incluidos los nuevos, con
  Auth, JWT, gateway, PostgREST, RPC y RLS reales; sin Cloud ni archivos `.env`.
- Escritorio: 106/106 pruebas aprobadas y compilación de producción correcta.
- `ms-pedidos`: 178/178 pruebas aprobadas.
- `git diff --check` sin errores.

## Límites de la evidencia

No se ejecutó Electron ni un navegador real: el formulario se cubre con las
pruebas de componentes de E05 y el servicio se cubre aquí contra servicios
reales. La copia temporal de los módulos de escritorio cambia solo las
extensiones de importación y la base del gateway; no sustituye la validación,
las rutas ni el cliente autenticado. No se aplicó SQL en Cloud ni se probó la
activación o pausa desde la interfaz, que quedan fuera de E06.
