/**
 * Utilidades para manejo robusto de fechas y horas en CoffeeFaster.
 * Corrige el desfase de 3 horas (UTC vs Hora local de Chile / navegador),
 * asegurando que los timestamps de la base de datos se interpreten en UTC
 * y se muestren en la hora local correcta del usuario.
 */

/**
 * Parsea cualquier timestamp o fecha garantizando que si viene en formato ISO/SQL
 * sin indicador explícito de zona horaria, se interprete como UTC (de PostgreSQL)
 * para que JavaScript lo convierta correctamente a la hora local del navegador.
 *
 * @param {string|number|Date} valor
 * @returns {Date|null}
 */
export function parsearFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  if (typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof valor === 'string') {
    let s = valor.trim();
    if (!s) return null;

    // Si viene en formato SQL 'YYYY-MM-DD HH:mm:ss', sustituir espacio por 'T'
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(s)) {
      s = s.replace(' ', 'T');
    }

    // Normalizar sufijos de zona horaria de 2 dígitos como '+00' o '-03' a '+00:00' o '-03:00'
    if (/([+-]\d{2})$/.test(s)) {
      s = s.replace(/([+-]\d{2})$/, '$1:00');
    }

    // Si es una fecha-hora ISO sin zona horaria (sin 'Z' ni '+HH:mm'/'-HH:mm'),
    // agregar 'Z' para forzar que JS la interprete como UTC y no como hora local prematura.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/i.test(s) && !/(Z|[+-]\d{2}(:\d{2})?)$/i.test(s)) {
      s += 'Z';
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formatea una fecha u hora a formato estándar de 24 horas "HH:mm" en la zona horaria local.
 * Convierte de forma transparente strings en formato 12 horas (AM/PM) o timestamps UTC a formato 24 horas.
 *
 * @param {string|number|Date} valor
 * @returns {string}
 */
export function formatearHora(valor) {
  if (!valor) return '--:--';

  // Si ya viene como string
  if (typeof valor === 'string') {
    const s = valor.trim();
    // Ya está en formato 24h directo "HH:mm" o "HH:mm:ss"
    const match24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      return `${String(match24[1]).padStart(2, '0')}:${match24[2]}`;
    }
    // Viene en formato 12h con AM/PM (ej: "03:15 PM" -> "15:15")
    const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let h = Number(match12[1]) % 12;
      if (/PM/i.test(match12[3])) h += 12;
      return `${String(h).padStart(2, '0')}:${match12[2]}`;
    }
  }

  const fecha = parsearFecha(valor);
  if (!fecha) return '--:--';

  const h24 = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${h24}:${min}`;
}

/**
 * Obtiene la hora en formato "HH:00" para agrupación de ventas por hora en gráficos.
 *
 * @param {string|number|Date} valor
 * @returns {string}
 */
export function formatearHoraBucket(valor) {
  const fecha = parsearFecha(valor) || new Date();
  return `${String(fecha.getHours()).padStart(2, '0')}:00`;
}
