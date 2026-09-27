const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const supabase = require('../../config/supabase');
const { pedidosMock } = require('../../utils/pedidosMock');
const {
  normalizarEstado,
  puedeTransicionar,
  transicionesDe,
  esEstadoTerminal,
  ESTADO_INICIAL
} = require('./pedidos.maquina-estados');
const {
  verificarDisponibilidad,
  descontarStock,
  reponerStock
} = require('../../clients/inventario.client');

const TableName = 'pedidos';
const DetallesTableName = 'detalles_pedido';

// Error operacional de base de datos: debe traducirse a 503 en el controller
function errorBd(mensaje) {
  const err = new Error(mensaje);
  err.codigo = 503;
  return err;
}

// La tabla real usa codigo_retiro_diario (no codigo_legible) y no tiene
// franja_retiro ni token_contingencia. Se normaliza la fila de BD para
// mantener el contrato de la API (codigo_legible) y dejar en null lo que
// el esquema real no persiste.
function normalizarPedidoDB(row) {
  if (!row) return row;
  return {
    ...row,
    codigo_legible: row.codigo_retiro_diario ?? row.codigo_legible ?? null,
    franja_retiro: row.franja_retiro ?? null,
    token_contingencia: row.token_contingencia ?? null
  };
}

// Memoria local como respaldo / fallback resiliente
let memoryPedidos = [...pedidosMock].map((p, idx) => ({
  ...p,
  codigo_legible: `#CF-${1000 + idx}`,
  franja_retiro: p.franja_retiro || '10:00 - 10:15',
  qr_token: p.qr_token || uuidv4(),
  token_contingencia: p.token_contingencia || `CF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  estado: p.estado || 'Pagado',
  creado_en: p.creado_en || new Date().toISOString()
}));

// Generador de Token de Contingencia alfanumérico (ej: CF-7A9B2)
function generarTokenContingencia() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = 'CF-';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function generarTokenContingenciaUnico() {
  let token = generarTokenContingencia();
  while (await existeTokenContingencia(token)) {
    token = generarTokenContingencia();
  }
  return token;
}

// El esquema real NO tiene columna token_contingencia: el token de contingencia
// (FR-23) se genera y se mantiene en la caché en memoria del backend.
async function existeTokenContingencia(token) {
  return memoryPedidos.some(p => p.token_contingencia === token);
}


function construirPayloadQR(pedido) {
  return {
    pedido_id: pedido.id,
    qr_token: pedido.qr_token,
    cafeteria_id: pedido.cafeteria_id,
    franja_retiro: pedido.franja_retiro,
    tipo: 'RETIRO_COFFEEFAST',
    created_at: pedido.creado_en || new Date().toISOString()
  };
}


async function generarTokenQRUnico() {
  let token = uuidv4();
  while (await existeTokenQR(token)) {
    token = uuidv4();
  }
  return token;
}

// Comprueba si un token QR ya está asociado a otro pedido (Supabase + memoria)
async function existeTokenQR(token) {
  try {
    const { data, error } = await supabase
      .from(TableName)
      .select('id')
      .eq('qr_token', token)
      .maybeSingle();
    if (!error && data) return true;
  } catch (e) {
    // fallback a memoria
  }
  return memoryPedidos.some(p => p.qr_token === token);
}

const PedidosService = {
  async crearPedido({ usuario_id, cafeteria_id, franja_retiro, productos, notas }) {
    if (!cafeteria_id) throw new Error('cafeteria_id es obligatorio');
    if (!franja_retiro) throw new Error('franja_retiro es obligatoria');
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      throw new Error('El pedido debe incluir al menos un producto');
    }

    // 1. Validar productos, cantidades y calcular total en backend
    let totalCalculado = 0;
    const detallesFormateados = productos.map((item, index) => {
      const cantidad = parseInt(item.cantidad, 10);
      const precio = parseFloat(item.precio_unitario || item.precio || 0);

      if (isNaN(cantidad) || cantidad <= 0) {
        throw new Error(`Cantidad inválida para el producto en posición ${index + 1}`);
      }
      if (isNaN(precio) || precio < 0) {
        throw new Error(`Precio inválido para el producto en posición ${index + 1}`);
      }

      const subtotal = cantidad * precio;
      totalCalculado += subtotal;

      return {
        producto_id: item.producto_id || item.id || `prod-${index + 1}`,
        nombre: item.nombre || `Producto ${index + 1}`,
        cantidad,
        precio_unitario: precio,
        subtotal,
        notas: item.notas || item.detalle || null
      };
    });

    // 1b. Normalizar usuario: la BD exige un número (FK a usuarios). Si el
    //     cliente no envía id válido (ej. placeholder anónimo), se usa un
    //     usuario real por defecto (configurable vía DEFAULT_USUARIO_ID).
    const usuarioIdNumerico = Number(usuario_id);
    const usuarioIdFinal = (Number.isInteger(usuarioIdNumerico) && usuarioIdNumerico > 0)
      ? usuarioIdNumerico
      : Number(process.env.DEFAULT_USUARIO_ID || 1);

    // 1c. Validar stock disponible antes de crear el pedido (409 si falta stock)
    await verificarDisponibilidad(detallesFormateados);

    // 2. Generar identificadores únicos de retiro (SRS: QR y Token de contingencia).
    //    FR-22: token QR único por pedido. FR-23: Token de contingencia alfanumérico único.
    const pedidoId = uuidv4();
    const qrToken = await generarTokenQRUnico();
    const tokenContingencia = await generarTokenContingenciaUnico();
    const codigoLegible = `#CF-${Math.floor(1000 + Math.random() * 9000)}`;
    const fechaCreacion = new Date().toISOString();

    // 3. Generar imagen QR dinámica en formato Base64 Data URI.
    let qrImage = null;
    try {
      const qrPayload = construirPayloadQR({
        id: pedidoId,
        qr_token: qrToken,
        cafeteria_id,
        franja_retiro,
        creado_en: fechaCreacion
      });
      qrImage = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320
      });
    } catch (qrErr) {
      console.warn('⚠️ No se pudo generar la imagen QR en Base64:', qrErr.message);
    }

    const nuevoPedido = {
      id: pedidoId,
      codigo_legible: codigoLegible,
      usuario_id: usuarioIdFinal,
      cafeteria_id,
      franja_retiro,
      total: totalCalculado,
      estado: ESTADO_INICIAL, // Estado inicial según SRS BR-06
      qr_token: qrToken,
      qr_image: qrImage,
      token_contingencia: tokenContingencia,
      creado_en: fechaCreacion,
      notas_generales: notas || null,
      productos: detallesFormateados
    };

    // 4. Persistir en Supabase (obligatorio). Si el INSERT real falla, NO se
    //    responde como pedido creado: se lanza error claro (503) y no queda
    //    ningún pedido fantasma en memoria.
    //    IMPORTANTE: el esquema real NO tiene las columnas id (autogenerada),
    //    creado_en (default), franja_retiro, token_contingencia ni qr_image;
    //    la única columna de código es codigo_retiro_diario y las notas van a "nota".
    let dbPedido;
    try {
      const { data, error } = await supabase
        .from(TableName)
        .insert({
          codigo_retiro_diario: nuevoPedido.codigo_legible,
          usuario_id: nuevoPedido.usuario_id,
          cafeteria_id: nuevoPedido.cafeteria_id,
          total: nuevoPedido.total,
          estado: nuevoPedido.estado,
          qr_token: nuevoPedido.qr_token,
          nota: nuevoPedido.notas_generales
        })
        .select()
        .single();

      if (error) throw error;
      dbPedido = data;
    } catch (dbError) {
      console.error(`No se pudo crear el pedido en la BD: ${dbError.message}`);
      throw errorBd(`No se pudo crear el pedido en la base de datos: ${dbError.message}`);
    }

    // El id y creado_en reales los asigna la BD
    const pedidoPersistido = {
      ...nuevoPedido,
      id: dbPedido.id,
      creado_en: dbPedido.creado_en
    };

    // Insertar detalles (obligatorio, sin fallback). Si falla, el pedido no
    // se considera creado de forma completa.
    if (detallesFormateados.length > 0) {
      const lineasDetalle = detallesFormateados.map(d => ({
        pedido_id: dbPedido.id,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
        nota: d.notas
      }));

      try {
        const { error: errorDetalle } = await supabase
          .from(DetallesTableName)
          .insert(lineasDetalle);
        if (errorDetalle) throw errorDetalle;
      } catch (detError) {
        console.error(`No se pudieron guardar los detalles del pedido: ${detError.message}`);
        throw errorBd(`No se pudieron guardar los detalles del pedido en la base de datos: ${detError.message}`);
      }
    }

    // 4b. Descontar stock por cada línea (el pedido ya quedó pagado).
    //     Si falla, el pedido existe pero no se puede servir: se informa como 503.
    try {
      for (const detalle of detallesFormateados) {
        await descontarStock({
          producto_id: detalle.producto_id,
          cantidad: detalle.cantidad,
          usuario_id: usuarioIdFinal,
          motivo: `Pedido #${dbPedido.codigo_retiro_diario || codigoLegible}`
        });
      }
    } catch (stockError) {
      console.error(`No se pudo descontar stock del pedido: ${stockError.message}`);
      throw errorBd(`El pedido se creó, pero no se pudo descontar el stock: ${stockError.message}`);
    }

    // Caché local de lectura (no es la fuente de verdad)
    memoryPedidos.unshift(pedidoPersistido);

    return {
      ...pedidoPersistido,
      persistencia: 'Supabase'
    };
  },

  /**
   * Obtener todos los pedidos (Panel de Administración)
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, detalles_pedido(*)')
        .order('creado_en', { ascending: false });

      if (!error && data && data.length > 0) return data.map(normalizarPedidoDB);
    } catch (e) {
      // fallback
    }
    return memoryPedidos;
  },

  /**
   * Obtener pedido por ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, detalles_pedido(*)')
        .eq('id', id)
        .single();

      if (!error && data) return normalizarPedidoDB(data);
    } catch (e) {
      // fallback
    }
    return memoryPedidos.find(p => String(p.id) === String(id) || String(p.codigo_legible) === String(id)) || null;
  },
  
  async obtenerQR(id) {
    const pedido = await this.getById(id);
    if (!pedido) return null;

    // No reutilización: un pedido ya entregado no puede volver a generar su QR
    if (esEstadoTerminal(pedido.estado)) {
      const error = new Error('El pedido ya fue entregado; el código QR no puede reutilizarse.');
      error.codigo = 409;
      throw error;
    }

    // Generar QR si no existe
    let qrToken = pedido.qr_token;
    if (!qrToken) {
      qrToken = await generarTokenQRUnico();
      const updates = { qr_token: qrToken };
      try {
        const { error } = await supabase
          .from(TableName)
          .update(updates)
          .eq('id', pedido.id)
          .select()
          .single();
        if (error) throw error;
      } catch (e) {
        console.error(`No se pudo guardar qr_token del pedido en la BD: ${e.message}`);
        throw errorBd(`No se pudo guardar el QR del pedido en la base de datos: ${e.message}`);
      }
      const index = memoryPedidos.findIndex(p => p.id === pedido.id);
      if (index !== -1) {
        memoryPedidos[index] = { ...memoryPedidos[index], ...updates };
      }
      pedido.qr_token = qrToken;
    }

    const payload = construirPayloadQR(pedido);

    let qrImage = null;
    try {
      qrImage = await QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320
      });
    } catch (qrErr) {
      console.warn('⚠️ No se pudo generar la imagen QR en Base64:', qrErr.message);
    }

    return {
      pedido_id: pedido.id,
      codigo_legible: pedido.codigo_legible || null,
      cafeteria_id: pedido.cafeteria_id,
      franja_retiro: pedido.franja_retiro,
      estado: pedido.estado,
      qr_token: qrToken,
      qr_image: qrImage,
      payload: payload,
      garantias: {
        codigo_diferente: 'Token UUID v4 único por pedido (verificación de colisión)',
        asociacion: `El payload referencia al pedido ${pedido.id}`,
        no_reutilizacion: 'Token de un solo uso validado en /validar-qr y bloqueado tras la entrega',
        informacion_validacion: ['pedido_id', 'qr_token', 'cafeteria_id', 'franja_retiro', 'tipo', 'created_at']
      }
    };
  },

  async obtenerTokenContingencia(id) {
    const pedido = await this.getById(id);
    if (!pedido) return null;

    // No reutilización: un pedido ya entregado no puede volver a usar su token
    if (esEstadoTerminal(pedido.estado)) {
      const error = new Error('El pedido ya fue entregado; el Token de contingencia no puede reutilizarse.');
      error.codigo = 409;
      throw error;
    }

    // Asociación: si el pedido aún no tiene token (datos precargados), se le asigna
    // un token único. El esquema real NO tiene columna token_contingencia, así que
    // el token se mantiene en la caché del backend (no se persiste en Supabase).
    let tokenContingencia = pedido.token_contingencia;
    if (!tokenContingencia) {
      tokenContingencia = await generarTokenContingenciaUnico();
      const index = memoryPedidos.findIndex(p => p.id === pedido.id);
      if (index !== -1) {
        memoryPedidos[index] = { ...memoryPedidos[index], token_contingencia: tokenContingencia };
      }
      pedido.token_contingencia = tokenContingencia;
    }

    return {
      pedido_id: pedido.id,
      codigo_legible: pedido.codigo_legible || null,
      cafeteria_id: pedido.cafeteria_id,
      estado: pedido.estado,
      token_contingencia: tokenContingencia,
      formato: 'CF-XXXXXX',
      tipo: 'CONTINGENCIA',
      garantias: {
        token_unico: 'Token alfanumérico único por pedido (verificación de colisión)',
        asociacion: `El token está asociado al pedido ${pedido.id}`,
        guardado: 'En caché del backend (el esquema real de Supabase no tiene columna token_contingencia)',
        posterior_validacion: 'Validado en POST /api/pedidos/validar-qr',
        un_solo_uso: 'Se marca como utilizado al marcar el pedido como Retirado'
      }
    };
  },

  async getByCafeteria(cafeteriaId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, detalles_pedido(*)')
        .eq('cafeteria_id', cafeteriaId)
        .order('creado_en', { ascending: false });

      if (!error && data && data.length > 0) return data.map(normalizarPedidoDB);
    } catch (e) {
      // fallback
    }
    return memoryPedidos
      .filter(p => String(p.cafeteria_id) === String(cafeteriaId))
      .sort((a, b) => (a.franja_retiro || '').localeCompare(b.franja_retiro || ''));
  },

  /**
   * Obtener pedidos de un usuario (para la App Móvil del estudiante)
   */
  async getByUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, detalles_pedido(*)')
        .eq('usuario_id', usuarioId)
        .order('creado_en', { ascending: false });

      if (!error && data && data.length > 0) return data.map(normalizarPedidoDB);
    } catch (e) {
      // fallback
    }
    return memoryPedidos.filter(p => String(p.usuario_id) === String(usuarioId));
  },

  /**
   * Actualizar estado del pedido respetando la máquina de estados
   * Creado -> Pagado -> En preparación -> Listo -> Retirado
   */
  async updateEstado(id, nuevoEstado) {
    const destino = normalizarEstado(nuevoEstado);
    if (!destino) {
      throw new Error(`Estado '${nuevoEstado}' no es válido.`);
    }

    const actual = await this.getById(id);
    if (!actual) return null;

    const desde = normalizarEstado(actual.estado);
    if (!puedeTransicionar(desde, destino)) {
      const permitidas = transicionesDe(desde);
      const mensaje = permitidas.length === 0
        ? `El estado '${desde}' es terminal; no admite transiciones.`
        : `Transición no permitida: '${desde}' → '${destino}'. Transiciones válidas: ${permitidas.join(', ')}.`;
      throw new Error(mensaje);
    }

    const updates = { estado: destino };
    const ahora = new Date().toISOString();

    // Columnas reales del esquema: inicio_preparacion_en, listo_en, entregado_en, cancelado_en
    if (destino === 'En preparación') {
      updates.inicio_preparacion_en = ahora;
    } else if (destino === 'Listo') {
      updates.listo_en = ahora;
    } else if (destino === 'Retirado') {
      updates.entregado_en = ahora;
      updates.qr_usado = true;
    } else if (destino === 'Cancelado') {
      updates.cancelado_en = ahora;
    }

    // UPDATE obligatorio contra la BD real (sin fallback de memoria).
    let data;
    try {
      const { data: fila, error } = await supabase
        .from(TableName)
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      data = fila;
    } catch (e) {
      console.error(`No se pudo actualizar el estado del pedido en la BD: ${e.message}`);
      throw errorBd(`No se pudo actualizar el estado del pedido en la base de datos: ${e.message}`);
    }

    if (!data) return null;

    // Actualizar caché local de lectura (no es la fuente de verdad)
    // Comparar por String(): el id llega como string (params) y en memoria puede ser number.
    const index = memoryPedidos.findIndex(p =>
      String(p.id) === String(id) || String(p.codigo_legible) === String(id)
    );
    if (index !== -1) {
      memoryPedidos[index] = { ...memoryPedidos[index], ...updates };
    }

    // Al cancelar se devuelve el stock de cada línea del pedido (una sola vez,
    // porque 'Cancelado' es un estado terminal).
    if (destino === 'Cancelado') {
      const { data: detalles, error: errorDetalles } = await supabase
        .from(DetallesTableName)
        .select('*')
        .eq('pedido_id', id);

      if (!errorDetalles && detalles && detalles.length > 0) {
        for (const detalle of detalles) {
          try {
            await reponerStock({
              producto_id: detalle.producto_id,
              cantidad: detalle.cantidad,
              usuario_id: actual.usuario_id,
              motivo: `Pedido ${actual.codigo_legible || actual.codigo_retiro_diario || id} cancelado`
            });
          } catch (e) {
            console.error(`No se pudo reponer stock al cancelar: ${e.message}`);
          }
        }
      }
    }

    return normalizarPedidoDB(data);
  },

  /**
   * Validar QR o Token de contingencia desde el KDS
   * el Token de contingencia es de un solo uso; al validar la entrega queda
   * marcado como utilizado (el pedido pasa a 'Retirado' y no puede reutilizarse).
   */
  async validarEntrega(tokenString) {
    if (!tokenString) throw new Error('Token o código QR no proporcionado');
    const tokenLimpio = tokenString.trim();

    // Buscar por qr_token o por token_contingencia (FR-23: validación del token)
    let pedido = memoryPedidos.find(p => 
      p.qr_token === tokenLimpio || 
      p.token_contingencia === tokenLimpio ||
      p.id === tokenLimpio ||
      p.codigo_legible === tokenLimpio
    );
    let metodoValidacion = 'desconocido';

if (!pedido) {
      try {
const { data, error } = await supabase
        .from(TableName)
        .select('*, detalles_pedido(*)')
        .or(`qr_token.eq.${tokenLimpio},codigo_retiro_diario.eq.${tokenLimpio},id.eq.${tokenLimpio}`)
        .single();
        if (!error && data) pedido = normalizarPedidoDB(data);
      } catch (e) {
        // fallback
      }
    }

    if (!pedido) {
      return { valido: false, razon: 'Código QR o Token no encontrado' };
    }

    // Determina si se validó con el Token de contingencia
    if (pedido.token_contingencia === tokenLimpio) {
      metodoValidacion = 'contingencia';
    } else if (pedido.qr_token === tokenLimpio) {
      metodoValidacion = 'qr';
    }

    if (esEstadoTerminal(pedido.estado)) {
      return { valido: false, razon: 'El pedido ya fue entregado previamente (token de un solo uso)', pedido };
    }

    if (normalizarEstado(pedido.estado) !== 'Listo') {
      return { valido: false, razon: 'El pedido aún no está listo para retiro', pedido };
    }

    // Marcar como entregado/retirado. El token consumido no puede reutilizarse.
    const pedidoActualizado = await this.updateEstado(pedido.id, 'Retirado');

    return {
      valido: true,
      mensaje: 'Entrega validada exitosamente',
      metodo_validacion: metodoValidacion,
      token_utilizado: tokenLimpio,
      pedido: pedidoActualizado || { ...pedido, estado: 'Retirado' }
    };
  }
};

module.exports = PedidosService;