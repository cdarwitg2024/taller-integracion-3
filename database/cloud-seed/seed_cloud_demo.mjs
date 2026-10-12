const URL_CON_PROYECTO = (process.env.CLOUD_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.CLOUD_SUPABASE_SERVICE_KEY || '';
const PASS_DUENO = process.env.DEMO_DUENO_PASSWORD || '';
const PASS_EMPLEADO = process.env.DEMO_EMPLEADO_PASSWORD || '';
const PASS_ESTUDIANTE = process.env.DEMO_ESTUDIANTE_PASSWORD || '';

const errores = [];
if (!SERVICE_KEY) errores.push('Falta CLOUD_SUPABASE_SERVICE_KEY (variable de entorno)');
if (!PASS_DUENO) errores.push('Falta DEMO_DUENO_PASSWORD (variable de entorno)');
if (!PASS_EMPLEADO) errores.push('Falta DEMO_EMPLEADO_PASSWORD (variable de entorno)');
if (!PASS_ESTUDIANTE) errores.push('Falta DEMO_ESTUDIANTE_PASSWORD (variable de entorno)');

const urlLower = URL_CON_PROYECTO.toLowerCase();
if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1') || urlLower.includes('10.0.2.2')) {
  errores.push('Negado: el seed no puede apuntar a un Supabase local');
}
if (errores.length > 0) {
  console.error(errores.join('\n'));
  process.exit(1);
}

const REST = '/rest/v1';
const AUTH_ADMIN = '/auth/v1/admin/users';

async function apiJson(path, options) {
  if (!options) options = {};
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    Accept: 'application/json'
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.headers) {
    for (var h in options.headers) {
      headers[h] = options.headers[h];
    }
  }
  const res = await fetch(URL_CON_PROYECTO + path, { method: options.method || 'GET', headers: headers, body: options.body });
  const body = await res.json().catch(function() { return null; });
  if (!res.ok) {
    throw new Error((options.method || 'GET') + ' ' + path + ' -> HTTP ' + res.status);
  }
  return body;
}

async function existeColumna(tabla, columna) {
  try {
    await apiJson(REST + '/' + tabla + '?select=' + columna + '&limit=0');
    return true;
  } catch (e) {
    return false;
  }
}

async function rolIdPorNombre(nombre) {
  var encoded = encodeURIComponent(nombre);
  var roles = await apiJson(REST + '/roles?select=id,nombre&nombre=eq.' + encoded);
  var rol = roles && roles[0];
  if (!rol) {
    throw new Error('No existe el rol en la tabla roles');
  }
  return rol.id;
}

async function asegurarAuthUser(email, password) {
  var lista = await apiJson(AUTH_ADMIN + '?page=1&per_page=1000');
  var arr = Array.isArray(lista) ? lista : (lista.users || []);
  var existente = null;
  for (var i = 0; i < arr.length; i++) {
    var em = arr[i].email || '';
    if (em.toLowerCase() === String(email).toLowerCase()) {
      existente = arr[i];
      break;
    }
  }
  if (existente) {
    return { id: existente.id, creado: false };
  }
  var creado = await apiJson(AUTH_ADMIN, {
    method: 'POST',
    body: JSON.stringify({ email: email, password: password, email_confirm: true })
  });
  return { id: creado.id, creado: true };
}

async function sembrarPersona(persona, rolNombre, opciones) {
  if (!opciones) opciones = {};
  var asignarCafeteria = (opciones.asignarCafeteria === undefined) ? true : opciones.asignarCafeteria;
  var cafeteriaId = opciones.cafeteriaId || 1;
  var rolId = await rolIdPorNombre(rolNombre);
  var auth = await asegurarAuthUser(persona.email, persona.password);
  var yaUsuario = await apiJson(REST + '/usuarios?select=id&email=eq.' + encodeURIComponent(persona.email));
  var usuarioId = null;
  if (Array.isArray(yaUsuario) && yaUsuario.length > 0) {
    usuarioId = yaUsuario[0].id;
  } else {
    if (!(await existeColumna('usuarios', 'auth_user_id'))) {
      throw new Error('La columna auth_user_id es requerida en usuarios');
    }
    var fila = {
      email: persona.email,
      nombre: persona.nombre,
      apellido: persona.apellido || '',
      rol_id: rolId,
      activo: true,
      auth_user_id: auth.id
    };
    var cols = ['password_hash', 'telefono', 'foto_url', 'ultima_conexion'];
    for (var j = 0; j < cols.length; j++) {
      if (await existeColumna('usuarios', cols[j])) {
        fila[cols[j]] = null;
      }
    }
    var insertado = await apiJson(REST + '/usuarios', {
      method: 'POST',
      body: JSON.stringify(fila),
      headers: { Prefer: 'return=representation' }
    });
    usuarioId = insertado && insertado[0] ? insertado[0].id : (insertado ? insertado.id : null);
    if (!usuarioId) {
      throw new Error('No se pudo obtener el id del usuario insertado');
    }
  }
  if (asignarCafeteria) {
    var yaAsignado = await apiJson(REST + '/cafeteria_usuarios?select=cafeteria_id&usuario_id=eq.' + usuarioId + '&cafeteria_id=eq.' + cafeteriaId);
    if (!Array.isArray(yaAsignado) || yaAsignado.length === 0) {
      await apiJson(REST + '/cafeteria_usuarios', {
        method: 'POST',
        body: JSON.stringify({ cafeteria_id: cafeteriaId, usuario_id: usuarioId })
      });
    }
  }
}

async function main() {
  await sembrarPersona({ email: 'dueno@coffeefaster.cl', nombre: 'dueno', apellido: '', password: PASS_DUENO }, 'dueño');
  await sembrarPersona({ email: 'empleado@coffeefaster.cl', nombre: 'empleado', apellido: '', password: PASS_EMPLEADO }, 'empleado');
  await sembrarPersona({ email: 'estudiante@coffeefaster.cl', nombre: 'estudiante', apellido: '', password: PASS_ESTUDIANTE }, 'estudiante', { asignarCafeteria: false });
  console.log('Listo. Solo se insertó lo que faltaba; nada se borrÃ³ ni se sobrescribiÃ³.');
}

main().catch(function(err) {
  console.error('ERROR:', err && err.message ? err.message : 'Error desconocido');
  process.exitCode = 1;
});