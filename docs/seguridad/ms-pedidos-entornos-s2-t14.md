# S2-T14: identidad y version de ms-pedidos

Auditoria estatica del repositorio, 2026-10-30. No verifica recursos remotos,
Secrets, contenido del registro ni politicas efectivas de Supabase. No se
modifica funcionalidad de pedidos.

Discrepancia con el enunciado: esta rama NO contiene las correcciones S2-T9 ni
S2-T10 vistas en el chat anterior. actualizarEstado aun retorna la fila antes
de autorizar cuando coincide el estado; contingencia aun devuelve el literal.
No existen sus pruebas nuevas: la suite actual tiene 105 casos, todos aprobados.
Esto no demuestra esas garantias de seguridad. No se trasladan commits ni se
reimplementan tareas funcionales fuera de S2-T14; deben integrarse aparte antes
de considerar esta rama equivalente a la anterior.

## Diagnostico

Compose no documentaba su clave publica requerida. El manifiesto Kubernetes solo inyectaba
URL/publishable y el cliente compartido caia al rol publico sin JWT, aunque el
servicio usa operaciones de servidor. Se agrega la referencia service key al
Deployment local. La plantilla Kubernetes afirmaba incorrectamente que solo
existian URL/service key. Build/push apuntan a v1.0.0 frente al Deployment
v1.0.3. La alineacion inicial de los scripts fue revertida tras revisar el
historial: no hay evidencia suficiente para elegir una version de build/push
ni autorizar la reutilizacion de v1.0.3. El tag del Deployment no se modifica.
Las tres claves declaradas deben existir antes de un despliegue futuro;
no se modifico ni comprobo el Secret remoto.

## Matriz de entornos

| Aspecto | Local Node | Docker Compose | Kubernetes declarado |
|---|---|---|---|
| Inicio | npm start / npm run dev desde Microservices/ms-pedidos | docker compose up --build desde Microservices | Deployment/Service de k8s-next/ms-pedidos; no ejecutados |
| Puerto | PORT, fallback 3005 | Contenedor 3005; host MS_PEDIDOS_PORT default 3005; gateway GATEWAY_PORT default 8080 | Contenedor y Service 3005; gateway 80 |
| Origen | Proceso y dotenv .env del directorio actual | Microservices/.env por env_file; environment sobrescribe PORT y publishable | secretKeyRef a coffeesecret-supabase; PORT/NODE_ENV en Deployment |
| Supabase | SUPABASE_URL; plantilla usa localhost del host | SUPABASE_URL; plantilla usa host.docker.internal | SUPABASE_URL desde Secret; destino remoto no verificado |
| Publica | SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY | SUPABASE_PUBLISHABLE_KEY desde .env/interpolacion | Referencia declarada a SUPABASE_PUBLISHABLE_KEY; existencia remota no verificada |
| Servidor | SUPABASE_SERVICE_KEY | SUPABASE_SERVICE_KEY desde env_file | Referencia agregada a SUPABASE_SERVICE_KEY; existencia remota no verificada |
| JWT | Bearer directo o gateway disponible | Bearer via nginx o puerto directo | Bearer via ingress/gateway/Service |
| Imagen / tag | Ninguna; Node instalado | coffeefaster/ms-pedidos:local | cdarwitg2024/ms-pedidos:v1.0.3 |
| Runtime | Node del host; script no fija version | Dockerfile node:22-alpine | Script construye con el mismo Dockerfile; contenido remoto no verificado |
| Secretos | .env ignorado/proceso | .env ignorado, excluido del build | Secret externo; no valores en Deployment ni ConfigMap |
| Observaciones | dotenv no carga automaticamente Microservices/.env; DNS ms-menus requiere preparacion | Red cf-ms; DNS interno ms-menus | Namespace student-cdarwitg; IfNotPresent usa cache o descarga si falta |

Local Node tiene una limitacion existente: crearPedido llama a la URL fija
http://ms-menus:3003/api/menus/precios. Fuera de Compose/K8s debe resolverse ese
nombre y estar disponible el servicio. No se agrega otra variable ni se cambia
arquitectura en esta tarea. Las plantillas no se cargan automaticamente.

## Identidad y clientes

Recorrido: cliente -> Authorization Bearer -> gateway nginx -> auth.exigirAuth
(Microservices/shared/src/auth.js) -> auth.getUser(token) -> req.user y
req.accessToken -> controller -> service. El gateway conserva los headers y
no sustituye Authorization ni valida el JWT por el servicio.

crearClienteAutenticado crea un cliente por solicitud con clave publica y
Authorization del usuario, sin service key. cancelarPedido construye un cliente
equivalente. Se desactivan persistencia/refresco de sesion.

| Operacion | Cliente | Autorizacion visible |
|---|---|---|
| Todas las rutas de negocio: autenticacion | Compartido para auth.getUser(token) | JWT recibido validado; la clave del cliente no reemplaza la identidad |
| POST /api/pedidos | JWT | Identidad interna desde auth_user_id, validacion entrada; RPC procesar_pago con identidad del estudiante |
| GET /api/pedidos | JWT | Estudiante solo lo propio; empleado sus cafeterias; otros 403; campos publicos y limite |
| PATCH estado cancelado | JWT | RPC cancelar_pedido valida propiedad/estado con auth.uid(); no UPDATE directo |
| GET /:id | Servidor | Estudiante propietario o empleado asociado; otros 404; campos publicos |
| GET /cafeteria/:cafeteriaId | Servidor | Empleado asociado; otros 403; campos publicos |
| GET /usuario/:usuarioId | Servidor | Estudiante consultando su propio ID interno; campos publicos |
| PATCH otros estados | Servidor | Empleado de cafeteria real antes de UPDATE; matriz y entrega QR. Falla existente: estado identico retorna fila completa ANTES de autorizar; S2-T9 ausente |
| GET /:id/qr | Servidor | Estudiante propietario; activos; terminales/sin QR 409; solo qr_token |
| GET /:id/token-contingencia | Servidor | Propietario o asociado a cafeteria; consulta omite credencial y retorna fallback literal; no valida terminales. S2-T10 ausente |
| POST /validar-qr | Servidor | JWT exigido por ruta; RPC log_qr_validation con p_qr_token, sin propagar JWT |
| Cotizacion a ms-menus | HTTP interno sin JWT | POST /api/menus/precios bloqueado en gateway; precios de BD; timeout 3000 ms |
| GET /health y /api/pedidos/health | Sin Supabase | Salud de proceso, no verifica configuracion ni permisos |

El cliente servidor cacheado vive en Microservices/shared/src/supabase.js:
SUPABASE_SERVICE_KEY -> SUPABASE_PUBLISHABLE_KEY -> SUPABASE_KEY ->
SUPABASE_ANON_KEY. Los fallbacks publicos permiten crearlo pero NO conceden
privilegios ni identidad del usuario. Se usa para resolver identidad interna,
asociaciones y operaciones cuya autorizacion implementa Node; no depende de
los permisos RLS del usuario final. Las lecturas previas para autorizar no
deben confundirse con permiso para devolver datos o escribir.

Limite observado: validarQr solo tiene autenticacion visible en Node. No se
puede asegurar autorizacion por cafeteria/rol desde este codigo; depende de
la implementacion y permisos de log_qr_validation. No se inventan garantias
ni se modifica esa funcionalidad en S2-T14. La service key por si sola NO
demuestra que la RPC sea segura; debe auditarse aparte.

## Variables: solo nombres, sin valores secretos

| Variable | Local | Compose | Kubernetes | Proposito |
|---|---|---|---|---|
| SUPABASE_URL | .env/proceso | env_file | Secret | Proyecto Supabase |
| SUPABASE_SERVICE_KEY | .env/proceso | env_file | Secret | Cliente servidor |
| SUPABASE_PUBLISHABLE_KEY | .env/proceso | env_file/interpolacion | Secret | Cliente JWT y fallback shared |
| SUPABASE_ANON_KEY | Alternativa publica | Alternativa por env_file | No inyectada | Fallback cliente JWT |
| SUPABASE_KEY | Compatibilidad shared | Si se proporciona | No inyectada | Fallback shared; no satisface cliente JWT |
| PORT | Opcional | environment | env | Puerto Node |
| NODE_ENV | .env/proceso | Dockerfile production o env_file | env production | Entorno |
| MS_PEDIDOS_PORT | No consumida por Node | Interpolacion | No usada | Puerto publicado host |
| GATEWAY_PORT | No consumida por Node | Interpolacion | No usada | Puerto gateway host |

El conjunto operativo requiere URL + service key + publishable (o anon para
el cliente JWT). SUPABASE_SERVICE_ROLE_KEY no es consumida por este flujo.

### Necesidad de aplicacion, plantilla y Secret remoto

1. **Necesidad de aplicacion:** pedidos.service.js:14-28 obtiene exclusivamente
   SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY para crearClienteAutenticado;
   sin ambas responde 503. crearPedido y listarPedidos lo utilizan; cancelarPedido
   (desde linea 144) crea otro cliente con la misma seleccion y JWT del usuario.
   Una service key sola NO satisface esos caminos. El Deployment no inyecta
   SUPABASE_ANON_KEY, por eso en esta configuracion se requiere publishable.
2. **Cliente servidor:** shared/src/supabase.js:24-44 prioriza
   SUPABASE_SERVICE_KEY y crea el cliente sin Authorization del usuario.
   actualizarEstado lo obtiene y ejecuta UPDATE; las lecturas individuales y
   helpers consultan usuarios/asociaciones con el mismo cliente. Para conservar
   el comportamiento privilegiado previsto se requiere service key. No es una
   condicion estricta de arranque: el codigo admite fallbacks publicos, pero
   estos no conceden privilegios ni garantizan que esas operaciones pasen RLS.
   No se ha demostrado que las politicas remotas permitan operar sin service key.
3. **Existencia declarada:** docs/secrets/supabase-secret.example.yaml contiene
   placeholders para URL, service key y publishable. deployment.yaml referencia
   las tres mediante secretKeyRef; eso expresa requisitos, no provisiona claves.
4. **Existencia REAL:** desconocida. No se inspecciono el Secret remoto.
   Antes de cualquier futuro despliegue debe comprobarse, sin exponer valores,
   que coffeesecret-supabase contiene las tres claves requeridas y que corresponden
   al proyecto previsto. Una clave inexistente en secretKeyRef (no opcional)
   puede impedir iniciar el Pod con CreateContainerConfigError. La plantilla
   y un /health local exitoso NO demuestran que el Secret remoto este completo.

## RLS

RLS no fue deshabilitado como parte de S2-T14. No se modifican politicas SQL.
Los clientes JWT preservan identidad para RLS y auth.uid() en las RPC; el SQL
determina sus permisos efectivos, incluido SECURITY DEFINER cuando corresponda.
Service_role omite RLS y exige autorizacion de negocio en Node o en una RPC
verificada. Estar detras del gateway no concede autorizacion.

## Referencias de imagenes

| Archivo | Referencia | Proposito | Estado |
|---|---|---|---|
| Microservices/docker-compose.yml | coffeefaster/ms-pedidos:local | Build local Compose | Conservada, coherente |
| Microservices/ms-pedidos/Dockerfile | node:22-alpine | Base; contexto Microservices | Conservada; no fija tag de salida |
| k8s-next/ms-pedidos/deployment.yaml | cdarwitg2024/ms-pedidos:v1.0.3 | Objetivo declarado K8s | Conservado |
| k8s-next/comandos-build.ps1 | cdarwitg2024/ms-pedidos:v1.0.0 | Construccion para registro | Restaurado al original; discrepa del Deployment; no ejecutado |
| k8s-next/comandos-push.ps1 | cdarwitg2024/ms-pedidos:v1.0.0 | Publicacion manual | Restaurado al original; discrepa del Deployment; NO ejecutado |
| k8s-next/DESPLIEGUE.md | Indirecta a los scripts | Procedimiento operacional | Hereda discrepancia; no certifica version de publicacion |
| Microservices/README.md | Compose con build | Desarrollo local | Usa :local |
| README.md | k8s-next vigente; k8s legacy | Procedimiento general | No fija otra imagen de pedidos |

La busqueda global no encontro otra referencia directa activa a imagen/tag
de ms-pedidos. Los informes historicos de salud/replicas no certifican registro.
package.json y /health declaran 1.0.0, metadata distinta del tag Docker; no se
actualizan sin evidencia de politica de versionado. No hay digest/commit que
demuestre que v1.0.3 publicado contenga este checkout o S2-T9/S2-T10.
IfNotPresent NO evita ErrImagePull si falta la imagen local y remota. La
coincidencia textual de tags no basta para decidir una version ni demuestra
contenido publicado o ejecutado.

### Evidencia historica y decision de no cambiar tags

- `36349a7` (2026-10-05): scripts build/push introducidos con v1.0.0;
  Deployment tambien paso a cdarwitg2024/ms-pedidos:v1.0.0.
- `dbf980e` (2026-10-14): build adapto rutas/contexto a Microservices y conservo
  v1.0.0; push tambien conservo ese tag.
- `f4b226d` (2026-10-20, validacion de flujo bajo congestion): cambio el
  Deployment de v1.0.0 a v1.0.3, sin actualizar build/push. Esto prueba la
  seleccion historica del manifiesto, no una instruccion para reconstruir o
  sobrescribir hoy ese tag con un checkout diferente.
- `git tag --list` no devolvio tags locales. No se encontro workflow de release
  ni una politica explicita de SemVer, tags mutables/inmutables o relacion
  commit/digest en los archivos operacionales revisados.
- No puede concluirse que reutilizar v1.0.3 respete la estrategia de versionado;
  tampoco que el v1.0.0 original sea correcto para una futura publicacion.
  Ambos scripts se restauran exactamente a HEAD, sin ejecutar ninguno.
  La discrepancia queda pendiente de una decision de version/release con
  evidencia; no se modifica el Deployment ni se inventa una nueva version.

Validacion de esta revision: historial local y diffs inspeccionados; scripts
comparados byte a byte con HEAD; git diff --check. No se repite la suite porque
esta revision solo restaura scripts y corrige documentacion/comentarios. La
ejecucion previa de esta rama aprobo 105 pruebas; no certifica recursos remotos.

## Defensa

JWT identifica al usuario; service_role al backend privilegiado. Pagos,
cancelacion e historial conservan identidad; las operaciones de servidor
requieren controles Node porque omiten RLS. Entre entornos cambia inyeccion y
empaquetado, no las reglas del servicio: Node local, Compose :local, K8s v1.0.3.
Comparar Deployment/build/push revela una discrepancia, no determina el tag
correcto para reconstruir/publicar. Verificar una politica de release y un
digest publicado seria una tarea posterior. Esta auditoria se valida localmente
con archivos y pruebas mockeadas, sin desplegar ni consultar recursos remotos.
