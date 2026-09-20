import { supabase, supabaseAdmin, isSupabaseConfigured } from './supabase';
import pedidos, { pedidosService } from './pedidos';
import productos, { productosService } from './productos';
import categorias from './categorias';
import alertasStock from './alertas_stock';
import movimientosInventario from './movimientos_inventario';
import detallesPedido from './detalles_pedido';
import usuarios from './usuarios';
import roles from './roles';
import cafeterias from './cafeterias';
import cafeteriaUsuarios from './cafeteria_usuarios';
import campusSedes from './campus_sedes';
import universidades from './universidades';
import metodosPago from './metodos_pago';
import pagos from './pagos';
import dispositivos from './dispositivos';
import logsValidacionQr from './logs_validacion_qr';
import vistas from './vistas';

export {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
  pedidos,
  pedidosService,
  productos,
  productosService,
  categorias,
  alertasStock,
  movimientosInventario,
  detallesPedido,
  usuarios,
  roles,
  cafeterias,
  cafeteriaUsuarios,
  campusSedes,
  universidades,
  metodosPago,
  pagos,
  dispositivos,
  logsValidacionQr,
  vistas,
};

export default {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
  pedidos,
  pedidosService,
  productos,
  productosService,
  categorias,
  alertasStock,
  movimientosInventario,
  detallesPedido,
  usuarios,
  roles,
  cafeterias,
  cafeteriaUsuarios,
  campusSedes,
  universidades,
  metodosPago,
  pagos,
  dispositivos,
  logsValidacionQr,
  vistas,
};
