# Carga HTTP contra un Pod Fortio existente; ejecutar solo una medición acordada.
#
# Ejecuta `fortio load` DENTRO del Pod `fortio` que YA existe en el namespace
# (via `kubectl exec`). NO crea Pods, NO usa tokens/secretos, NO hace `kubectl
# scale` ni actualiza manifiestos. El HPA puede cambiar las réplicas por la carga.
#
# Uso:
#   pwsh ./k8s-next/comandos-fortio.ps1 -Url http://ms-menus:3003/api/menus -Qps 10 -Duration 5s -Concurrency 2
#
# Niveles sugeridos (ver docs/kubernetes/configuracion-fortio-carga.md):
#   SMOKE : -Qps 10   -Duration 5s    -Concurrency 2
#   MEDIA : -Qps 100  -Duration 30s   -Concurrency 10
#   ALTA  : -Qps 300  -Duration 120s  -Concurrency 30   (sin garantizar escalado)
#
# Endpoints publicos/read-only recomendados:
#   ms-cafeterias : http://ms-cafeterias:3002/api/cafeterias
#   ms-menus      : http://ms-menus:3003/api/menus
#   ms-pedidos    : http://ms-pedidos:3005/health   (las operaciones de negocio exigen JWT)

param(
  [string]$Url = 'http://ms-menus:3003/api/menus',
  [double]$Qps = 10,
  [string]$Duration = '5s',
  [int]$Concurrency = 2,
  [string]$Namespace = 'student-cdarwitg',
  [string]$Pod = 'fortio'
)

Write-Host "Fortio load -> $Url | qps=$Qps c=$Concurrency t=$Duration (pod $Pod/$Namespace)"

kubectl exec -n $Namespace $Pod -- fortio load -loglevel Warning -qps $Qps -c $Concurrency -t $Duration $Url
