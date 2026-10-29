const supabase = require('../../config/supabase');
const { cafeteriasMock } = require('../../utils/cafeteriasMock');

const TableName = 'cafeterias';

// Memoria local como respaldo / fallback resiliente
let memoriaCafeterias = cafeteriasMock.map(c => ({ ...c }));

function findEnMemoria(id) {
  return memoriaCafeterias.find(c => String(c.id) === String(id)) || null;
}

const CafeteriasService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*')
        .eq('activa', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('cafeterias.service: fallback a mock en getAll:', err.message);
      return memoriaCafeterias.filter(c => c.activa !== false);
    }
  },

  async getById(id) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('cafeterias.service: fallback a mock en getById:', err.message);
      return findEnMemoria(id);
    }
  },

  async getByCampus(campusId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*')
        .eq('campus_id', campusId)
        .eq('activa', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('cafeterias.service: fallback a mock en getByCampus:', err.message);
      return memoriaCafeterias.filter(c => String(c.campus_id) === String(campusId) && c.activa !== false);
    }
  },

  async create(cafeteria) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .insert(cafeteria)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('cafeterias.service: fallback a mock en create:', err.message);
      const nueva = { id: String(memoriaCafeterias.length + 1), ...cafeteria };
      memoriaCafeterias.push(nueva);
      return nueva;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('cafeterias.service: fallback a mock en update:', err.message);
      const cafeteria = findEnMemoria(id);
      if (cafeteria) Object.assign(cafeteria, updates);
      return cafeteria;
    }
  }
};

module.exports = CafeteriasService;