export const DESTINO_RETIRO_SIMULADO = 'Cuenta de prueba CoffeeFast (destino ficticio)';

export function validarMontoRetiroSimulado(valor: string, disponible: number): { monto: number | null; error: string } {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) return { monto: null, error: 'Ingresa el monto que deseas preparar.' };
  if (!/^\d+$/.test(texto)) return { monto: null, error: 'Ingresa un monto entero positivo en pesos chilenos, sin puntos ni comas.' };
  const monto = Number(texto);
  if (!Number.isSafeInteger(monto) || monto <= 0) return { monto: null, error: 'Ingresa un monto mayor que $0 y válido en pesos chilenos.' };
  if (!Number.isSafeInteger(disponible)) return { monto: null, error: 'Actualiza el saldo antes de preparar la solicitud.' };
  if (disponible <= 0) return { monto: null, error: 'No tienes saldo disponible para preparar un retiro.' };
  if (monto > disponible) return { monto: null, error: `El monto no puede superar tu saldo disponible de $${disponible.toLocaleString('es-CL')}.` };
  return { monto, error: '' };
}
