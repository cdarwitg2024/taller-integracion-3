const supabase = require('../../config/supabase');

const TableName = 'detalles_pedido';

const DetallesPedidoService = {
  async getByPedido(pedidoId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, productos(nombre, imagen_url)')
      .eq('pedido_id', pedidoId);
    
    if (error) throw error;
    return data;
  },

  async create(detalles) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(detalles)
      .select();
    
    if (error) throw error;
    return data;
  }
};

module.exports = DetallesPedidoService;