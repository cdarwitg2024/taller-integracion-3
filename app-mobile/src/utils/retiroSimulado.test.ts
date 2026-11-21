import { validarMontoRetiroSimulado } from './retiroSimulado';

test.each(['1', '500', '700', ' 500 ', '000500'])('acepta un entero positivo dentro del disponible: %s', valor => {
  const resultado = validarMontoRetiroSimulado(valor, 700);
  expect(resultado.error).toBe('');
  expect(resultado.monto).toBe(Number(valor));
});
test.each(['', '0', '000', '-1', '1.5', '1,5', '1.000', '1e3', '700abc', '9007199254740992'])('rechaza un monto no válido: %j', valor => {
  const resultado = validarMontoRetiroSimulado(valor, 700);
  expect(resultado.monto).toBeNull();
  expect(resultado.error).not.toBe('');
});
test('rechaza el superior al disponible sin sumar las comisiones pendientes', () => {
  expect(validarMontoRetiroSimulado('701', 700)).toMatchObject({ monto: null, error: expect.stringContaining('$700') });
});
test.each([0, -100, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('un saldo inexistente o inválido no habilita un monto: %s', disponible => {
  expect(validarMontoRetiroSimulado('1', disponible).monto).toBeNull();
});
