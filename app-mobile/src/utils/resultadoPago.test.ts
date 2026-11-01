import { clasificarResultadoPago } from './resultadoPago';

const aprobado = {
  ok: true,
  pedido_id: 42,
  total: 7500,
  saldo_restante: 2500,
  franja_retiro: '12:00-12:15',
};

describe('clasificarResultadoPago', () => {
  test('saldo insuficiente se rechaza con los montos para mostrar', () => {
    const c = clasificarResultadoPago({
      ok: false,
      motivo: 'saldo_insuficiente',
      total: 7500,
      faltante: 5000,
      saldo_disponible: 2500,
    });
    expect(c.tipo).toBe('saldo_insuficiente');
    if (c.tipo === 'saldo_insuficiente') {
      expect(c.resultado.total).toBe(7500);
      expect(c.resultado.faltante).toBe(5000);
      expect(c.resultado.saldo_disponible).toBe(2500);
    }
  });

  test('otro motivo de rechazo no se confunde con saldo insuficiente', () => {
    const c = clasificarResultadoPago({
      ok: false,
      motivo: 'cafeteria_cerrada',
      mensaje: 'La cafetería está cerrada',
    });
    expect(c.tipo).toBe('rechazado');
    if (c.tipo === 'rechazado') {
      expect(c.resultado.mensaje).toBe('La cafetería está cerrada');
    }
  });

  test('una confirmación completa se acepta', () => {
    const c = clasificarResultadoPago(aprobado);
    expect(c.tipo).toBe('confirmado');
    if (c.tipo === 'confirmado') {
      expect(c.resultado.pedido_id).toBe(42);
      expect(c.resultado.total).toBe(7500);
      expect(c.resultado.saldo_restante).toBe(2500);
    }
  });

  test('ok sin pedido_id válido no confirma el pago', () => {
    expect(clasificarResultadoPago({ ok: true, total: 1, saldo_restante: 0 }).tipo).toBe(
      'pedido_id_invalido'
    );
    expect(
      clasificarResultadoPago({ ok: true, pedido_id: 0, total: 1, saldo_restante: 0 }).tipo
    ).toBe('pedido_id_invalido');
  });

  test('ok sin los montos no confirma el pago', () => {
    expect(clasificarResultadoPago({ ok: true, pedido_id: 42 }).tipo).toBe(
      'datos_incompletos'
    );
    expect(
      clasificarResultadoPago({ ok: true, pedido_id: 42, total: 7500 }).tipo
    ).toBe('datos_incompletos');
  });

  test('una respuesta sin pedido es resultado incierto, no rechazo', () => {
    expect(clasificarResultadoPago(null).tipo).toBe('incierto');
    expect(clasificarResultadoPago(undefined).tipo).toBe('incierto');
  });
});
