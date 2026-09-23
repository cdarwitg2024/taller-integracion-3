const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const supabase = require('../config/supabase');
const { pedidosMock } = require('../utils/pedidosMock');

const TableName = 'PEDIDOS';
const DetallesTableName = 'DETALLES_PEDIDO';

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

// Comprueba si un Token de contingencia ya está asociado a otro pedido
async function existeTokenContingencia(token) {
  try {
    const { data, error } = await supabase
      .from(TableName)
      .select('id')
      .eq('token_contingencia', token)
      .maybeSingle();
    if (!error && data) return true;
  } catch (e) {
    // fallback a memoria
  }
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
      usuario_id: usuario_id || 'usr-estudiante-anonimo',
      cafeteria_id,
      franja_retiro,
      total: totalCalculado,
      estado: 'Pagado', // Estado inicial según SRS BR-06
      qr_token: qrToken,
      qr_image: qrImage,
      token_contingencia: tokenContingencia,
      creado_en: fechaCreacion,
      notas_generales: notas || null,
      productos: detallesFormateados
    };

    // 4. Persistir en Supabase con fallback resiliente
    let guardadoEnDB = false;
    try {
      const { data: dbPedido, error: errorPedido } = await supabase
        .from(TableName)
        .insert({
          id: nuevoPedido.id,
          codigo_legible: nuevoPedido.codigo_legible,
          usuario_id: nuevoPedido.usuario_id,
          cafeteria_id: nuevoPedido.cafeteria_id,
          franja_retiro: nuevoPedido.franja_retiro,
          total: nuevoPedido.total,
          estado: nuevoPedido.estado,
          qr_token: nuevoPedido.qr_token,
          token_contingencia: nuevoPedido.token_contingencia,
          creado_en: nuevoPedido.creado_en
        })
        .select()
        .single();

      if (!errorPedido && dbPedido) {
        guardadoEnDB = true;
        const lineasDetalle = detallesFormateados.map(d => ({
          pedido_id: dbPedido.id,
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_unitario_historico: d.precio_unitario,
          subtotal: d.subtotal,
          notas: d.notas
        }));

        await supabase.from(DetallesTableName).insert(lineasDetalle);
      }
    } catch (dbError) {
      console.warn('ℹ️ Usando almacenamiento resiliente local por desconexión en BD:', dbError.message);
    }

    // Siempre registrar en el store en memoria para disponibilidad local instantánea
    memoryPedidos.unshift(nuevoPedido);

    return {
      ...nuevoPedido,
      persistencia: guardadoEnDB ? 'Supabase' : 'Memoria/Fallback'
    };
  },

  /**
   * Obtener todos los pedidos (Panel de Administración)
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, DETALLES_PEDIDO(*)')
        .order('creado_en', { ascending: false });

      if (!error && data && data.length > 0) return data;
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
        .select('*, DETALLES_PEDIDO(*)')
        .eq('id', id)
        .single();

      if (!error && data) return data;
    } catch (e) {
      // fallback
    }
    return memoryPedidos.find(p => p.id === id || p.codigo_legible === id) || null;
  },
  
  async obtenerQR(id) {
    const pedido = await this.getById(id);
    if (!pedido) return null;

    // No reutilización: un pedido ya entregado no puede volver a generar su QR
    if (pedido.estado === 'Retirado' || pedido.estado === 'entregado') {
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
        await supabase.from(TableName).update(updates).eq('id', pedido.id);
      } catch (e) {
        // fallback resiliente
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
    if (pedido.estado === 'Retirado' || pedido.estado === 'entregado') {
      const error = new Error('El pedido ya fue entregado; el Token de contingencia no puede reutilizarse.');
      error.codigo = 409;
      throw error;
    }

    // Asociación: si el pedido aún no tiene token (datos precargados), se le asigna
    // un token único y se persiste en la misma fila del pedido.
    let tokenContingencia = pedido.token_contingencia;
    if (!tokenContingencia) {
      tokenContingencia = await generarTokenContingenciaUnico();
      const updates = { token_contingencia: tokenContingencia };
      try {
        await supabase.from(TableName).update(updates).eq('id', pedido.id);
      } catch (e) {
        // fallback resiliente
      }
      const index = memoryPedidos.findIndex(p => p.id === pedido.id);
      if (index !== -1) {
        memoryPedidos[index] = { ...memoryPedidos[index], ...updates };
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
        guardado: 'Persistido en PEDIDOS.token_contingencia (Supabase + memoria)',
        posterior_validacion: 'Validado en POST /api/pedidos/validar-qr',
        un_solo_uso: 'Se marca como utilizado al marcar el pedido como Retirado'
      }
    };
  },

  async getByCafeteria(cafeteriaId) {
    try {
      const { data, error } = await supabase
        .from(TableName)
        .select('*, DETALLES_PEDIDO(*)')
        .eq('cafeteria_id', cafeteriaId)
        .order('franja_retiro', { ascending: true });

      if (!error && data && data.length > 0) return data;
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
        .select('*, DETALLES_PEDIDO(*)')
        .eq('usuario_id', usuarioId)
        .order('creado_en', { ascending: false });

      if (!error && data && data.length > 0) return data;
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
    const estadosValidos = ['Creado', 'Pagado', 'En preparación', 'Listo', 'Retirado', 'Cancelado', 'pendiente', 'preparando', 'listo', 'entregado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado '${nuevoEstado}' no es válido.`);
    }

    const updates = { estado: nuevoEstado };
    const ahora = new Date().toISOString();

    if (nuevoEstado === 'En preparación' || nuevoEstado === 'preparando') {
      updates.inicio_preparacion_en = ahora;
    } else if (nuevoEstado === 'Retirado' || nuevoEstado === 'entregado') {
      updates.completado_en = ahora;
    }

    try {
      const { data, error } = await supabase
        .from(TableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) return data;
    } catch (e) {
      // fallback
    }

    const index = memoryPedidos.findIndex(p => p.id === id || p.codigo_legible === id);
    if (index !== -1) {
      memoryPedidos[index] = { ...memoryPedidos[index], ...updates };
      return memoryPedidos[index];
    }

    return null;
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
          .select('*, DETALLES_PEDIDO(*)')
          .or(`qr_token.eq.${tokenLimpio},token_contingencia.eq.${tokenLimpio},id.eq.${tokenLimpio}`)
          .single();
        if (!error && data) pedido = data;
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

    if (pedido.estado === 'Retirado' || pedido.estado === 'entregado') {
      return { valido: false, razon: 'El pedido ya fue entregado previamente (token de un solo uso)', pedido };
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