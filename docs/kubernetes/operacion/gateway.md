# Gateway Nginx

Revisado el 11 de noviembre de 2026 contra los manifiestos del repositorio.

- Fuente en [`k8s-next/gateway/nginx.conf`](../../../k8s-next/gateway/nginx.conf), con bloques `events` y `http` completos.
- ConfigMap: gateway-nginx-config, en student-cdarwitg.
- Deployment/Service: gateway, HTTP interno 80.
- Ingress en [`k8s-next/ingress-api.yaml`](../../../k8s-next/ingress-api.yaml), host `api-cdarwitg.dev.censei.cl`.
- El gateway enruta `/api/cafeterias`, `/api/menus`, `/api/pedidos` y `/api/afiliados`. La ruta `/api/menus/precios` responde 404 en el gateway porque es interna.
- El contenedor `ms-afiliados` comparte pod con Nginx y recibe tráfico por `127.0.0.1:3006`. Ambos comparten ciclo de despliegue y escala. Esta topología usa los cuatro Services existentes.
- Resolver actual 10.43.40.162 y nombres FQDN del namespace son específicos del clúster.
- La configuración local de Compose está en Microservices/gateway/nginx.conf: formato y resolución Docker distintos; no intercambiar ambos archivos.

Para regenerar solo el archivo local del ConfigMap, tras revisar la fuente:

~~~powershell
kubectl create configmap gateway-nginx-config -n student-cdarwitg --from-file=nginx.conf=k8s-next/gateway/nginx.conf --dry-run=client -o yaml | Set-Content -Encoding utf8 k8s-next/gateway/configmap.yaml
~~~

Este comando no aplica el ConfigMap. Publicarlo y recargar Nginx requiere un paso autorizado independiente. Comparar el contenido generado antes de aplicarlo. Ver [despliegue](DESPLIEGUE.md).
