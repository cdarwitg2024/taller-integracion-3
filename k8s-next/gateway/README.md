Fuente editable: `k8s-next/gateway/nginx.conf` (configuración completa `events` +
`http`, resolver `10.43.40.162`, variables `set` y `proxy_pass $up_...$request_uri`).

El Deployment **consume `data["nginx.conf"]` de `gateway-nginx-config`**, definido
en `configmap.yaml`, mediante el volumen `config`, con `subPath: nginx.conf` en
`/etc/nginx/nginx.conf`. No monta el archivo fuente del repositorio directamente:
editarlo sin regenerar el ConfigMap deja la copia consumida sin actualizar.
Ambos contenidos coinciden en la revisión T16. La imagen es `nginx:1.27-alpine`;
no existe un Gateway Node ni un Dockerfile propio del Gateway.

La configuración local es distinta: `Microservices/docker-compose.yml` monta
`Microservices/gateway/nginx.conf` en `/etc/nginx/conf.d/default.conf` como solo
lectura. Es un fragmento `server`, incluido dentro del `http` de la imagen.

Auditoría de fuentes, rutas, protección y validación: [T16](../../docs/kubernetes/auditoria-nginx-t16.md).

Comando de referencia para regenerar el manifiesto local (no ejecutado en T16):
Regenerar ConfigMap: kubectl create configmap gateway-nginx-config -n student-cdarwitg --from-file=nginx.conf=k8s-next/gateway/nginx.conf --dry-run=client -o yaml > k8s-next/gateway/configmap.yaml
