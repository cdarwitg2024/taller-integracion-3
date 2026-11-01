/**
 * Franjas de retiro del día.
 *
 * Referencia horaria explícita: `new Date()` en hora local del dispositivo.
 * Una franja vence cuando su hora de fin ya se alcanzó (`fin <= referencia`).
 */
export const FRANJAS = [
  { id: '12:00-12:15', label: '12:00 - 12:15', inicio: '12:00', fin: '12:15' },
  { id: '12:15-12:30', label: '12:15 - 12:30', inicio: '12:15', fin: '12:30' },
  { id: '12:30-12:45', label: '12:30 - 12:45', inicio: '12:30', fin: '12:45' },
  { id: '12:45-13:00', label: '12:45 - 13:00', inicio: '12:45', fin: '13:00' },
  { id: '13:00-13:15', label: '13:00 - 13:15', inicio: '13:00', fin: '13:15' },
  { id: '13:15-13:30', label: '13:15 - 13:30', inicio: '13:15', fin: '13:30' },
];

/** Marca cada franja como vencida según la referencia horaria recibida. */
export const franjasConVencimiento = (franjas, referencia) => {
  const base = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  return franjas.map((f) => {
    const [hF, mF] = f.fin.split(':').map(Number);
    const fin = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hF, mF, 0, 0);
    return { ...f, vencida: fin.getTime() <= referencia.getTime() };
  });
};
