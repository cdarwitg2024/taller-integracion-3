// Datos mock de cafeterías
const CAFETERIAS_MOCK = [
  {
    id: 'cafe_central',
    nombre: 'Cafetería Central',
    ubicacion: 'Edificio A - Planta Baja',
    tasa_servicio: 2.5, // μ (clientes por minuto)
    capacidad_maxima: 30,
    horario_atencion: '08:00-18:00',
    estado: 'activa'
  },
  {
    id: 'cafe_norte',
    nombre: 'Cafetería Norte',
    ubicacion: 'Edificio C - Primer Piso',
    tasa_servicio: 1.8,
    capacidad_maxima: 20,
    horario_atencion: '08:00-17:00',
    estado: 'activa'
  },
  {
    id: 'cafe_sur',
    nombre: 'Cafetería Sur',
    ubicacion: 'Edificio D - Planta Baja',
    tasa_servicio: 2.0,
    capacidad_maxima: 25,
    horario_atencion: '08:00-18:30',
    estado: 'activa'
  },
  {
    id: 'cafe_este',
    nombre: 'Cafetería Este',
    ubicacion: 'Edificio B - Segundo Piso',
    tasa_servicio: 1.5,
    capacidad_maxima: 15,
    horario_atencion: '09:00-17:30',
    estado: 'activa'
  }
];

// Datos mock de pedidos activos
let PEDIDOS_ACTIVOS_MOCK = [
  {
    id: 'pedido_001',
    cafeteria_id: 'cafe_central',
    productos: ['Café Americano', 'Croissant'],
    tiempo_llegada: new Date(Date.now() - 5 * 60000),
    estado: 'preparacion',
    cliente_id: 'user_123'
  },
  {
    id: 'pedido_002',
    cafeteria_id: 'cafe_central',
    productos: ['Latte', 'Sándwich'],
    tiempo_llegada: new Date(Date.now() - 8 * 60000),
    estado: 'preparacion',
    cliente_id: 'user_456'
  },
  {
    id: 'pedido_003',
    cafeteria_id: 'cafe_norte',
    productos: ['Té', 'Muffin'],
    tiempo_llegada: new Date(Date.now() - 3 * 60000),
    estado: 'preparacion',
    cliente_id: 'user_789'
  }
];

class CafeteriaModel {
  static getAllCafeterias() {
    return CAFETERIAS_MOCK;
  }

  static getCafeteriaById(id) {
    return CAFETERIAS_MOCK.find(c => c.id === id);
  }

  static getCafeteriasActivas() {
    return CAFETERIAS_MOCK.filter(c => c.estado === 'activa');
  }

  static getPedidosActivos(cafeteriaId) {
    return PEDIDOS_ACTIVOS_MOCK.filter(p => p.cafeteria_id === cafeteriaId);
  }

  static getAllPedidosActivos() {
    return PEDIDOS_ACTIVOS_MOCK;
  }

  static agregarPedido(pedido) {
    const nuevoPedido = {
      id: `pedido_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...pedido,
      tiempo_llegada: new Date()
    };
    PEDIDOS_ACTIVOS_MOCK.push(nuevoPedido);
    return nuevoPedido;
  }

  static actualizarEstadoPedido(pedidoId, nuevoEstado) {
    const pedido = PEDIDOS_ACTIVOS_MOCK.find(p => p.id === pedidoId);
    if (pedido) {
      pedido.estado = nuevoEstado;
      return pedido;
    }
    return null;
  }

  // Método para resetear datos mock (útil para pruebas)
  static resetMockData() {
    PEDIDOS_ACTIVOS_MOCK = [
      {
        id: 'pedido_001',
        cafeteria_id: 'cafe_central',
        productos: ['Café Americano', 'Croissant'],
        tiempo_llegada: new Date(Date.now() - 5 * 60000),
        estado: 'preparacion',
        cliente_id: 'user_123'
      },
      {
        id: 'pedido_002',
        cafeteria_id: 'cafe_central',
        productos: ['Latte', 'Sándwich'],
        tiempo_llegada: new Date(Date.now() - 8 * 60000),
        estado: 'preparacion',
        cliente_id: 'user_456'
      }
    ];
  }
}

module.exports = CafeteriaModel;