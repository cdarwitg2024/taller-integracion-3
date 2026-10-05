// ─── Totales del carrito ─────────────────────────────────────────
// Hook reutilizable: antes totalProducts/subtotal/total se calculaban
// por duplicado en App.tsx y CartScreen.
export const useCartTotals = (cart = []) => {
  const totalProducts = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  return { totalProducts, subtotal, total };
};

export default useCartTotals;
