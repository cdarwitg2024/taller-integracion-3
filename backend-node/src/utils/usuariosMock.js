let usuariosMock = [];
let contadorId = 1;

function generarId() {
  return String(contadorId++);
}

function buscarPorEmail(email) {
  return usuariosMock.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function buscarPorId(id) {
  return usuariosMock.find(u => u.id === id);
}

function crearUsuario({ nombre, apellido, email, telefono, password_hash, rol }) {
  const ahora = new Date();
  const usuario = {
    id: generarId(),
    rol,
    nombre,
    apellido,
    email: email.toLowerCase(),
    telefono: telefono || null,
    password_hash,
    foto_url: null,
    activo: true,
    ultima_conexion: null,
    creado_en: ahora
  };
  usuariosMock.push(usuario);
  return usuario;
}

function actualizarUltimaConexion(id) {
  const usuario = buscarPorId(id);
  if (usuario) {
    usuario.ultima_conexion = new Date();
  }
}

function obtenerTodos() {
  return [...usuariosMock];
}

function limpiarMock() {
  usuariosMock = [];
  contadorId = 1;
}

module.exports = {
  usuariosMock,
  generarId,
  buscarPorEmail,
  buscarPorId,
  crearUsuario,
  actualizarUltimaConexion,
  obtenerTodos,
  limpiarMock
};