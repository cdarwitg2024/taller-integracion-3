'use strict';

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
      throw errorConflict(`Stock insuficiente para "${producto.nombre}": solicitado ${item.cantidad}, disponible ${disponible}`);
    }
  }
}

async function descontarStock({ producto_id, cantidad, usuario_id, motivo }) {
  return ajustarStock({ producto_id, cantidad: -cantidad, usuario_id, motivo, tipo: 'salida' });
}

async function reponerStock({ producto_id, cantidad, usuario_id, motivo }) {
  return ajustarStock({ producto_id, cantidad, usuario_id, motivo, tipo: 'entrada' });
}

async function ajustarStock({ producto_id, cantidad, usuario_id, motivo, tipo }, intentos = 3) {
  const delta = Number(cantidad) || 0;
  if (delta === 0) return null;
  const cantidadAbs = Math.abs(delta);
  for (let intento = 0; intento < intentos; intento++) {
    try {
      const { data: productoActual, error: errRead } = await supabase
        .from(ProductosTable)
        .select('id, stock, activo')
        .eq('id', producto_id)
        .is('eliminado_en', null)
        .maybeSingle();
      if (errRead) throw errRead;
      if (!productoActual) throw errorConflict(`Producto con id "${producto_id}" no existe`);
      if (productoActual.activo === false) throw errorConflict(`El producto "${producto_id}" no está disponible`);
      const stockLeido = Number(productoActual.stock) || 0;
      const nuevoStock = stockLeido + delta;
      if (nuevoStock < 0) {
        throw errorConflict(`Stock insuficiente para el producto ${producto_id}: solicitado ${cantidadAbs}, disponible ${stockLeido}`);
      }
      const { data: dataUpd, error: errUpd } = await supabase
        .from(ProductosTable)
        .update({ stock: nuevoStock, actualizado_en: new Date().toISOString() })
        .eq('id', producto_id)
        .eq('stock', stockLeido)
        .eq('activo', true)
        .is('eliminado_en', null)
        .select('id, stock')
        .maybeSingle();
      if (errUpd) throw errUpd;
      if (!dataUpd) {
        if (intento < intentos - 1) {
          await new Promise(r => setTimeout(r, 5));
          continue;
        }
        throw errorConflict(`Stock insuficiente para el producto ${producto_id}: no se pudo actualizar (conflicto de concurrencia)`);
      }
      const movimiento = {
        producto_id,
        usuario_id: (usuario_id !== undefined && usuario_id !== null) ? Number(usuario_id) : null,
        tipo,
        cantidad: cantidadAbs,
        motivo: motivo || 'venta'
      };
      const { error: errorMov } = await supabase.from(MovimientosTable).insert(movimiento);
      if (errorMov) throw errorMov;
      return dataUpd;
    } catch (e) {
      if (e && e.codigo === 409) {
        if (intento < intentos - 1) {
          await new Promise(r => setTimeout(r, 5));
          continue;
        }
      }
      throw e;
    }
  }
  throw errorConflict(`Stock insuficiente para el producto ${producto_id}`);
}

module.exports = {
  verificarDisponibilidad,
  descontarStock,
  reponerStock,
  ajustarStock
};
