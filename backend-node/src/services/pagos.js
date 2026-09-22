const supabase = require('../config/supabase');

const TableName = 'PAGOS';

const PagosService = {
  async getByPedido(pedidoId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*')
      .eq('pedido_id', pedidoId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async create(pago) {
    const { data, error } = await supabase
      .from(TableName)
      .insert(pago)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateEstado(id, estado) {
    const { data, error } = await supabase
      .from(TableName)
      .update({ estado })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = PagosService;