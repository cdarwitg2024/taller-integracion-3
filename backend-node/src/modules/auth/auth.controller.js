const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UsuariosService = require('./usuarios.service');

// 'cliente' es un alias del contrato antiguo; el nombre real de la BD es 'estudiante'
const ROLES_VALIDOS = ['cliente', 'estudiante', 'dueño', 'empleado', 'superadmin'];
const SALT_ROUNDS = 10;

function rolNombre(usuario) {
  if (!usuario) return null;
  const rolEmbed = usuario.roles;
  if (rolEmbed && rolEmbed.nombre) return rolEmbed.nombre;
  if (Array.isArray(rolEmbed) && rolEmbed[0] && rolEmbed[0].nombre) return rolEmbed[0].nombre;
  return usuario.rol || null;
}

function usuarioPublico(usuario) {
  const rol = rolNombre(usuario);
  const { password_hash, ...sinHash } = usuario;
  return { ...sinHash, roles: rol ? { nombre: rol } : sinHash.roles };
}

async function register(req, res) {
  try {
    const { nombre, apellido, email, telefono, password, rol } = req.body;

    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        error: 'Campos requeridos: nombre, apellido, email, password, rol'
      });
    }

    if (typeof nombre !== 'string' || typeof apellido !== 'string' || typeof email !== 'string') {
      return res.status(400).json({ error: 'Nombre, apellido y email deben ser strings' });
    }

    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({
        error: `Rol inválido. Roles permitidos: ${ROLES_VALIDOS.join(', ')}`
      });
    }

    if (telefono !== undefined && telefono !== null && typeof telefono !== 'string') {
      return res.status(400).json({ error: 'Teléfono debe ser un string' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const emailNormalizado = email.toLowerCase().trim();
    const usuarioExistente = await UsuariosService.getByEmail(emailNormalizado);

    if (usuarioExistente) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const rolRegistrado = await UsuariosService.getRolByNombre(rol);

    if (!rolRegistrado) {
      return res.status(400).json({ error: `No existe el rol '${rol}' en la base de datos` });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await UsuariosService.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: emailNormalizado,
      telefono: telefono?.trim() || null,
      password_hash,
      rol_id: rolRegistrado.id,
      foto_url: null,
      activo: true,
      ultima_conexion: null
    });

    return res.status(201).json(usuarioPublico(usuario));
  } catch (error) {
    console.error('Error en register:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const emailNormalizado = email.toLowerCase().trim();

    // El login verifica credenciales SIEMPRE contra la BD real.
    // Si Supabase no está disponible, falla con error claro en vez de autenticar contra datos de respaldo.
    let usuario;
    try {
      usuario = await UsuariosService.getByEmailStrict(emailNormalizado);
    } catch (err) {
      console.error('Error al consultar la BD real en login:', err);
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (usuario.activo === false || usuario.activo === 'false') {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await UsuariosService.update(usuario.id, { ultima_conexion: new Date().toISOString() });

    const rol = rolNombre(usuario);

    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol,
      nombre: usuario.nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    return res.json({
      token,
      usuario: usuarioPublico(usuario)
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function me(req, res) {
  try {
    // /me resuelve la identidad SIEMPRE contra la BD real. Si Supabase no
    // responde, falla con error claro en vez de usar datos de respaldo.
    let usuario;
    try {
      usuario = await UsuariosService.getById(req.user.id);
    } catch (err) {
      console.error('Error al consultar la BD real en /me:', err);
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios' });
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(usuarioPublico(usuario));
  } catch (error) {
    console.error('Error en me:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { register, login, me };