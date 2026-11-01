import { FRANJAS, franjasConVencimiento } from './franjas';

// Hora local del dispositivo, fijada para que el caso límite sea determinista.
const aLas = (h, m, s = 0) => new Date(2026, 0, 15, h, m, s);

const vencida = (lista, id) => lista.find((f) => f.id === id).vencida;

describe('franjasConVencimiento', () => {
  test('un segundo antes del fin la franja sigue vigente', () => {
    expect(vencida(franjasConVencimiento(FRANJAS, aLas(12, 14, 59)), '12:00-12:15')).toBe(false);
  });

  test('en la hora exacta de fin la franja queda vencida', () => {
    expect(vencida(franjasConVencimiento(FRANJAS, aLas(12, 15, 0)), '12:00-12:15')).toBe(true);
  });

  test('un segundo después del fin la franja queda vencida', () => {
    expect(vencida(franjasConVencimiento(FRANJAS, aLas(12, 15, 1)), '12:00-12:15')).toBe(true);
  });

  test('una franja futura no se marca vencida', () => {
    expect(vencida(franjasConVencimiento(FRANJAS, aLas(12, 15, 0)), '12:15-12:30')).toBe(false);
  });

  test('sin franjas disponibles cuando todas vencieron', () => {
    const todas = franjasConVencimiento(FRANJAS, aLas(13, 30, 0));
    expect(todas.every((f) => f.vencida)).toBe(true);
  });
});
