const jwt = require('jsonwebtoken');
const UsuariosService = require('./usuarios.service');

async function autenticarToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autorización requerido' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Formato de token inválido. Use: Bearer <token>' });
    }

    const token = parts[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(401).json({ error: 'Token inválido' });
    }

    // La identidad del token se resuelve SIEMPRE contra la BD real. Si Supabase
    // no responde, falla con error claro en vez de resolver contra datos de respaldo.
    let usuario;
    try {
      usuario = await UsuariosService.getById(payload.id);
    } catch (err) {
      console.error('Error al consultar la BD real en autenticación:', err);
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (usuario.activo === false || usuario.activo === 'false') {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    const rolEmbed = usuario.roles;
    const rol = (rolEmbed && rolEmbed.nombre) ||
      (Array.isArray(rolEmbed) && rolEmbed[0] && rolEmbed[0].nombre) ||
      usuario.rol ||
      null;

    req.user = {
      id: usuario.id,
      email: usuario.email,
      rol,
      nombre: usuario.nombre
    };

    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { autenticarToken };