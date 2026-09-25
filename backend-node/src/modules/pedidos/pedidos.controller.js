const PedidosService = require('./pedidos.service');

/**
 * POST /api/pedidos - Crear un pedido según especificaciones del SRS
 */
async function crearPedido(req, res, next) {
  try {
    const { usuario_id, cafeteria_id, franja_retiro, productos, notas } = req.body;

    // Validaciones de entrada requeridas por el SRS
    if (!cafeteria_id) {
      return res.status(400).json({ error: 'El campo "cafeteria_id" es obligatorio.' });
    }
    if (!franja_retiro) {
      return res.status(400).json({ error: 'El campo "franja_retiro" es obligatorio.' });
    }
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en el pedido.' });
    }

    const nuevoPedido = await PedidosService.crearPedido({
      usuario_id,
      cafeteria_id,
      franja_retiro,
      productos,
      notas
    });

    return res.status(201).json({
      mensaje: 'Pedido creado exitosamente',
      pedido: nuevoPedido
    });
  } catch (error) {
    if (error.codigo === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos - Listar todos los pedidos (Administración)
 */
async function getPedidos(req, res, next) {
  try {
    const pedidos = await PedidosService.getAll();
    return res.status(200).json(pedidos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos/:id - Obtener detalle de un pedido
 */
async function getPedidoById(req, res, next) {
  try {
    const { id } = req.params;
    const pedido = await PedidosService.getById(id);
    if (!pedido) {
      return res.status(404).json({ error: `Pedido con ID "${id}" no encontrado.` });
    }
    return res.status(200).json(pedido);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos/cafeteria/:cafeteriaId - Comandas para KDS ordenadas por franja
 */
async function getPedidosByCafeteria(req, res, next) {
  try {
    const { cafeteriaId } = req.params;
    const pedidos = await PedidosService.getByCafeteria(cafeteriaId);
    return res.status(200).json(pedidos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos/usuario/:usuarioId - Pedidos del estudiante (App Móvil)
 */
async function getPedidosByUsuario(req, res, next) {
  try {
    const { usuarioId } = req.params;
    const pedidos = await PedidosService.getByUsuario(usuarioId);
    return res.status(200).json(pedidos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * PATCH /api/pedidos/:id/estado - Actualizar estado del pedido
 */
async function updateEstado(req, res, next) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'El campo "estado" es obligatorio.' });
    }

    const actualizado = await PedidosService.updateEstado(id, estado);
    if (!actualizado) {
      return res.status(404).json({ error: `Pedido con ID "${id}" no encontrado.` });
    }

    return res.status(200).json({
      mensaje: `Estado actualizado a "${estado}"`,
      pedido: actualizado
    });
  } catch (error) {
    if (error.codigo === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos/:id/qr - Generación dinámica del QR de un pedido
 */
async function obtenerQR(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await PedidosService.obtenerQR(id);
    if (!resultado) {
      return res.status(404).json({ error: `Pedido con ID "${id}" no encontrado.` });
    }
    return res.status(200).json({
      success: true,
      mensaje: 'Código QR generado exitosamente para el pedido (FR-22)',
      data: resultado
    });
  } catch (error) {
    if (error.codigo === 503) {
      return res.status(503).json({ error: error.message });
    }
    if (error.codigo === 409) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pedidos/:id/token-contingencia - Token de contingencia de un pedido
 */
async function obtenerTokenContingencia(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await PedidosService.obtenerTokenContingencia(id);
    if (!resultado) {
      return res.status(404).json({ error: `Pedido con ID "${id}" no encontrado.` });
    }
    return res.status(200).json({
      success: true,
      mensaje: 'Token de contingencia generado para el pedido (FR-23)',
      data: resultado
    });
  } catch (error) {
    if (error.codigo === 503) {
      return res.status(503).json({ error: error.message });
    }
    if (error.codigo === 409) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/pedidos/validar-qr - Validar QR o Token de contingencia desde el KDS
 */
async function validarQR(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Debe proporcionar el token o código QR a validar.' });
    }

    const resultado = await PedidosService.validarEntrega(token);
    if (!resultado.valido) {
      return res.status(400).json(resultado);
    }

    return res.status(200).json(resultado);
  } catch (error) {
    if (error.codigo === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}

module.exports = {
  crearPedido,
  getPedidos,
  getPedidoById,
  getPedidosByCafeteria,
  getPedidosByUsuario,
  updateEstado,
  obtenerQR,
  obtenerTokenContingencia,
  validarQR
};