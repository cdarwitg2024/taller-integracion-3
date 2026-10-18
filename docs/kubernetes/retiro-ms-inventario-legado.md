# Retiro de ms-inventario legado

> Tarea: limpieza controlada de `ms-inventario`
> Fecha: 2026-10-16
> Rama: `S2-T5-Camilodg-Configurar_Horizontal_Pod_Autoscaler`
> Autorizado: eliminar recursos K8s y archivos **exclusivos** de `ms-inventario`

## 1. Objetivo

Retirar **completamente** `ms-inventario` (microservicio **legado**) del
despliegue actual de CoffeeFast, tanto del clúster Kubernetes como del
repositorio, **sin** afectar a los tres microservicios de negocio vigentes
(`ms-cafeterias`, `ms-menus`, `ms-pedidos`), ni a `gateway` ni a `Fortio`.

Nota importante: **`ms-cafeterias` NO es legado** y no se tocó. El legado a
retirar es `ms-inventario`.

## 2. Arquitectura vigente

Microservicios de negocio:
- `ms-cafeterias` (http 3002)
- `ms-menus` (http 3003)
- `ms-pedidos` (http 3005)

Infraestructura:
- `gateway` (nginx, ClusterIP 80)
- `Fortio` (herramienta de pruebas de carga)
- Ingress `api-cdarwitg-ingress` → `gateway`

`ms-inventario` (http 3004, imagen `cdarwitg2024/inventario-service`) ya **no**
forma parte de esta arquitectura.

## 3. Recursos encontrados

### En el clúster (namespace `student-cdarwitg`)

| Recurso | Nombre | Ubicación | Acción |
|---|---|---|---|
| Deployment | `ms-inventario` | clúster | **Eliminado** |
| Pod | `ms-inventario-77c68fcd8f-9kl49` | clúster | Terminado (con el Deployment) |
| Service | `ms-inventario` | clúster (ClusterIP 10.43.95.238, 3004/TCP) | **Eliminado** |
| HPA | — | no existía | — |
| ConfigMap | — | no exclusivo | Conservado |
| Secret | — | solo el compartido `coffeesecret-supabase` | Conservado |
| Ingress | — | solo `api-cdarwitg-ingress` → gateway | Conservado |
| Job/CronJob | — | no existía | — |
| PVC | — | no existía | — |

### En el repositorio

| Recurso | Ubicación | Acción |
|---|---|---|
| Directorio del microservicio legado | `inventario-service/` (14 archivos tracked) | **Eliminado** |
| Manifiestos K8s legacy | árbol `k8s/` | Ya **no existía** (removido antes) |
| Docker/Compose | `Microservices/docker-compose.yml` | Sin servicio inventario → sin cambios |
| Docker/Compose (bot) | `BotTelegramCoffeFaster/docker-compose.yml` | Sin referencias → sin cambios |
| Ruta Gateway | `k8s-next/gateway/nginx.conf`, `k8s-next/gateway/configmap.yaml`, `Microservices/gateway/nginx.conf` | Sin ruta a inventario → sin cambios |
| Ingress | `k8s-next/ingress-api.yaml` | Solo → gateway → sin cambios |

## 4. Dependencias

Componentes revisados (repositorio + configuración live):

- **gateway** (nginx k8s y local): rutas solo a `ms-cafeterias`, `ms-menus`, `ms-pedidos`. **Sin** ruta a `ms-inventario`.
- **ingress**: `/` → `gateway`. **Sin** referencia a inventario.
- **ms-cafeterias / ms-menus / ms-pedidos**: sin variables `INVENTARIO_*`. En `ms-pedidos` solo hay comentarios/tests que confirman que **ya no** se llama a inventario (`"ms-inventario salió del stack"`).
- **docker-compose**: sin servicio inventario.
- **backend-node** (legado **separado**, no desplegado): contiene `src/clients/inventario.client.js` (cliente HTTP con `INVENTARIO_SERVICE_URL`) y una mención en `src/app.js`. Es una referencia **desde otro componente legado**, no desde la arquitectura vigente.

**Resultado:** **ninguna** dependencia activa de los 3 microservicios ni del
gateway con `ms-inventario`. No hay dependencia bloqueante.

## 5. Recursos eliminados de Kubernetes

Comandos ejecutados (eliminación explícita por tipo y nombre, sin `--all`, sin `-R`):

```
kubectl delete deployment ms-inventario -n student-cdarwitg
kubectl delete service    ms-inventario -n student-cdarwitg
```

Resultado: `deployment.apps "ms-inventario" deleted` y `service "ms-inventario" deleted`.
No se eliminaron Secrets, ConfigMaps, PVCs ni el namespace.

## 6. Limpieza del repositorio

**Eliminado:**
- `inventario-service/` (14 archivos: `Dockerfile`, `package.json`,
  `package-lock.json`, `.dockerignore`, `src/…`, `tests/…`).

**Modificado:** ninguno.

**Referencias conservadas (y por qué):**
- `backend-node/` (incl. `src/clients/inventario.client.js`): es un
  **componente legado distinto** (en retiro por separado), **no** es
  `ms-inventario`. Fuera del alcance de esta tarea.
- `docs/obsoleto/arquitectura-microservicios.md` y
  `docs/obsoleto/despliegue_kubernetes_backend.md`: documentación **histórica**
  archivada.
- `README.md`, `docs/README.md`, `Microservices/README.md`,
  `k8s-next/DESPLIEGUE.md`: menciones de estado/históricas.
- Comentarios en `k8s-next/*/hpa.yaml`: mencionan `ms-inventario` como Pod fijo
  en el cálculo de `maxReplicas`. **No se modificaron** (la tarea prohíbe tocar
  los HPA de los 3 MS actuales).
- `app-desktop/src/pages/dueno/SolicitudesStock.jsx`, `BotTelegramCoffeFaster/*`,
  `datosFicticios/*`, `database/*`: contienen la palabra "inventario" pero son
  **funcionalidad de inventario del producto** (stock), **no** el microservicio
  legado → **NO se tocan**.

## 7. Validación posterior

**Deployments** (todos 1/1): `gateway`, `ms-cafeterias`, `ms-menus`, `ms-pedidos`.

**Pods** (5, todos Running 1/1, 0 restarts): `fortio`, `gateway-…`,
`ms-cafeterias-…`, `ms-menus-…`, `ms-pedidos-…`. **No queda** ningún Pod de
`ms-inventario`.

**Services/Endpoints** (1 endpoint Ready por MS): `ms-cafeterias 3002`,
`ms-menus 3003`, `ms-pedidos 3005`.

**HPA** (3, intactos): `ms-cafeterias`, `ms-menus`, `ms-pedidos` — todos
`AbleToScale=True`, `ScalingActive=True`, `ScalingLimited=False`, con CPU real
`2%/70%`.

**Health checks** (read-only, desde el Pod `gateway`): `ms-cafeterias`,
`ms-menus` y `ms-pedidos` → `status: healthy`; `gateway /gateway/health` →
`gateway ok`.

**Eventos:** único evento relacionado: `Normal Killing pod/ms-inventario-…`
(por nuestra eliminación). Sin `FailedCreate` ni `exceeded quota`.

## 8. ResourceQuota

`student-provisioner-quota` (namespace `student-cdarwitg`):

| Recurso | Antes | Después | Liberado |
|---|---|---|---|
| pods | 6/12 | 5/12 | **1 pod** |
| requests.cpu | 275m/1 | 225m/1 | **50m** |
| requests.memory | 384Mi/1G | 320Mi/1G | **64Mi** |
| limits.cpu | 850m/2 | 700m/2 | **150m** |
| limits.memory | 768Mi/2G | 640Mi/2G | **128Mi** |
| services | 5/10 | 4/10 | **1 service** |

Lo liberado coincide exactamente con el consumo de una réplica de
`ms-inventario` (50m/64Mi requests, 150m/128Mi limits). No se modificó la
ResourceQuota. **No** se cambiaron los `maxReplicas` de los HPA en esta
operación (se recalculará en una tarea posterior).

> Nota: al retirar `ms-inventario` (un Pod fijo), el margen operativo del
> namespace **mejora** (ahora 3 de los 3 MS podrían subir con más holgura), pero
> por indicación expresa **no** se ajustan los HPA todavía.

## 9. Conclusión

**`ms-inventario` fue retirado completamente** del clúster (Deployment + Service)
y del repositorio (directorio `inventario-service/`), **sin afectar** a
`ms-cafeterias`, `ms-menus` ni `ms-pedidos`: los tres siguen `Running/Ready`,
con `healthy` en `/health`, con sus Services/Endpoints y con sus HPA activos y
consumiendo métricas reales.

- `ms-cafeterias` **no** fue eliminado ni modificado.
- `ms-menus` **no** fue eliminado.
- `ms-pedidos` **no** fue eliminado.
- `gateway` y `Fortio` permanecen activos.
- **No** se modificó Supabase/BD, RBAC, Metrics Server, ResourceQuota ni LimitRange.
- **No** se hizo commit ni push.
