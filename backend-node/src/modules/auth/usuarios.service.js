const supabase = require('../../config/supabase');
const usuariosMock = require('../../utils/usuariosMock');

const TableName = 'usuarios';
const RolesTableName = 'roles';

// Roles reales de la BD del proyecto (ids y nombres confirmados por probe)
const ROLES_FALLBACK = [
  { id: 1, nombre: 'estudiante' },
  { id: 2, nombre: 'empleado' },
  { id: 3, nombre: 'dueño' }
];

// Alias del contrato antiguo -> nombre real (la BD usa 'estudiante', no 'cliente')
const ALIASES_ROL = { cliente: 'estudiante' };

function rolNombreReal(nombre) {
  return ALIASES_ROL[nombre] || nombre;
}

function rolIdPorNombre(nombre) {
  const rol = ROLES_FALLBACK.find(r => r.nombre === rolNombreReal(nombre));
  return rol ? rol.id : null;
}

function rolNombrePorId(id) {
  const rol = ROLES_FALLBACK.find(r => String(r.id) === String(id));
  return rol ? rol.nombre : null;
}

function mapFallback(usuario) {
  if (!usuario) return usuario;
  const rol = rolNombrePorId(usuario.rol_id) || usuario.rol;
  const user = { ...usuario };
  if (rol) {
    delete user.rol_id;
    user.rol = rol;
  }
  return user;
}

const UsuariosService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, roles(nombre)')
        .eq('activo', true);

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('usuarios.service: fallback a mock en getAll:', err.message);
      return usuariosMock.obtenerTodos().filter(u => u.activo !== false);
    }
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, roles(nombre)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByEmail(email) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, roles(nombre)')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('usuarios.service: fallback a mock en getByEmail:', err.message);
      return mapFallback(usuariosMock.buscarPorEmail(email));
    }
  },

  async getByEmailStrict(email) {
    const { data, error } = await supabase
      .from(TableName)
      .select('*, roles(nombre)')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getRolByNombre(nombre) {
    try {
      const { data, error } = await supabase
        .from(RolesTableName)
        .select('id, nombre')
        .eq('nombre', rolNombreReal(nombre))
        .maybeSingle();

      if (error) throw error;
      if (data) return data;

      console.warn('usuarios.service: tabla roles vacía en Supabase, usando mapa de respaldo');
      const id = rolIdPorNombre(nombre);
      return id ? { id, nombre: rolNombreReal(nombre) } : null;
    } catch (err) {
      console.warn('usuarios.service: fallback de roles por nombre:', err.message);
      const id = rolIdPorNombre(nombre);
      return id ? { id, nombre: rolNombreReal(nombre) } : null;
    }
  },

  async create(usuario) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .insert(usuario)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('usuarios.service: fallback a mock en create:', err.message);
      const rol = rolNombrePorId(usuario.rol_id) || usuario.rol || null;
      return mapFallback(usuariosMock.crearUsuario({
        ...usuario,
        rol
      }));
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
      console.warn('usuarios.service: fallback a mock en update:', err.message);
      usuariosMock.actualizarUltimaConexion(String(id));
      const memoria = usuariosMock.obtenerTodos();
      return mapFallback(memoria.find(u => String(u.id) === String(id)) || null);
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from(TableName)
        .update({ activo: false })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.warn('usuarios.service: fallback a mock en delete:', err.message);
      const usuario = usuariosMock.buscarPorId(String(id));
      if (usuario) usuario.activo = false;
    }
  }
};

module.exports = UsuariosService;