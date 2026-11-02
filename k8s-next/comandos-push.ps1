# Publica las imágenes ya construidas. Requiere sesión y permisos en el registro.
# No construye imágenes, no actualiza Kubernetes y no verifica su origen Git.
# IfNotPresent puede reutilizar una imagen anterior con el mismo tag;
# para una publicación definitiva, coordinar tags nuevos o digests con Deployment.
param(
  [string]$Registry = 'cdarwitg2024',
  [string]$TagCatalogo = 'v1.0.0',
  [string]$TagPedidos = 'v1.0.3'
)

$ErrorActionPreference = 'Stop'
$imagenes = @(
  "$Registry/ms-cafeterias:$TagCatalogo",
  "$Registry/ms-menus:$TagCatalogo",
  "$Registry/ms-pedidos:$TagPedidos"
)

# Comprobar las tres imágenes antes de iniciar la publicación de la primera.
foreach ($imagen in $imagenes) {
  docker image inspect $imagen --format '{{.Id}}' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falta la imagen local $imagen. Ejecuta build antes de publicar." }
}
foreach ($imagen in $imagenes) {
  docker push $imagen
  if ($LASTEXITCODE -ne 0) { throw "Falló la publicación de $imagen. No se continúa." }
}
