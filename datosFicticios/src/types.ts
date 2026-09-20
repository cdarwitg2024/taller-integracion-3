export interface Cafeteria {
  id: string | number;
  nombre: string;
  descripcion?: string;
  hora_apertura?: string;
  hora_cierre?: string;
  imagen_url?: string;
  activa: boolean;
  nombre_sede?: string;
  ciudad?: string;
}

export interface Producto {
  id: string | number;
  cafeteria_id: string | number;
  categoria_id?: string | number;
  nombre: string;
  descripcion?: string;
  precio: string | number;
  stock: number;
  stock_minimo: number;
  imagen_url?: string;
  activo: boolean;
  categoria_nombre?: string;
}

export interface DetallePedidoItem {
  producto_id: string | number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  nota?: string;
  stock_restante?: number;
  stock_minimo?: number;
}

export interface Pedido {
  id: string | number;
  codigo_retiro_diario: string;
  estado: string;
  pago_estado: string;
  total: number | string;
  creado_en: string;
  inicio_preparacion_en?: string;
  listo_en?: string;
  entregado_en?: string;
  tiempo_real_min?: number;
  cliente?: string;
  usuario_nombre?: string;
  usuario_apellido?: string;
  metodo_pago?: string;
  items?: DetallePedidoItem[];
}

export interface ProcesoPedidoActivo {
  pedidoId: number;
  codigoRetiro: string;
  cafeteriaId: number;
  cliente: string;
  total: number;
  itemsResumen: string;
  estadoActual: 'pendiente' | 'preparando' | 'listo' | 'entregado';
  siguienteEstado: 'preparando' | 'listo' | 'entregado' | null;
  demoraActualSegundos: number;
  cambioEstimadoEn: number;
  segundosRestantes: number;
  iniciadoEn: number;
  completadoEn?: number;
}

export interface ProcesosCafeteriaResponse {
  activos: ProcesoPedidoActivo[];
  completados: ProcesoPedidoActivo[];
}

export interface DbStatus {
  ok: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  timestamp: string;
  latencyMs: number;
  error?: string;
}

export interface Estadisticas {
  pedidos: {
    total_pedidos: string | number;
    total_ventas: string | number;
    entregados: string | number;
    pendientes: string | number;
    preparando: string | number;
    listos: string | number;
  };
  stock: {
    total_productos: string | number;
    sin_stock: string | number;
    stock_critico: string | number;
    stock_optimo: string | number;
    total_unidades: string | number;
  };
}
