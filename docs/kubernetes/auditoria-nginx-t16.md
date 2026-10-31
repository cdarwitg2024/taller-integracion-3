# T16: auditoría de configuración nginx

Revisión del estado de la rama `S2-T16-Camilodg-Corregir_y_contrastar_configuración_nginx`.
La evidencia es el repositorio; no se consultó ni modificó el cluster y no se
afirma que el estado desplegado coincida con estos manifiestos.

## Fuentes y cadena de carga

Se encontraron dos archivos `.conf` y una configuración embebida en YAML: tres
fuentes, dos configuraciones efectivas. No se encontraron otras fuentes nginx
del proyecto, ni un Dockerfile o Gateway Node propio. El Compose del bot no
contiene nginx. Las dependencias y metadatos Git no forman parte del Gateway.

| Entorno | Fuente | Cómo llega a nginx | Estado según repositorio |
| --- | --- | --- | --- |
| Local con Gateway / Compose | `Microservices/gateway/nginx.conf` | Servicio `gateway` de `Microservices/docker-compose.yml`, imagen `nginx:1.27-alpine`, bind mount de solo lectura a `/etc/nginx/conf.d/default.conf`; el archivo base de la imagen incluye ese fragmento dentro de `http` | Activo en Compose; host `${GATEWAY_PORT:-8080}` → 80 |
| Kubernetes | `k8s-next/gateway/configmap.yaml`, `data["nginx.conf"]` | Deployment `gateway` → volumen `config` → ConfigMap `gateway-nginx-config` → `subPath: nginx.conf` → `/etc/nginx/nginx.conf` | Configuración consumida por el Deployment declarado |
| Kubernetes, fuente editable | `k8s-next/gateway/nginx.conf` | Generación manual del ConfigMap documentada en `k8s-next/gateway/README.md` | No se monta directamente; coincide con la copia embebida |
| Local sin Compose | Ninguna carga independiente demostrada | No se encontró un arranque local alternativo del Gateway | Indeterminado; ejecutar microservicios Node no inicia nginx |

No hay un `.conf` identificado como histórico. El archivo fuente de Kubernetes
es una entrada de generación, no una configuración adicional cargada en runtime.
Editar solo esa fuente no actualiza el manifiesto ni el cluster.

## Contraste de rutas

En ambos entornos las rutas externas coinciden con el prefijo `location`.
No hay bloques `upstream`: Compose usa destinos literales en `proxy_pass`;
Kubernetes usa `set $up_...` y `proxy_pass $up_...$request_uri`.

| Microservicio | Ruta externa / location | Compose: host destino | Kubernetes: Service FQDN destino | Puerto en ambos | Estado |
| --- | --- | --- | --- | --- | --- |
| ms-cafeterias | `/api/cafeterias` | `ms-cafeterias` | `ms-cafeterias.student-cdarwitg.svc.cluster.local` | 3002 | Coherente |
| ms-menus | `/api/menus` | `ms-menus` | `ms-menus.student-cdarwitg.svc.cluster.local` | 3003 | Coherente, excepto bloqueo de precios |
| ms-pedidos | `/api/pedidos` | `ms-pedidos` | `ms-pedidos.student-cdarwitg.svc.cluster.local` | 3005 | Coherente |

Compose resuelve esos nombres en la red `cf-ms`; sus `environment.PORT`
coinciden con los destinos. En Kubernetes, los tres `service.yaml` declaran
ClusterIP con `port` 3002/3003/3005 y `targetPort: http`; los Deployments declaran
el puerto nombrado `http` con esos mismos números y el mismo `PORT`.

Las URI se conservan: Compose no añade una URI a `proxy_pass`; Kubernetes añade
explícitamente `$request_uri`, incluidos sus argumentos. Por ejemplo,
`/api/cafeterias/1` llega al mismo path del servicio cafeterías.

Entrada Kubernetes declarada: Ingress `api-cdarwitg-ingress`, host
`api-cdarwitg.dev.censei.cl`, prefijo `/` → Service `gateway:80` → Pod nginx:80.
El DNS de destinos es dinámico mediante `resolver 10.43.40.162 valid=5s ipv6=off`.
La disponibilidad real de ese DNS y de los Services no se verificó remotamente.

## Bloques internos y matching

- Las tres familias `/api/cafeterias`, `/api/menus` y `/api/pedidos` son
  encaminables desde el Gateway; esto no elimina la autenticación del backend.
- `location ~ ^/api/menus/precios/?$` devuelve 404 en ambos entornos para
  cualquier método, con o sin barra final. Los argumentos no evitan el match.
  La regex prevalece sobre el prefijo normal `/api/menus`: nginx selecciona
  el prefijo más largo y luego prueba las regex en orden, salvo prefijos `^~`.
  No hay `^~` que impida este bloqueo ni se utiliza la directiva `internal`.
- `ms-pedidos` llama directamente a
  `http://ms-menus:3003/api/menus/precios` en `pedidos.service.js`; no atraviesa
  el Gateway. `menus.routes.js` declara ese POST antes de `/:id`.
- `/api/pedidos/validar-qr` atraviesa el prefijo de pedidos y el backend aplica
  `auth.exigirAuth`. No es una ruta bloqueada por nginx.
- `/gateway/health` responde 200 estático. Compose usa coincidencia exacta `=`;
  Kubernetes usa prefijo y también acepta sufijos. Las probes Kubernetes usan
  la ruta exacta prevista. No se cambia esta diferencia.
- El fallback `/` devuelve 404; `/health` y `/healthz` no tienen publicación
  propia en nginx. `/api/pedidos/health` sí atraviesa el prefijo y existe como
  health público del router de pedidos.

Límites observados, fuera del cambio mínimo: los prefijos públicos no delimitan
el segmento final; la regex de precios cubre solo la ruta indicada y su barra
final, no subrutas ni variantes de mayúsculas. No se afirma protección universal
de variantes interpretadas por el backend. Compose publica los puertos de los
microservicios para depuración, por lo que es posible saltarse el Gateway
accediendo directamente a ellos. ClusterIP por sí solo tampoco restringe qué
clientes internos pueden llamar a precios. No se altera la seguridad en T16.

## Sintaxis y cambios mínimos

No se encontraron comentarios `//` inválidos en ninguna de las tres fuentes.
Las apariciones de `//` corresponden a `http://`; no se reemplazaron. nginx
utiliza `#` para comentarios. Una línea `// comentario` sería interpretada como
directivas y podría impedir el arranque.

No fue necesario modificar `.conf`, ConfigMaps ni Deployments. Se modificaron:

1. `k8s-next/gateway/README.md`: distingue fuente editable de copia consumida,
   explica los mounts y completa la descripción de `proxy_pass`.
2. `Microservices/README.md`: corrige la afirmación errónea de que gana el
   prefijo más corto y que el bloqueo depende de situarlo antes del prefijo.
3. Este informe: conserva evidencia, contraste, límites y validación de T16.

## Validación

- `nginx -t`: PASS para Compose, fuente Kubernetes y contenido extraído del
  ConfigMap. Se usó la imagen local `nginx:1.27-alpine` con `--pull=never`,
  `--rm`, `--network none`, entrypoint `nginx` y mounts de solo lectura.
  Compose recibió entradas `--add-host` a loopback para resolver sus tres
  destinos sin infraestructura; no se probaron conexiones a microservicios.
- Fuente Kubernetes y copia del ConfigMap: igualdad comprobada normalizando
  saltos de línea, indentación YAML y salto final.
- `git diff --check`: PASS. Diff revisado; cambios exclusivamente documentales.
- No se ejecutaron pruebas funcionales ni se verificó disponibilidad remota.
- No se ejecutaron `kubectl apply/delete/patch/edit`, reinicios, docker
  pull/push, commit ni push Git. Cluster no modificado.

## Criterios de aceptación

- [PASS] Archivo consumido por cada entorno declarado identificado.
- [PASS] Ausencia de comentarios `//` inválidos; no requerían corrección.
- [PASS] Rutas de ms-cafeterias contrastadas.
- [PASS] Rutas de ms-menus contrastadas.
- [PASS] Rutas de ms-pedidos contrastadas.
- [PASS] Bloques internos revisados.
- [PASS] Validación nginx -t.
- [PASS] Cluster no modificado.

## Respuestas para defensa

- **¿Qué consume Compose y cómo lo sabemos?** El archivo de
  `Microservices/gateway`, por el bind mount explícito del servicio gateway.
- **¿Qué consume Kubernetes?** La clave nginx.conf del ConfigMap, demostrada
  por `volumes.configMap`, `volumeMounts`, `mountPath` y `subPath` del Deployment.
  El `.conf` separado sirve para generar ese manifiesto.
- **¿Por qué no usar comentarios //?** nginx usa `#`; `//` fuera de una URL
  o contexto válido no inicia un comentario y puede causar error de directiva.
- **¿Cómo llegan las tres rutas?** Cada prefijo `/api/cafeterias`, `/api/menus`
  o `/api/pedidos` conserva la URI y la envía al servicio homónimo en
  3002, 3003 o 3005, respectivamente.
- **¿Qué ruta es interna y cómo se protege?** Precios comunica pedidos con
  menús directamente; una regex devuelve 404 al intentar la ruta por Gateway.
  Esa protección no cubre el acceso directo a los puertos publicados en Compose.
- **¿Qué diferencia hay entre Gateways?** Misma imagen nginx, pero Compose
  carga un fragmento en conf.d y Kubernetes una configuración completa desde
  ConfigMap con resolver y FQDN de Services. No son Gateways Node.
- **¿Cómo validamos sintaxis?** Con nginx -t real para cada configuración
  activa y comparación entre fuente y ConfigMap; no implica conectividad real.
