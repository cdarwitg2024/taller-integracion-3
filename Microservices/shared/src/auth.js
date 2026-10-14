'use strict';

/**
 * Auth compartida: valida el JWT de Supabase con `getUser(token)`.
 *
 * Por que `getUser` y no `verify` local de la firma JWT:
 * `getUser` hace la llamada al Auth server, asi que un token revocado o un
 * usuario desactivado se rechaza al instante. Verificar la firma sola daria por
 * bueno un token ya invalidado, porque la firma sigue siendo criptograficamente
 * valida.
 *
 * Consecuencia asumida: cada request autenticado es un round-trip a Supabase.
 * Para este proyecto (pocos usuarios concurrentes) es aceptable y mucho mas
 * seguro que mantener una lista de revocados.
 */

const { obtenerCliente } = require('./supabase');

/** Error con status HTTP para que el controller pueda responderlo directo. */
class HttpError extends Error {
  constructor(status, mensaje, opciones = {}) {
    super(mensaje);
    this.name = 'HttpError';
    this.status = status;
    Object.assign(this, opciones);
  }
}

/**
 * Middleware Express. Si el request trae un Bearer valido, deja el usuario en
 * `req.user`. Si no trae token, continua como anonimo.
 *
 * Pensado para endpoints publicos que agregan contexto si hay sesion
 * (GET /api/cafeterias). Para endpoints que exigen sesion usar `exigirAuth`.
 */
async function authOpcional(req, res, next) {
  const token = extraerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const cliente = obtenerCliente();
    const { data, error } = await cliente.auth.getUser(token);

    if (error || !data || !data.user) {
      req.user = null;
      return next();
    }

    req.user = normalizarUsuario(data.user);
    req.accessToken = token;
    return next();
  } catch (err) {
    // Un Supabase caido NO es "anonimo": es infraestructura abajo. Se responde
    // 503 para que el cliente reintente, en vez de devolver datos sin filtrar.
    return next(
      new HttpError(503, 'No se pudo validar la sesion con el proveedor de identidad', {
        causa: err.message
      })
    );
  }
}

/**
 * Middleware Express. Exige sesion: sin token valido responde 401.
 */
async function exigirAuth(req, res, next) {
  const token = extraerToken(req);

  if (!token) {
    return next(new HttpError(401, 'Falta el encabezado Authorization: Bearer <token>'));
  }

  try {
    const cliente = obtenerCliente();
    const { data, error } = await cliente.auth.getUser(token);

    if (error || !data || !data.user) {
      return next(new HttpError(401, 'Token invalido o vencido'));
    }

    req.user = normalizarUsuario(data.user);
    req.accessToken = token;
    return next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    return next(
      new HttpError(503, 'No se pudo validar la sesion con el proveedor de identidad', {
        causa: err.message
      })
    );
  }
}

/** Lee el Bearer. Acepta `bearer` en cualquier caso (el header HTTP no distingue). */
function extraerToken(req) {
  const header = req.headers && req.headers.authorization;
  if (!header || typeof header !== 'string') return null;

  const partes = header.trim().split(/\s+/);
  if (partes.length !== 2) return null;
  if (partes[0].toLowerCase() !== 'bearer') return null;

  return partes[1] || null;
}

/**
 * Reduce el usuario de Supabase a los campos que usa la app. `auth_user_id` es
 * el UUID de auth.users y es la llave con la que `usuarios` se engancha.
 */
function normalizarUsuario(user) {
  return {
    id: user.id,
    authUserId: user.id,
    email: user.email || null,
    activo: user.user_metadata ? user.user_metadata.activo !== false : true
  };
}

module.exports = { authOpcional, exigirAuth, extraerToken, normalizarUsuario, HttpError };