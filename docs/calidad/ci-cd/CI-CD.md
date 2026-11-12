# CI/CD de CoffeeFast

Revisado el 11 de noviembre de 2026 contra los workflows del repositorio. CI comprueba cambios antes de integrarlos. CD publica las imágenes del commit validado y despliega por digest.

La publicación y el despliegue se inician manualmente en `main` y requieren sus respectivas variables de habilitación. El estado real de esas variables y de los Environments se verifica en GitHub.

## Auditoría y conservación de la versión congelada

La auditoría inicial encontró `main` en `68bea2c1f0916472f2cc359f2bcd659059f53d51`, con `develop` y numerosas ramas `S1-*`, `S2-*` y `feature/*`. No había workflows ni instrucciones `AGENTS.md` aplicables encontradas. Se inspeccionaron referencias locales, sin sincronizar ramas.

El commit `dab27e5` incorporó la configuración inicial. El commit `433c408` añadió CI Functional, integraciones con PostgreSQL y PostgREST, comprobaciones con defectos deliberados y regresiones para pedidos y sesión móvil.

Los dos CD rechazan ejecutar el SHA congelado. Kubernetes exige también autorización escrita para reemplazar su versión en una operación futura. La rama de trabajo permite revisar e integrar la configuración sin trabajar sobre `main`; CD sigue restringido a `main`.

| Componente | Comandos utilizados | Pruebas y comprobaciones |
| --- | --- | --- |
| Mobile | `npm ci`, `npm test -- --ci --runInBand` | 68 pruebas en 11 suites en la última ejecución local. CI verifica también defectos en disponibilidad y cancelación, configuración Expo, dependencias y exportación Android. |
| Desktop | `npm ci --legacy-peer-deps`, `npm test`, `npm run build` | Siete pruebas del panel del dueño, comprobación de stock concurrente con un defecto deliberado y compilación Vite. |
| ms-cafeterias | `npm ci`; `npm test -- --ci` | Jest/Supertest: 22 pruebas de cafeterías, validaciones, errores y salud. |
| ms-menus | `npm ci`; `npm test -- --ci` | Jest/Supertest: 36 pruebas de menús, precios, filtros, contratos y errores. |
| ms-pedidos | `npm ci`; `npm test -- --ci` | Jest/Supertest: 131 pruebas de pedidos, autenticación, autorización, estados y contingencia. |
| shared | Dependencias del servicio consumidor; `npm test --prefix Microservices/shared` | Cinco pruebas de la interfaz pública, ejecutadas por cada trabajo de microservicio. |
| CI Functional | Node 22, Python 3.12 y PostgreSQL 15 aislado | Catálogo HTTP con PostgREST, pago y cancelación SQL, bot Telegram y backend legacy. Comprueba defectos deliberados en las transacciones SQL y el estado inicial de un pedido legacy. |

Todos los CI usan Node 22, coincidente con `node:22-alpine` en los Dockerfiles. Mobile declara Node >=18; desktop no declara motor propio. Los microservicios son JavaScript interpretado sin scripts `build` ni `lint`: se comprueba sintaxis con `node --check`, pruebas y construcción de sus Dockerfiles reales.

### Limitaciones y decisiones

- Mobile declara `lint: eslint .` y extiende `@react-native`, pero su lockfile no contiene `eslint` ni `@react-native/eslint-config`. Se emite advertencia: **lint no está validado**. Solución pendiente: elegir versiones compatibles, agregarlas como devDependencies, actualizar el lockfile y habilitar `npm run lint`. No se instalan paquetes arbitrarios ni se ocultan fallos con `continue-on-error`.
- Desktop usa React 18 con `react-qr-reader@3.0.0-beta-1`, que declara peers React 16/17. Se utiliza explícitamente `--legacy-peer-deps`, comprobado mediante simulación de instalación. La solución de fondo es actualizar/reemplazar ese lector y regenerar su lockfile; el flag no demuestra compatibilidad funcional completa.
- Cada servicio depende de `@coffeefaster/shared` mediante `file:../shared`. Node resuelve dependencias desde ese directorio compartido. CI crea un enlace `shared/node_modules` hacia las dependencias instaladas del servicio, evitando instalar paquetes sin lockfile en shared. Cada servicio corre en un runner distinto. Los Dockerfiles ya copian shared como directorio real dentro de `node_modules`.
- El contexto Docker correcto es **`Microservices/`**. Su `.dockerignore` excluye dependencias locales, `.env`, variantes locales, tests y otros archivos. Los Dockerfiles usan `npm install --omit=dev` y una base mutable: reconstruir un tag SHA no garantiza bytes idénticos. Por eso Kubernetes utiliza el digest de la imagen realmente publicada. Fijar base y mejorar reproducibilidad queda como mejora separada.
- El gateway es Nginx, con `Microservices/gateway/nginx.conf` y configuración en `k8s-next/gateway/`; no tiene `package.json`. Este CD no cambia gateway, ingress, Services, HPA, secretos ni réplicas.
- Deployments y contenedores tienen los mismos nombres: `ms-cafeterias`, `ms-menus`, `ms-pedidos`, namespace `student-cdarwitg`. Los manifiestos actuales usan `cdarwitg2024/ms-cafeterias:v1.0.0`, `ms-menus:v1.0.0` y `ms-pedidos:v1.0.3`, con `IfNotPresent`. `/health` comprueba HTTP, no Supabase ni RPC. `maxSurge: 0` y `maxUnavailable: 1` pueden causar interrupciones durante un rollout.
- `k8s-next/comandos-build.ps1` y `comandos-push.ps1` conservan sus tags históricos. El script de publicación no verifica origen Git; Actions no lo invoca. Para este flujo utilizar exclusivamente los workflows nuevos.
- Quedan fuera del alcance el empaquetado Electron/APK/iOS y los flujos completos contra producción. La evidencia local y las comprobaciones manuales están en [revisión de pruebas](../validacion/revision-pruebas.md).

## Workflows y activadores

| Archivo en `.github/workflows/` | Activación | Resultado |
| --- | --- | --- |
| `ci-mobile.yml` | Push a `develop`; PR abierto/actualizado/reabierto hacia `develop` o `main`; llamada reutilizable | Instala, valida Expo, prueba y exporta Android. |
| `ci-desktop.yml` | Mismos eventos | Instala, prueba y construye Vite. |
| `ci-microservices.yml` | Mismos eventos | Matriz de tres servicios: instalación, shared, Jest, sintaxis y Docker sin push. |
| `ci-functional.yml` | Mismos eventos, sin filtros de rutas | Ejecuta catálogo, Telegram, SQL y backend legacy. |
| `cd-docker.yml` | Solo **Run workflow** manual en `main` | Repite todos los CI del mismo commit; construye y publica si pasan. |
| `cd-kubernetes.yml` | Solo **Run workflow** manual en `main`, con ID de publicación y autorización | Verifica entrega, espera protección del Environment y actualiza imágenes por digest. |

Mobile, Desktop y Microservices filtran por componente. Los cambios en `package*.json` raíz, `.npmrc` raíz o `.github/**` coinciden con sus filtros. Los cambios en `Microservices/**` o `k8s-next/**` ejecutan la matriz de servicios. CD Docker llama a los cuatro CI sin filtros de rutas.

Un workflow omitido por rutas puede quedar pendiente si se exige como check obligatorio de todos los PR. Evitar exigir indiscriminadamente checks con filtros; una política global requiere un check agregador que siempre se ejecute y trate explícitamente componentes no afectados. Esta tarea no configura reglas de ramas en GitHub.

Acciones fijadas por SHA; `GITHUB_TOKEN` tiene solo `contents: read`. Kubernetes agrega `actions: read` para verificar el run y descargar su artefacto. PR usa `pull_request`, sin secretos productivos ni `pull_request_target`. Actualizar periódicamente las referencias de acciones mediante PR revisado.

## Construcción y publicación Docker

1. Lanzar manualmente `CD Docker` en `main` con publicación habilitada. `guard` rechaza otras ramas y el SHA congelado.
2. Se ejecutan los cuatro CI reutilizables sobre el mismo commit. Un fallo bloquea `publish` mediante `needs`.
3. El trabajo protegido por el Environment `dockerhub` construye **las tres** imágenes antes de autenticarse o publicar cualquiera. Usa Linux amd64: confirmar arquitectura de los nodos UCT antes del despliegue.
4. Publica `cdarwitg2024/<servicio>:sha-<SHA completo>`, nunca `latest`. Etiquetas OCI registran commit y repositorio.
5. Registra digests en `release.json`, artefacto `release-<SHA>` y resumen de ejecución. Retención solicitada: 90 días, sujeta a políticas de GitHub. Conservar artefactos e imágenes necesarios para recuperación.

Docker Hub no ofrece una transacción entre tres repositorios: un fallo de red durante push puede dejar imágenes parciales. El run queda fallido y Kubernetes **lo rechaza**. Un reintento puede reconstruir el mismo tag; el registro de entrega y despliegue usa el digest inmutable. Se recomienda proteger tags `sha-*` contra sobrescritura si la cuenta lo permite.

## Secrets, Variables y Environments pendientes

En **Settings → Environments**, configurar los siguientes entornos. Referenciarlos en YAML **no crea ni activa sus reglas de aprobación**.

| Ubicación | Nombre | Propósito |
| --- | --- | --- |
| `dockerhub`, Secret | `DOCKERHUB_USERNAME` | Cuenta con permiso de push en los tres repositorios de `cdarwitg2024`. |
| `dockerhub`, Secret | `DOCKERHUB_TOKEN` | Token con alcance mínimo necesario. |
| Variables del repositorio | `DOCKER_PUBLISH_ENABLED` | Ausente/`false` inicialmente; `true` habilita publicación manual. |
| `kubernetes-uct`, Secret | `KUBE_CONFIG_B64` | Kubeconfig completo codificado en base64, almacenado solo como Secret. Base64 no cifra. |
| `kubernetes-uct`, Variable | `KUBECTL_VERSION` | Versión exacta `v1.x.y` compatible con el API server UCT; verificar versión del clúster antes de elegirla. |
| Variables del repositorio | `K8S_DEPLOY_ENABLED` | Ausente/`false` inicialmente; `true` habilita despliegue manual tras autorización para sustituir la versión congelada. |

Restringir ambos Environments a `main`. En `kubernetes-uct` configurar **Required reviewers**, impedir autoaprobación y deshabilitar bypass administrativo cuando esté disponible; también se recomienda revisión en `dockerhub`. Verificar que aparece **Review deployments** antes de habilitar Kubernetes.

La disponibilidad de revisores obligatorios depende del plan y visibilidad del repositorio. Si no están disponibles, mantener Kubernetes deshabilitado hasta disponer de protección adecuada. El botón manual, la variable y la frase de autorización **no sustituyen revisión independiente**. No se verificaron ni modificaron protecciones reales de GitHub en esta tarea.

La identidad Kubernetes debe estar limitada a `student-cdarwitg`: lectura de Deployments, ReplicaSets y Pods para seguimiento; Events para diagnóstico; patch de los tres Deployments para imágenes. Limitar recursos mediante RBAC y verificar necesidades reales del cliente. No necesita leer/escribir Secrets. El kubeconfig se escribe en archivo temporal con permisos restrictivos, se elimina incluso ante fallo y nunca se imprime.

Confirmar conectividad del runner al API server UCT y confianza TLS. Si exige VPN/red interna, usar runner dedicado y ajustar `runs-on` antes de habilitar; no ejecutar PR no confiables en runners con secretos. Si las imágenes son privadas deben existir permisos de descarga/imagePullSecrets administrados fuera de este flujo.

### Variables de las aplicaciones

CI no necesita Supabase Cloud ni tokens Expo: mobile usa valores ficticios públicos y los tests simulan Supabase. La exportación verifica construcción, no produce una app configurada para producción. `EXPO_PUBLIC_*` y `VITE_*` terminan en el cliente: nunca usar claves de servicio allí.

Kubernetes ya referencia `coffeesecret-supabase`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y, en pedidos, `SUPABASE_PUBLISHABLE_KEY`. Pedidos usa `MS_MENUS_URL=http://ms-menus:3003`; también existen `PORT` y `NODE_ENV`. Shared contempla alternativas `SUPABASE_KEY` y `SUPABASE_ANON_KEY`. Los workflows conservan estas referencias y no gestionan ni leen esos secretos.

Mobile consume `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_API_URL`. Desktop contempla `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_BACKEND`, `VITE_CAFETERIA_ID`, `VITE_BOT_API_URL`/`VITE_TELEGRAM_WEBHOOK_URL`; su `envDir` lee desde la raíz. CI no requiere valores productivos. No subir `.env`, kubeconfigs, contraseñas o tokens.

## Habilitar y aprobar un despliegue futuro

1. Revisar los CI del PR y comprobar que los workflows manuales estén disponibles en la rama predeterminada.
2. Configurar Environments, revisores, Secrets y Variables. Resolver/aceptar limitaciones, confirmar arquitectura, conectividad, kubectl y RBAC. Mantener Kubernetes deshabilitado mientras se verifica.
3. Cuando el equipo autorice publicar, poner `DOCKER_PUBLISH_ENABLED=true`; abrir **Actions → CD Docker → Run workflow → main**, aprobar `dockerhub` si corresponde y esperar **success**.
4. Revisar resumen y artefacto `release-<SHA>`; registrar ID numérico de ejecución de su URL. No usar un run de CI aislado, fallido o de otro commit.
5. Con autorización explícita para sustituir la versión congelada, habilitar `K8S_DEPLOY_ENABLED=true`. Lanzar **CD Kubernetes** sobre el mismo commit de `main`, introducir `docker_run_id` y la frase exacta `AUTORIZO_REEMPLAZAR_VERSION_CONGELADA`.
6. `verify` exige un run completado y exitoso de `cd-docker.yml`, evento manual, rama `main`, mismo repositorio y SHA exacto. Si `main` avanzó, publicar primero el nuevo commit; este flujo no permite desplegar commits anteriores libremente.
7. El revisor examina commit, autorización, CI y manifiesto en **Review deployments** y aprueba `kubernetes-uct`. Solo entonces se accede al clúster.
8. `.github/scripts/validate-release.cjs` exige SHA exacto, exactamente tres servicios y referencias `cdarwitg2024/<servicio>@sha256:<digest>`. No ejecuta el contenido del artefacto. Se instala kubectl verificando checksum oficial.
9. Antes de modificar recursos se verifican los tres cambios con `--dry-run=server` y se registran imágenes anteriores. Después se actualizan únicamente imágenes, se esperan rollouts (180 segundos cada uno), se comparan referencias finales y se registran commit/digests. Se muestran Deployments, Pods y Events Warning incluso ante fallos, sin volcar secretos.

Los despliegues comparten un grupo de concurrencia, sin cancelación automática a mitad. Evitar cambios manuales concurrentes desde otras herramientas. Un fallo parcial puede dejar una combinación de versiones y requiere recuperación deliberada: el preflight no convierte los cambios en una transacción.

## Revisar errores y reconocer el commit desplegado

En **Actions**, abrir el run y trabajo rojo; buscar el primer paso que falló, no solo trabajos omitidos por dependencia. Instalación, pruebas, Expo, sintaxis, Docker, autenticación y rollouts hacen fallar el trabajo. No publicar manualmente para saltarse un CI fallido.

Después de un despliegue autorizado, relacionar el resumen de Kubernetes, `release.json.sha` y los digests actuales:

```sh
kubectl -n student-cdarwitg get deployments ms-cafeterias ms-menus ms-pedidos \
  -o custom-columns='NAME:.metadata.name,IMAGES:.spec.template.spec.containers[*].image,READY:.status.readyReplicas'
kubectl -n student-cdarwitg get pods -l 'app in (ms-cafeterias,ms-menus,ms-pedidos)' \
  -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[*].ready,IMAGE_ID:.status.containerStatuses[*].imageID'
```

Registrar el SHA de `main`, el run de CD Docker, los digests de `release.json`, la imagen declarada en cada Deployment y el `imageID` de sus Pods listos. Si el runtime muestra un identificador distinto del digest publicado, consultar la relación entre el manifiesto de la imagen y su plataforma antes de afirmar que coinciden. Las etiquetas OCI también registran el commit.

## Revertir un despliegue fallido

No hay rollback automático. Un operador autorizado debe revisar las tres imágenes anteriores del resumen y su compatibilidad. Ejemplo para pedidos, sustituyendo el marcador por el **digest anterior verificado**:

```sh
kubectl -n student-cdarwitg set image deployment/ms-pedidos \
  ms-pedidos=cdarwitg2024/ms-pedidos@sha256:<digest-anterior-verificado>
kubectl -n student-cdarwitg rollout status deployment/ms-pedidos --timeout=180s
```

Repetir para servicios afectados y verificar Deployments/Pods. Alternativa si se conserva una revisión conocida: consultar `kubectl -n student-cdarwitg rollout history deployment/ms-pedidos`, ejecutar `rollout undo deployment/ms-pedidos --to-revision=<revision-verificada>` y esperar `rollout status`. No asumir que la revisión inmediatamente anterior es correcta. Recuperar la versión congelada exige autorización y sus imágenes verificadas; tags mutables no garantizan contenido. No se revierten datos ni Supabase.

## Validaciones y resultados

- Auditoría inicial: **259 pruebas existentes pasaron** (58 mobile, 22 cafeterías, 36 menús, 131 pedidos, 5 shared, 7 desktop), además de build Vite y exportación Android Hermes/JS/assets. Los componentes conservan ese contenido en la nueva rama. No se crearon pruebas ficticias ni se modificó negocio. Vite avisa de bundle grande. El entorno restringido inicialmente bloqueó caché/conexiones locales; con permisos de tests locales las suites pasaron.
- `expo config --type public` pasó; `expo install --check` pasó con mapa local y aviso de modo offline. La consulta remota queda pendiente del runner. Se simuló instalación de mobile y desktop; en la auditoría inicial se usaron dependencias instaladas y Node 24.13.0 para tests/build de clientes. Los CI harán instalación limpia con Node 22.
- En esta rama se construyeron correctamente los **tres Dockerfiles reales**, contexto `Microservices/`, plataforma Linux amd64. Imágenes locales: `coffeefast-local/ms-cafeterias:ci-check`, `coffeefast-local/ms-menus:ci-check`, `coffeefast-local/ms-pedidos:ci-check`, con etiqueta OCI del commit `3d2a9fb6586591bd75890ab95865115e20ecbed6`. Ninguna fue publicada.
- Las tres imágenes arrancaron su `src/server.js` real y respondieron `/health` HTTP 200 en Node 22.23.4: se comprobó identidad del servicio, estado `healthy`, importación de shared, usuario no root y ausencia de `.env` en código de aplicación. Contenedores temporales, red externa deshabilitada, raíz de solo lectura, `/tmp` temporal y capacidades eliminadas. No se usaron secretos ni conexiones Supabase.
- También se reprodujeron en un contenedor Linux Node 22.23.4 las instalaciones limpias `npm ci` de los tres microservicios, la resolución de shared mediante el mismo enlace del workflow y todas sus pruebas: **189 pruebas de servicios pasaron**, además de las cinco de shared en cada iteración. Se usó un archivo temporal con solo código, tests y configuración versionados, sin dependencias locales ni credenciales. El contenedor se eliminó al terminar. Las instalaciones con dependencias de desarrollo reportaron vulnerabilidades adicionales a las del build productivo.
- Durante las construcciones, npm reportó **dos vulnerabilidades existentes por servicio (una moderada y una alta)**. No se ejecutó `npm audit fix` ni se cambiaron dependencias. Evaluar y corregir en una tarea separada; el build exitoso no equivale a auditoría de seguridad aprobada.
- Los cinco YAML se analizaron con parser y detección de claves duplicadas; `actionlint 1.7.7` validó expresiones, contextos, esquema y llamadas reutilizables. El validador oficial descargado se verificó contra su checksum en la primera implementación. No se ejecutó ShellCheck local.
- Se verificaron rutas/comandos reales, dependencias `needs`, ausencia de activadores automáticos de CD y guardas del SHA congelado. Se comprobó sintaxis del validador de entrega y aceptación/rechazo de manifiestos válidos/inválidos. Nuevos archivos contienen referencias a Secrets y valores ficticios; no credenciales reales. Los archivos preexistentes permanecen sin modificaciones.
- No se ejecutaron Actions en GitHub ni se verificaron protección real de Environments, versión del API server, RBAC, red del clúster, descarga en UCT o rollout. Quedan pendientes de una futura operación autorizada. El build y `/health` local no prueban integración con Supabase ni flujo completo en producción.

Referencias: [sintaxis de Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [workflows reutilizables](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), [Environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [Expo CLI](https://docs.expo.dev/more/expo-cli/).
