const supabase = require('../config/supabase');

const TableName = 'PEDIDOS';

const PedidosService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), CAFETERIAS(nombre), DETALLES_PEDIDO(*)');
    
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), CAFETERIAS(nombre), DETALLES_PEDIDO(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByUsuario(usuarioId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, DETALLES_PEDIDO(*)')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getByCafeteria(cafeteriaId) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), DETALLES_PEDIDO(*)')
      .eq('cafeteria_id', cafeteriaId)
      .order('creado_en', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getByQrToken(qrToken) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), CAFETERIAS(nombre), DETALLES_PEDIDO(*)')
      .eq('qr_token', qrToken)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByEstado(cafeteriaId, estado) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, USUARIOS(nombre, apellido), DETALLES_PEDIDO(*)')
      .eq('cafeteria_id', cafeteriaId)
      .eq('estado', estado)
      .order('creado_en', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async create(pedido, detalles) {
    const { data: nuevoPedido, error: pedidoError } = await supabase
      .from(TableName)
      .insert(pedido)
      .select()
      .single();
    
    if (pedidoError) throw pedidoError;

    if (detalles && detalles.length > 0) {
      const detallesConPedidoId = detalles.map(d => ({
        ...d,
        pedido_id: nuevoPedido.id
      }));

      const { error: detallesError } = await supabase
        .from('DETALLES_PEDIDO')
        .insert(detallesConPedidoId);
      
      if (detallesError) throw detallesError;
    }

    return nuevoPedido;
  },

  async updateEstado(id, estado) {
    const updates = { estado };
    
    if (estado === 'preparando') {
      updates.inicio_preparacion_en = new Date().toISOString();
    } else if (estado === 'entregado') {
      updates.completado_en = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(TableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTiempoReal(id, tiempoMin) {
    const { data, error } = await supabase
      .from(TableName)
      .update({ tiempo_real_min: tiempoMin })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = PedidosService;