const productosMock = [
  {
    id: '1',
    cafeteria_id: '1',
    nombre: 'Café Americano',
    descripcion: 'Café negro clásico, preparado con granos 100% arábica de origen colombiano.',
    precio: 2500,
    imagen_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300',
    stock: 50,
    activo: true
  },
  {
    id: '2',
    cafeteria_id: '1',
    nombre: 'Croissant de Almendra',
    descripcion: 'Croissant artesanal relleno de crema de almendra tostada.',
    precio: 3500,
    imagen_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300',
    stock: 20,
    activo: true
  },
  {
    id: '3',
    cafeteria_id: '2',
    nombre: 'Café Latte',
    descripcion: 'Espresso suave con leche vaporizada y arte latte.',
    precio: 3000,
    imagen_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300',
    stock: 40,
    activo: true
  },
  {
    id: '4',
    cafeteria_id: '2',
    nombre: 'Muffin de Arándanos',
    descripcion: 'Muffin esponjoso con arándanos frescos y toque de limón.',
    precio: 2800,
    imagen_url: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=300',
    stock: 15,
    activo: true
  },
  {
    id: '5',
    cafeteria_id: '2',
    nombre: 'Jugo de Naranja Natural',
    descripcion: 'Jugo 100% natural exprimido al momento, sin azúcar añadida.',
    precio: 2200,
    imagen_url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300',
    stock: 30,
    activo: true
  },
  {
    id: '6',
    cafeteria_id: '3',
    nombre: 'Té Verde Matcha Latte',
    descripcion: 'Latte de matcha ceremonial japonés con leche de avena.',
    precio: 3500,
    imagen_url: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=300',
    stock: 25,
    activo: true
  },
  {
    id: '7',
    cafeteria_id: '3',
    nombre: 'Galleta de Avena y Pasas',
    descripcion: 'Galleta casera crujiente con avena integral y pasas.',
    precio: 1800,
    imagen_url: 'https://images.unsplash.com/photo-1598964468598-fd1b1a9b5f1d?w=300',
    stock: 35,
    activo: true
  }
];

module.exports = { productosMock };