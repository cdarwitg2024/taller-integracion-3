Fuente: k8s-next/gateway/nginx.conf (completo events+http, resolver 10.43.40.162, set+proxy_pass con ).
Regenerar ConfigMap: kubectl create configmap gateway-nginx-config -n student-cdarwitg --from-file=nginx.conf=k8s-next/gateway/nginx.conf --dry-run=client -o yaml > k8s-next/gateway/configmap.yaml
