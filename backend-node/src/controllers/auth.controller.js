const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  buscarPorEmail,
  buscarPorId,
  crearUsuario,
  actualizarUltimaConexion
} = require('../utils/usuariosMock');

const ROLES_VALIDOS = ['cliente', 'dueño', 'empleado', 'superadmin'];
const SALT_ROUNDS = 10;

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
    const usuarioExistente = buscarPorEmail(emailNormalizado);

    if (usuarioExistente) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = crearUsuario({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: emailNormalizado,
      telefono: telefono?.trim() || null,
      password_hash,
      rol
    });

    const { password_hash: _, ...usuarioSinHash } = usuario;

    return res.status(201).json(usuarioSinHash);
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
    const usuario = buscarPorEmail(emailNormalizado);

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    actualizarUltimaConexion(usuario.id);

    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    const { password_hash: _, ...usuarioSinHash } = usuario;

    return res.json({
      token,
      usuario: usuarioSinHash
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function me(req, res) {
  try {
    const usuario = buscarPorId(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { password_hash: _, ...usuarioSinHash } = usuario;

    return res.json(usuarioSinHash);
  } catch (error) {
    console.error('Error en me:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { register, login, me };