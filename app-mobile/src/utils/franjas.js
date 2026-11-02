/** Franja local de 15 minutos para retiro inmediato; no consulta Supabase. */
export const franjaRetiroActual = (referencia = new Date()) => {
  const inicio = new Date(referencia);
  inicio.setMinutes(Math.floor(inicio.getMinutes() / 15) * 15, 0, 0);
  const fin = new Date(inicio.getTime() + 15 * 60 * 1000);
  const hora = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const desde = hora(inicio);
  const hasta = hora(fin);
  return { id: desde + '-' + hasta, label: desde + ' - ' + hasta, inicio: desde, fin: hasta };
};
