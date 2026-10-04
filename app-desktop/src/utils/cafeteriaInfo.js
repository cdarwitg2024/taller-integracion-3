/**
 * Mapeo y resolución de información tributaria y de sucursal propia de cada cafetería.
 * Cada cafetería cuenta con su propio RUT, dirección de sucursal (SUC), ciudad y número de caja,
 * emulando fielmente la estructura tributaria de las boletas electrónicas en Chile (SII).
 */

const CAFETERIAS_INFO = {
  1: {
    id: 1,
    nombre: 'CAFETERÍA CENTRAL',
    rut: '76.134.941-K',
    suc: 'CAMPUS SAN FRANCISCO N° 0211',
    direccion: 'Manuel Montt #056, Edificio Central',
    ciudad: 'TEMUCO',
    caja: '0001',
    giro: 'SERVICIOS GASTRONÓMICOS Y CAFETERÍA',
  },
  2: {
    id: 2,
    nombre: 'CAFÉ INGENIERÍA',
    rut: '76.134.942-8',
    suc: 'CAMPUS NORTE - FAC. INGENIERÍA',
    direccion: 'Rudesindo Ortega #02950',
    ciudad: 'TEMUCO',
    caja: '0002',
    giro: 'SERVICIOS GASTRONÓMICOS Y CAFETERÍA',
  },
  3: {
    id: 3,
    nombre: 'BIBLIOTECA CAFÉ',
    rut: '76.134.943-6',
    suc: 'CAMPUS SAN JUAN PABLO II - BIBL.',
    direccion: 'Av. Alemania #0422',
    ciudad: 'TEMUCO',
    caja: '0003',
    giro: 'SERVICIOS GASTRONÓMICOS Y CAFETERÍA',
  },
  4: {
    id: 4,
    nombre: 'CAFETERÍA SUR',
    rut: '76.134.944-4',
    suc: 'CAMPUS MENCHACA LIRA N° 0371',
    direccion: 'Prieto Norte #0371',
    ciudad: 'TEMUCO',
    caja: '0004',
    giro: 'SERVICIOS GASTRONÓMICOS Y CAFETERÍA',
  },
};

export function obtenerInfoCafeteria(pedido) {
  const cafeBD = pedido?.cafeterias || {};
  const sedeBD = cafeBD?.campus_sedes || {};
  const idRaw = pedido?.cafeteria_id || cafeBD?.id || 1;
  const idNum = Number(idRaw) || 1;

  const infoBase = CAFETERIAS_INFO[idNum] || {
    id: idNum,
    nombre: String(cafeBD?.nombre || pedido?.cafeteria_nombre || 'CAFETERÍA UNIVERSITARIA').toUpperCase(),
    rut: '76.134.941-K',
    suc: 'CAMPUS UNIVERSITARIO N° 100',
    direccion: 'Campus Central',
    ciudad: 'TEMUCO',
    caja: '0001',
    giro: 'SERVICIOS GASTRONÓMICOS Y CAFETERÍA',
  };

  return {
    id: idNum,
    nombre: (cafeBD?.nombre || pedido?.cafeteria_nombre || infoBase.nombre).toUpperCase(),
    rut: cafeBD?.rut || infoBase.rut,
    suc: (sedeBD?.nombre || cafeBD?.direccion || infoBase.suc).toUpperCase(),
    direccion: cafeBD?.direccion || sedeBD?.direccion || infoBase.direccion,
    ciudad: (cafeBD?.ciudad || sedeBD?.ciudad || infoBase.ciudad).toUpperCase(),
    caja: cafeBD?.caja || infoBase.caja,
    giro: cafeBD?.giro || infoBase.giro,
  };
}

export default obtenerInfoCafeteria;
