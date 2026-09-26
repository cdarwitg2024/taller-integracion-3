const {
  ESTADOS,
  MATRIZ,
  ESTADO_INICIAL,
  normalizarEstado,
  puedeTransicionar,
  transicionesDe,
  esEstadoTerminal
} = require('../src/modules/pedidos/pedidos.maquina-estados');

describe('Máquina de estados del pedido (fuente de verdad única)', () => {
  test('Estados canónicos son los del SRS en español', () => {
    expect(ESTADOS).toEqual(['Creado', 'Pagado', 'En preparación', 'Listo', 'Retirado', 'Cancelado']);
  });

  test('El pedido nace en "Pagado" (se crea tras el pago del carrito)', () => {
    expect(ESTADO_INICIAL).toBe('Pagado');
  });

  test('Matriz respeta el ciclo Creado -> Pagado -> En preparación -> Listo -> Retirado', () => {
    expect(puedeTransicionar('Creado', 'Pagado')).toBe(true);
    expect(puedeTransicionar('Pagado', 'En preparación')).toBe(true);
    expect(puedeTransicionar('En preparación', 'Listo')).toBe(true);
    expect(puedeTransicionar('Listo', 'Retirado')).toBe(true);
  });

  test('Cancelado es válido desde Pagado y desde Listo (BR-08)', () => {
    expect(puedeTransicionar('Pagado', 'Cancelado')).toBe(true);
    expect(puedeTransicionar('Listo', 'Cancelado')).toBe(true);
  });

  test('Transiciones prohibidas del diagrama del profesor', () => {
    expect(puedeTransicionar('Creado', 'Listo')).toBe(false);
    expect(puedeTransicionar('Pagado', 'Retirado')).toBe(false);
    expect(puedeTransicionar('Listo', 'En preparación')).toBe(false);
    expect(puedeTransicionar('Creado', 'Retirado')).toBe(false);
    expect(puedeTransicionar('Pagado', 'Listo')).toBe(false);
  });

  test('Sin saltos hacia atrás ni estados desconocidos', () => {
    expect(puedeTransicionar('Retirado', 'Listo')).toBe(false);
    expect(puedeTransicionar('Retirado', 'En preparación')).toBe(false);
    expect(puedeTransicionar('Cancelado', 'Pagado')).toBe(false);
    expect(puedeTransicionar('Pagado', 'Creado')).toBe(false);
    expect(puedeTransicionar('Pagado', 'Inventado')).toBe(false);
    expect(puedeTransicionar('Pagado', null)).toBe(false);
  });

  test('Estados terminales: Retirado y Cancelado', () => {
    expect(esEstadoTerminal('Retirado')).toBe(true);
    expect(esEstadoTerminal('Cancelado')).toBe(true);
    expect(esEstadoTerminal('Pagado')).toBe(false);
    expect(esEstadoTerminal('En preparación')).toBe(false);
  });

  test('transicionesDe expone solo los destinos válidos', () => {
    expect(transicionesDe('Pagado')).toEqual(['En preparación', 'Cancelado']);
    expect(transicionesDe('Listo')).toEqual(['Retirado', 'Cancelado']);
    expect(transicionesDe('Retirado')).toEqual([]);
    expect(transicionesDe('Desconocido')).toEqual([]);
  });

  test('Alias (inglés / guion bajo) se normalizan al español canónico', () => {
    expect(normalizarEstado('pendiente')).toBe('Pagado');
    expect(normalizarEstado('en_preparacion')).toBe('En preparación');
    expect(normalizarEstado('preparando')).toBe('En preparación');
    expect(normalizarEstado('listo')).toBe('Listo');
    expect(normalizarEstado('entregado')).toBe('Retirado');
    expect(normalizarEstado('LISTO')).toBe('Listo');
    expect(normalizarEstado('  Pagado ')).toBe('Pagado');
    expect(normalizarEstado('inexistente')).toBeNull();
    expect(normalizarEstado('')).toBeNull();
  });
});