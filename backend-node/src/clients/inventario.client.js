// Cliente HTTP del microservicio de Inventario (MS-Inventario).
// Pedidos ya NO importa el módulo local de stock: se comunica por HTTP con
// el servicio independiente, igual que hará en Kubernetes (Servicio
// "inventario-service"). La URL base se configura con INVENTARIO_SERVICE_URL.

const BASE_URL = process.env.INVENTARIO_SERVICE_URL || 'http://localhost:3001';
const PREFIX = `${BASE_URL}/api/inventario`;

function errorConflict(mensaje) {
  const err = new Error(mensaje);
  err.codigo = 409;
  return err;
}

function errorBd(mensaje) {
  const err = new Error(mensaje);
  err.codigo = 503;
  return err;
}

// Intenta leer el mensaje de error del body; si no, devuelve el status.
function leerMensajeError(json, status) {
  if (json && typeof json.error === 'string' && json.error) return json.error;
  return `Inventario respondió con status ${status}`;
}

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${PREFIX}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error(`No se pudo contactar MS-Inventario (${PREFIX}${path}): ${e.message}`);
    throw errorBd(`No se pudo contactar el servicio de inventario: ${e.message}`);
  }

  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }

  if (!res.ok) {
    if (res.status === 409) throw errorConflict(leerMensajeError(json, res.status));
    throw errorBd(leerMensajeError(json, res.status));
  }
  return json;
}

// Valida disponible stock de una lista de ítems [{ producto_id, cantidad }].
async function verificarDisponibilidad(items) {
  const productos = (Array.isArray(items) ? items : []).map(i => ({
    producto_id: i.producto_id,
    cantidad: i.cantidad
  }));
  await post('/verificar', { productos });
  return undefined;
}

async function descontarStock({ producto_id, cantidad, usuario_id, motivo }) {
  return post('/movimientos', {
    tipo: 'salida',
    producto_id,
    cantidad,
    usuario_id: usuario_id || null,
    motivo: motivo || 'venta'
  });
}

async function reponerStock({ producto_id, cantidad, usuario_id, motivo }) {
  return post('/movimientos', {
    tipo: 'entrada',
    producto_id,
    cantidad,
    usuario_id: usuario_id || null,
    motivo: motivo || 'reposición'
  });
}

module.exports = {
  verificarDisponibilidad,
  descontarStock,
  reponerStock
};