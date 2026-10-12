-- ============================================================
-- Habilitar Realtime para las tablas que la app escucha
-- ============================================================
-- Necesario para que el KDS, la wallet del móvil y el resto de las
-- pantallas reciban INSERT/UPDATE vía supabase-js (canal postgres_changes).
--
-- Verificado manualmente: el canal se suscribe, pero los eventos no
-- llegan hasta que la tabla está en esta publicación.
--
-- OJO: si UNA tabla del canal no está publicada, el canal entero queda
-- con error y NO llegan los eventos de las otras. Por eso
-- `movimientos_wallet` importa tanto como `wallets`: sin ella, el saldo
-- tampoco se actualizaba en vivo aunque `wallets` estuviera published.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor  (o psql de supabase_db)
-- Idempotente con la forma "si no está, agregar".
-- ============================================================

-- `pedidos`: comandas del KDS y lista de pedidos del móvil.
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;

-- `wallets`: saldo del móvil.
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;

-- `movimientos_wallet`: historial de la wallet. Va en el MISMO canal que
-- `wallets`; sin esto el canal muere y el saldo deja de actualizarse.
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_wallet;

-- Verificación (debe listar las tablas de arriba):
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--
-- Ojo: `ALTER PUBLICATION ... ADD TABLE` NO es idempotente; corriendo este
-- script dos veces falla con "table is already member of publication".
-- Para re-aplicar sin error, quitar antes con:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.pedidos;