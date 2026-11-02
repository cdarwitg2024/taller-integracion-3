# Construye las tres imágenes locales; no publica ni aplica manifiestos.
# El contexto Microservices/ incluye shared/, requerido por los Dockerfiles.
# Los tags por defecto coinciden con los Deployments de k8s-next/.
# Para otra versión, actualizar tags y manifiestos de forma coordinada.
param(
  [string]$Registry = 'cdarwitg2024',
  [string]$TagCatalogo = 'v1.0.0',
  [string]$TagPedidos = 'v1.0.3'
)

$ErrorActionPreference = 'Stop'
$contexto = Join-Path $PSScriptRoot '../Microservices'
$servicios = @(
  @{ Nombre = 'ms-cafeterias'; Tag = $TagCatalogo },
  @{ Nombre = 'ms-menus'; Tag = $TagCatalogo },
  @{ Nombre = 'ms-pedidos'; Tag = $TagPedidos }
)

foreach ($servicio in $servicios) {
  $imagen = "$Registry/$($servicio.Nombre):$($servicio.Tag)"
  $dockerfile = Join-Path $contexto "$($servicio.Nombre)/Dockerfile"
  docker build -t $imagen -f $dockerfile $contexto
  if ($LASTEXITCODE -ne 0) { throw "Falló la construcción de $imagen. No se continúa." }
}
