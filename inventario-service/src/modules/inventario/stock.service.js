const supabase = require('../../config/supabase');

const ProductosTable = 'productos';
const MovimientosTable = 'movimientos_inventario';

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

// Valida que cada producto solicitado exista, esté activo y tenga stock suficiente.
// Lanza error 409 si algún ítem no puede satisfacerse.
async function verificarDisponibilidad(itemsRaw) {
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  const ids = [...new Set(items.map(i => String(i.producto_id)))];
  if (ids.length === 0) return;

  let data;
  try {
    const { data: filas, error } = await supabase
      .from(ProductosTable)
      .select('id, nombre, stock, activo')
      .in('id', ids);
    if (error) throw error;
    data = filas || [];
  } catch (e) {
    console.error(`No se pudo consultar el stock: ${e.message}`);
    throw errorBd(`No se pudo consultar el stock: ${e.message}`);
  }

  const mapa = new Map(data.map(p => [String(p.id), p]));

  for (const item of items) {
    const producto = mapa.get(String(item.producto_id));
    if (!producto) {
      throw errorConflict(`Producto con id "${item.producto_id}" no existe`);
    }
    if (producto.activo === false) {
      throw errorConflict(`El producto "${producto.nombre}" no está disponible`);
    }
    const disponible = Number(producto.stock) || 0;
    if (item.cantidad > disponible) {
      throw errorConflict(
        `Stock insuficiente para "${producto.nombre}": solicitado ${item.cantidad}, disponible ${disponible}`
      );
    }
  }
}

// Descuenta stock de un producto y registra el movimiento de salida.
// Invocado por MS-Pedidos al confirmar un pedido.
async function descontarStock({ producto_id, cantidad, usuario_id, motivo }) {
  return ajustarStock({ producto_id, cantidad: -cantidad, usuario_id, motivo, tipo: 'salida' });
}

// Repone stock de un producto y registra el movimiento de entrada.
// Invocado por MS-Pedidos al cancelar un pedido.
async function reponerStock({ producto_id, cantidad, usuario_id, motivo }) {
  return ajustarStock({ producto_id, cantidad, usuario_id, motivo, tipo: 'entrada' });
}

async function ajustarStock({ producto_id, cantidad, usuario_id, motivo, tipo }) {
  const delta = Number(cantidad) || 0;
  if (delta === 0) return null;

  let stockActual;
  try {
    const { data: producto, error } = await supabase
      .from(ProductosTable)
      .select('id, nombre, stock')
      .eq('id', producto_id)
      .maybeSingle();
    if (error) throw error;
    if (!producto) throw errorConflict(`Producto con id "${producto_id}" no existe`);
    stockActual = Number(producto.stock) || 0;
  } catch (e) {
    if (e.codigo === 409) throw e;
    console.error(`No se pudo leer el stock del producto ${producto_id}: ${e.message}`);
    throw errorBd(`No se pudo leer el stock del producto ${producto_id}: ${e.message}`);
  }

  const nuevoStock = stockActual + delta;
  if (nuevoStock < 0) {
    throw errorConflict(
      `Stock insuficiente para el producto ${producto_id}: actual ${stockActual}, no alcanza para descontar ${Math.abs(delta)}`
    );
  }

  try {
    const { data, error } = await supabase
      .from(ProductosTable)
      .update({ stock: nuevoStock, actualizado_en: new Date().toISOString() })
      .eq('id', producto_id)
      .select()
      .maybeSingle();
    if (error) throw error;

    const movimiento = {
      producto_id,
      usuario_id: usuario_id || null,
      tipo,
      cantidad: Math.abs(delta),
      motivo: motivo || (tipo === 'salida' ? 'venta' : 'reposición')
    };

    const { error: errorMov } = await supabase.from(MovimientosTable).insert(movimiento);
    if (errorMov) throw errorMov;

    return data || { producto_id, stock: nuevoStock };
  } catch (e) {
    if (e.codigo === 409) throw e;
    console.error(`No se pudo ajustar el stock del producto ${producto_id}: ${e.message}`);
    throw errorBd(`No se pudo ajustar el stock del producto ${producto_id}: ${e.message}`);
  }
}

module.exports = {
  verificarDisponibilidad,
  descontarStock,
  reponerStock,
  ajustarStock
};
