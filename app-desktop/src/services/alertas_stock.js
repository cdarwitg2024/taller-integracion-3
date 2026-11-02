import { supabase, isSupabaseConfigured } from './supabase.js';

const TABLE = 'alertas_stock';

function asegurarConexion() {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
}
function exigirId(id) {
  if (!id || !Number.isFinite(Number(id)) || Number(id) <= 0) {
    throw new Error('No se pudo determinar un ID válido para consultar alertas.');
  }
}

export const alertasStock = {
  async getAll() {
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE)
      .select('*, cafeterias(*), productos(*)').order('creado_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async getById(id) {
    exigirId(id);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE)
      .select('*, cafeterias(*), productos(*)').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  async getByCafeteria(cafeteriaId) {
    exigirId(cafeteriaId);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE)
      .select('*, productos(*)').eq('cafeteria_id', cafeteriaId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async getNoLeidas(cafeteriaId) {
    exigirId(cafeteriaId);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE)
      .select('*, productos(*)').eq('cafeteria_id', cafeteriaId).eq('leida', false)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(alerta) {
    exigirId(alerta?.cafeteria_id);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE).insert(alerta).select().single();
    if (error) throw error;
    return data;
  },
  async marcarLeida(id) {
    exigirId(id);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE)
      .update({ leida: true }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    exigirId(id);
    asegurarConexion();
    const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('id');
    if (error) throw error;
    return Boolean(data?.length);
  },
};
export default alertasStock;
