docker build -t cdarwitg2024/ms-cafeterias:v1.0.0 -f services/ms-cafeterias/Dockerfile services
docker build -t cdarwitg2024/ms-menus:v1.0.0 -f services/ms-menus/Dockerfile services
docker build -t cdarwitg2024/ms-inventario:v1.0.0 -f services/ms-inventario/Dockerfile services
docker build -t cdarwitg2024/ms-pedidos:v1.0.0 -f services/ms-pedidos/Dockerfile services
docker build -t cdarwitg2024/gateway:v1.0.0 -f services/gateway/Dockerfile services
