-- ============================================================
-- OBSOLETO - no aplicar. Usar database/fixes/crear_rpc_pagos.sql
-- ============================================================
-- Este archivo queda reemplazado por `database/fixes/crear_rpc_pagos.sql`, que
-- es la version canonica de `procesar_pago`.
--
-- MOTIVO DEL REEMPLAZO
-- Esta definicion anadia la franja, pero rompia dos cosas:
--   1. Insertaba el estado con la etiqueta 'Pagado'. La columna `pedidos.estado`
--      guarda slugs en minusculas ('pendiente', 'en_preparacion', 'listo',
--      'entregado'): el KDS y el movil filtran por esos valores, asi que un
--      pedido pagado no aparecia en ninguna columna.
--   2. No generaba `qr_token` ni `codigo_retiro_diario`. El KDS se quedaba sin
--      un codigo valido con que validar el retiro (FR-22 / FR-23).
--
-- Aplicar este archivo DESPUES de `crear_rpc_pagos.sql` deshace ambas
-- correcciones. Si se aplico antes, vuelve a correr `crear_rpc_pagos.sql`
-- (es idempotente) y normaliza los estados ya escritos con:
--
--   UPDATE public.pedidos SET estado = 'pendiente'      WHERE estado IN ('Pagado','pagado');
--   UPDATE public.pedidos SET estado = 'en_preparacion' WHERE estado IN ('En preparacion','En preparación');
--   UPDATE public.pedidos SET estado = 'entregado'      WHERE estado IN ('Retirado','Entregado');
-- ============================================================

-- 1) Agregar columna franja_retiro a pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS franja_retiro TEXT;

-- 2) NO se redefine la RPC a proposito: la version vigente, con franja
--    obligatoria, estado 'pendiente' y generacion de ambos tokens, esta en
--    database/fixes/crear_rpc_pagos.sql
