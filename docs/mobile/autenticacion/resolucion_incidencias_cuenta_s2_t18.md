# Validación y Resolución de Incidencias de Cuenta (S2-T18)

> **Evidencia de una revisión anterior.** Las cuentas, resultados y entorno del cuerpo corresponden a esa prueba, no al Cloud actual. Para arquitectura y pendientes ver [estado vigente](../../estado-actual.md). Clasificado el 1 de noviembre de 2026.


**Tarea:** S2-T18-Diego Vásquez — Corregir incidencias de cuenta  
**Rama:** `S2-T18-Diego-Vásquez-Corregir-incidencias-de-cuenta`  
**Fecha:** 31 de Octubre de 2026  

---

## 1. Resumen de Incidencias Corregidas

| Módulo | Incidencia Previa | Causa Raíz | Solución Aplicada |
| :--- | :--- | :--- | :--- |
| **Cancelación** | Falla `PGRST202: Could not find function public.cancelar_pedido` al cancelar pedido pendiente. | La RPC `cancelar_pedido` solo existía como borrador de referencia y no estaba desplegada en Supabase. | Se creó y versionó [`crear_rpc_cancelar_pedido_y_seguridad.sql`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/database/fixes/crear_rpc_cancelar_pedido_y_seguridad.sql) desplegando la RPC transaccional con reembolso atómico. |
| **Seguridad** | Cancelación directa insegura (`pedidos_update_cancelar_own`). | Existía una directiva RLS que permitía a un usuario hacer `UPDATE pedidos SET estado = 'cancelado'` saltándose el reembolso. | Se eliminó la directiva `pedidos_update_cancelar_own`. La RPC `cancelar_pedido` (`SECURITY DEFINER`) es ahora la única vía autorizada. |
| **Perfil** | Saldo en `$0` o advertencias de tipo `22P02: invalid input syntax for type bigint`. | [`PerfilScreen.js`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/app-mobile/src/screens/PerfilScreen.js) comparaba `wallets.usuario_id` (BIGINT) contra `authUserId` (UUID) cuando `usuarioIdInterno` no venía cargado. | Se corrigió [`PerfilScreen.js`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/app-mobile/src/screens/PerfilScreen.js) para resolver el identificador numérico interno antes de consultar la billetera. |
| **Perfil** | Error RLS al guardar edición de perfil en usuarios desvinculados. | `usuarios_update_own` solo permitía actualizar si `auth_user_id = auth.uid()`. | Se endureció la política permitiendo también la coincidencia por correo (`email = auth.jwt()->>'email'`) o `mi_usuario_id()`. |
| **Perfil** | Desincronización visual tras cancelaciones o compras. | `PerfilScreen` no disponía de canal Realtime para actualizar la Wallet ni los pedidos recientes. | Se añadió suscripción Realtime a tablas `wallets` y `pedidos` en [`PerfilScreen.js`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/app-mobile/src/screens/PerfilScreen.js). |
| **Wallet** | Parseo erróneo de montos con puntos en recargas (ej. `$10.000` -> `$10`). | `parseInt(montoRecarga, 10)` truncaba la cadena al encontrar el punto. | Se sanitizó el input en [`WalletScreen.tsx`](file:///home/diego/Proyectos/IntegraIII_Dev/taller-integracion-3/app-mobile/src/screens/WalletScreen.tsx) con `.replace(/[^0-9]/g, '')` y validación de tope máximo ($100.000 CLP). |

---

## 2. Guía para Revisión Manual

### Usuario de Prueba
- **Correo Institucional:** `estudiante.demo@alu.uct.cl`
- **Contraseña:** `123456`

### Casos de Prueba Manual

1. **Flujo de Cancelación y Reembolso:**
   - Inicia sesión y ve a la pestaña **Pedidos**.
   - Abre el pedido pendiente `CF-7701-P` ($6.500 CLP).
   - Toca el botón rojo **"Cancelar pedido y reembolsar"** y confirma en el diálogo.
   - **Resultado esperado:**
     - Alerta de éxito indicando que se reembolsaron $6.500 CLP y que el nuevo saldo es de **$25.000 CLP**.
     - El pedido cambia inmediatamente su vista al comprobante "✕ Pedido cancelado" y pasa a la pestaña de inactivos.
     - En la pestaña **Wallet**, el saldo aumenta automáticamente a **$25.000 CLP** y en el historial aparece: `+ $6.500 Reembolso pedido #24`.

2. **Bloqueo de Cancelación en Preparación:**
   - Abre el pedido `CF-7702-E` ($4.600 CLP, estado *En preparación*).
   - **Resultado esperado:**
     - Aparece el mensaje informativo: `🔒 Comanda en preparación o lista: no admite cancelación porque la cafetería ya comenzó a elaborar tus productos.`
     - No se muestra el botón de cancelación.

3. **Edición y Persistencia de Perfil:**
   - Ve a la pestaña **Perfil** y toca **"Editar datos"**.
   - Modifica el teléfono (ej. `+56911223344`) y presiona **"Guardar cambios"**.
   - **Resultado esperado:** Diálogo de éxito `"¡Perfil actualizado!"` y persistencia inmediata en la interfaz.

4. **Recarga Personalizada con Formato Numérico:**
   - Ve a la pestaña **Wallet** -> **"Recargar Saldo"**.
   - Ingresa un monto con formato (ej. `10.000` o `5000`).
   - Completa el pago simulado.
   - **Resultado esperado:** El saldo se incrementa exactamente por el monto total indicado, sin truncamientos a decenas.
