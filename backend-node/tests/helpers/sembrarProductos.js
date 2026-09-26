const supabase = require('../../src/config/supabase');

const PRODUCTOS_BASE = [
  { id: 1, cafeteria_id: 2, categoria_id: null, nombre: 'Café Americano', descripcion: 'Café negro clásico.', precio: 2500, stock: 500, stock_minimo: 10, activo: true },
  { id: 2, cafeteria_id: 2, categoria_id: null, nombre: 'Croissant de Almendra', descripcion: 'Croissant artesanal.', precio: 3500, stock: 500, stock_minimo: 5, activo: true },
  { id: 3, cafeteria_id: 3, categoria_id: null, nombre: 'Café Latte', descripcion: 'Espresso con leche.', precio: 3000, stock: 500, stock_minimo: 8, activo: true },
  { id: 4, cafeteria_id: 4, categoria_id: null, nombre: 'Té Verde Matcha Latte', descripcion: 'Latte de matcha.', precio: 3500, stock: 500, stock_minimo: 6, activo: true },
  { id: 5, cafeteria_id: 2, categoria_id: null, nombre: 'Jugo de Naranja Natural', descripcion: 'Jugo natural.', precio: 2200, stock: 500, stock_minimo: 5, activo: true },
  { id: 'prod-cafe-americano', cafeteria_id: 2, categoria_id: null, nombre: 'Café Americano', descripcion: 'Café negro clásico.', precio: 1800, stock: 500, stock_minimo: 10, activo: true },
  { id: 'prod-croissant', cafeteria_id: 2, categoria_id: null, nombre: 'Croissant de Jamón', descripcion: 'Croissant salado.', precio: 2200, stock: 500, stock_minimo: 5, activo: true }
];

function sembrarProductosBase() {
  supabase.__reset();
  supabase.__seed('productos', PRODUCTOS_BASE);
}

module.exports = { sembrarProductosBase };