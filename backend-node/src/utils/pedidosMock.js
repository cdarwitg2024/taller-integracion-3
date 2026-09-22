const pedidosMock = [
  {
    id: '1',
    usuario_id: '1',
    cafeteria_id: '1',
    productos: [
      {
        producto_id: '1',
        nombre: 'Café Americano',
        cantidad: 2,
        precio_unitario: 2500,
        subtotal: 5000
      },
      {
        producto_id: '3',
        nombre: 'Croissant de Almendra',
        cantidad: 1,
        precio_unitario: 3500,
        subtotal: 3500
      }
    ],
    total: 8500,
    estado: 'Pendiente',
    creado_en: new Date('2026-08-24T08:30:00.000Z')
  },
  {
    id: '2',
    usuario_id: '1',
    cafeteria_id: '2',
    productos: [
      {
        producto_id: '2',
        nombre: 'Café Latte',
        cantidad: 1,
        precio_unitario: 3000,
        subtotal: 3000
      },
      {
        producto_id: '4',
        nombre: 'Muffin de Arándanos',
        cantidad: 2,
        precio_unitario: 2800,
        subtotal: 5600
      },
      {
        producto_id: '5',
        nombre: 'Jugo de Naranja Natural',
        cantidad: 1,
        precio_unitario: 2200,
        subtotal: 2200
      }
    ],
    total: 10800,
    estado: 'En_preparacion',
    creado_en: new Date('2026-08-24T09:15:00.000Z')
  },
  {
    id: '3',
    usuario_id: '2',
    cafeteria_id: '1',
    productos: [
      {
        producto_id: '1',
        nombre: 'Café Americano',
        cantidad: 1,
        precio_unitario: 2500,
        subtotal: 2500
      }
    ],
    total: 2500,
    estado: 'Listo',
    creado_en: new Date('2026-08-24T10:00:00.000Z')
  }
];

module.exports = { pedidosMock };