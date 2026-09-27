-- ============================================================
-- Tablas para Wallet (FR-17) - CoffeeFast
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Idempotente: se puede re-ejecutar sin error.
-- ============================================================

-- 1) Tabla wallets: una por usuario
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  saldo_actual INTEGER NOT NULL DEFAULT 0 CHECK (saldo_actual >= 0),
  moneda TEXT NOT NULL DEFAULT 'CLP',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(usuario_id)
);

-- 2) Tabla movimientos_wallet: historial de transacciones
CREATE TABLE IF NOT EXISTS public.movimientos_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'compra', 'reembolso')),
  monto INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Habilitar RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_wallet ENABLE ROW LEVEL SECURITY;

-- 4) Políticas RLS para wallets
-- Los usuarios pueden ver su propia wallet
DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));

-- Los usuarios pueden actualizar su propia wallet (solo saldo_actual y actualizado_en)
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_own ON public.wallets
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
  WITH CHECK (usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));

-- Los usuarios pueden insertar su propia wallet (sistema de registro)
DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
CREATE POLICY wallets_insert_own ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));

-- 5) Políticas RLS para movimientos_wallet
DROP POLICY IF EXISTS movimientos_select_own ON public.movimientos_wallet;
CREATE POLICY movimientos_select_own ON public.movimientos_wallet
  FOR SELECT TO authenticated
  USING (wallet_id IN (
    SELECT id FROM public.wallets WHERE usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
  ));

DROP POLICY IF EXISTS movimientos_insert_own ON public.movimientos_wallet;
CREATE POLICY movimientos_insert_own ON public.movimientos_wallet
  FOR INSERT TO authenticated
  WITH CHECK (wallet_id IN (
    SELECT id FROM public.wallets WHERE usuario_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
  ));

-- 6) Habilitar Realtime para wallets
-- (El usuario debe agregar manualmente en Supabase Dashboard -> Realtime)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_wallet;

-- 7) Función para actualizar automáticamente actualizado_en
CREATE OR REPLACE FUNCTION public.handle_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_wallet_updated ON public.wallets;
CREATE TRIGGER on_wallet_updated
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_wallet_updated_at();

-- 8) Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_wallets_usuario_id ON public.wallets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_wallet_id ON public.movimientos_wallet(wallet_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_creado_en ON public.movimientos_wallet(creado_en DESC);

-- 9) Insertar wallets de prueba para usuarios existentes (saldo 0)
INSERT INTO public.wallets (usuario_id, saldo_actual)
SELECT id, 0 FROM public.usuarios
ON CONFLICT (usuario_id) DO NOTHING;
