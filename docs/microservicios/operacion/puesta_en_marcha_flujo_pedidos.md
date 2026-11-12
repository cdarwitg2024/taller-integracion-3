# Puesta en marcha — apps, gateway y Supabase

Revisado el 11 de noviembre de 2026. Ver [estado funcional y pendientes](../../estado-actual.md).

## Configuración

| Componente | Fuente | Variables principales |
|---|---|---|
| Desktop | Vite carga la raíz del repositorio mediante envDir; los archivos específicos del modo tienen prioridad | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY, VITE_BACKEND |
| Mobile | app-mobile/.env, cargado por Expo | EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL |
| Microservicios locales | Microservices/.env, consumido por Compose | SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_PUBLISHABLE_KEY, GATEWAY_PORT |
| Kubernetes | secretKeyRef de los Deployments | coffeesecret-supabase: URL, service key y publishable key |

Las apps usan claves públicas y sesión de usuario; las claves de servicio pertenecen al servidor. No publicar .env ni cuentas/contraseñas en documentación.

Desktop autentica con Supabase Auth, resuelve el perfil y la asociación real. El login no tiene un fallback de usuarios ficticios. Las rutas de acceso se gestionan por el login unificado /login; no depender de IDs de usuario o cafetería fijos.

## Entorno local con Supabase Cloud

1. Configurar apps y microservicios con el mismo proyecto Supabase.
2. Iniciar Docker Desktop y verificar su motor.
3. Desde Microservices: ejecutar docker compose up -d --build y docker compose ps.
4. El gateway local escucha en 8080 salvo GATEWAY_PORT explícito.
5. Desde `app-desktop`, ejecutar `npm ci --legacy-peer-deps` y `npm run electron:dev` para abrir el KDS en Electron.
6. Desde app-mobile: npm ci y npx expo start -c.

En Desktop, VITE_BACKEND puede apuntar a http://127.0.0.1:8080. En teléfono físico, EXPO_PUBLIC_API_URL debe usar http://<IP_PC>:8080 con PC/teléfono en la misma red. En emulador Android puede usarse http://10.0.2.2:8080. La IP puede cambiar; no copiar una dirección antigua sin verificar ipconfig. Revisar acceso de red/firewall si el teléfono no llega.

No cambiar la URL Supabase Cloud por localhost al cambiar la IP del gateway. Supabase local es un entorno alternativo, no un requisito para usar Cloud. Reiniciar las apps tras cambiar variables.

## Verificaciones de lectura

~~~powershell
curl.exe --fail http://127.0.0.1:8080/gateway/health
curl.exe --fail http://127.0.0.1:8080/api/cafeterias
curl.exe --fail http://127.0.0.1:8080/api/menus
curl.exe --fail http://127.0.0.1:8080/api/pedidos/health
~~~

Un health 200 confirma disponibilidad del proceso, no que todas las RPC, permisos y datos de Cloud estén correctos. Las operaciones privadas exigen JWT. No desactivar TLS para evitar un certificado inválido; corregir certificado/host o usar el gateway local de desarrollo.

## Compra, retiro y cancelación

Mobile → POST /api/pedidos autenticado → gateway → ms-pedidos → precios reales de ms-menus → RPC procesar_pago.

El KDS recibe pedidos por Realtime y tiene respaldo de consulta cada 10 s. El QR codifica qr_token completo; codigo_retiro_diario es la contingencia persistida. GET /api/pedidos/:id/qr valida propietario y estado. No crear códigos locales si faltan credenciales.

Cancelar mediante PATCH de estado en ms-pedidos deriva a `cancelar_pedido` con el JWT del propietario. La RPC repone stock cuando el pedido tiene `stock_descontado=true` y registra el reembolso en la misma transacción. La activación en el proyecto Cloud quedó registrada el 1 de noviembre. Ver [activación y alcance](../../base-datos/promociones-configuracion-dueno.md).

Si la lectura de pedidos devuelve `PGRST303: JWT expired`, Mobile intenta renovar la sesión y repite la lectura una vez. Si la sesión ya no puede renovarse, vuelve a iniciar sesión.

## Base de datos

Los archivos vigentes para revisar son app-mobile/tabla_mobile/rpc_qr.sql, rpc_cancelar_pedido.sql y database/fixes/. La antigua receta que nombraba crear_rpc_pagos.sql, crear_wallet_tables.sql, seed_menu_realista.sql y setup_movil_completo.sql no corresponde al árbol actual y no debe ejecutarse.

No hay una cadena completa de migraciones reproducible desde una base vacía. Inventariar funciones, tablas y RLS reales antes de aplicar SQL. No usar resets ni seeds sobre Cloud. Ver [inventario de dependencias](../../base-datos/dependencias-sql-ms-pedidos.md) y la actualización de [estado actual](../../estado-actual.md).

Para pruebas locales, ver los comandos del documento de estado. La aceptación de solicitudes solo persiste resolución administrativa: no repone stock.
