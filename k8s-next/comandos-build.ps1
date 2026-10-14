# Contexto de build: Microservices/ (los Dockerfiles copian shared/ de la raiz
# del contexto). El gateway no se construye: usa nginx:1.27-alpine + ConfigMap.
docker build -t cdarwitg2024/ms-cafeterias:v1.0.0 -f Microservices/ms-cafeterias/Dockerfile Microservices
docker build -t cdarwitg2024/ms-menus:v1.0.0 -f Microservices/ms-menus/Dockerfile Microservices
docker build -t cdarwitg2024/ms-pedidos:v1.0.0 -f Microservices/ms-pedidos/Dockerfile Microservices