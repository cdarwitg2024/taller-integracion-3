# DESPLIEGUE

1. docker login
2. Build: .\k8s-next\comandos-build.ps1
3. Push: .\k8s-next\comandos-push.ps1
4. kubectl apply -f k8s-next/ms-cafeterias/
5. kubectl rollout status deployment/ms-cafeterias -n student-cdarwitg
6. kubectl apply -f k8s-next/ms-menus/
7. kubectl rollout status deployment/ms-menus -n student-cdarwitg
8. kubectl apply -f k8s-next/ms-pedidos/
9. kubectl rollout status deployment/ms-pedidos -n student-cdarwitg
10. kubectl apply -f k8s-next/gateway/   (nginx:1.27-alpine + ConfigMap gateway-nginx-config)
11. kubectl rollout status deployment/gateway -n student-cdarwitg
12. Probar pod: kubectl run curl --rm -it --image=curlimages/curl --restart=Never -- curl -s http://gateway/gateway/health (200)
13. kubectl apply -f k8s-next/ingress-api.yaml

Rollback: kubectl rollout undo deployment/<app> -n student-cdarwitg
Pods: 4 (3 servicios + gateway). CPU: 250m requests. + legacy backend-node/inventario-service si existen.
Limpieza: eliminar legacy cuando nuevos OK.
Limitaciones: stock no atomico, lectura nube, HTTPS sin cert valido, precios no salen por gateway.