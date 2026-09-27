// Lógica de negocio de las notificaciones push al cliente móvil.
//
// Eventos disparados desde PedidosService.updateEstado() (ver SRS):
//   - 'En preparación' -> el usuario sabe que su pedido entró a la cocina
//   - 'Listo'          -> el usuario puede ir a retirarlo
//
// Reglas:
//   - Nunca lanza excepciones hacia el flujo de pedidos: un fallo de FCM no
//     puede dejar el pedido sin actualizar.
//   - Los tokens que FCM reporta como inválidos se desactivan solos para no
//     reintentar contra un dispositivo que ya no existe.
//   - Un token caído no impide enviar a los demás (Promise.allSettled).

const supabase = require('../../config/supabase');
const DispositivosService = require('./dispositivos.service');
const FcmService = require('./fcm.service');

const CafeteriasTable = 'cafeterias';

const EVENTOS = {
  en_preparacion: {
    titulo: 'Tu pedido está en preparación',
    cuerpo: (pedido, cafeteria) =>
      `El pedido #${codigoDe(pedido)} en ${cafeteria} ya entró a la cocina. Te avisaremos cuando esté listo.`
  },
  listo: {
    titulo: 'Tu pedido está listo para retirar',
    cuerpo: (pedido, cafeteria) =>
      `Pasa a retirar tu pedido #${codigoDe(pedido)} en ${cafeteria}.`
  }
};

function codigoDe(pedido) {
  return pedido.codigo_legible || pedido.codigo_retiro_diario || pedido.id;
}

function estadoDesdeEvento(evento) {
  return evento === 'listo' ? 'Listo' : 'En preparación';
}

async function obtenerNombreCafeteria(cafeteriaId) {
  if (!cafeteriaId) return 'la cafetería';
  try {
    const { data, error } = await supabase
      .from(CafeteriasTable)
      .select('nombre')
      .eq('id', cafeteriaId)
      .maybeSingle();
    if (error || !data) return 'la cafetería';
    return data.nombre || 'la cafetería';
  } catch (error) {
    return 'la cafetería';
  }
}

const NotificacionesService = {
  eventos: Object.keys(EVENTOS),

  /** Configuración efectiva de FCM (modo real o simulación). */
  estado() {
    return { ...FcmService.estado(), eventos: NotificacionesService.eventos };
  },

  /**
   * Notifica a todos los dispositivos activos del usuario que hizo el pedido.
   * @param {object} pedido  pedido normalizado (codigo_legible, usuario_id, cafeteria_id)
   * @param {'en_preparacion'|'listo'} evento
   * @returns {Promise<object>} resumen con el detalle de cada envío
   */
  async notificarPedido(pedido, evento) {
    const resumen = {
      evento,
      pedido_id: pedido && pedido.id,
      usuario_id: pedido && pedido.usuario_id,
      modo: FcmService.modo(),
      total_tokens: 0,
      enviados: 0,
      fallidos: 0,
      tokens_invalidos: 0,
      resultados: []
    };

    try {
      const definicion = EVENTOS[evento];
      if (!definicion) throw new Error(`Evento de notificación desconocido: ${evento}`);
      if (!pedido || !pedido.usuario_id) {
        resumen.omitido = 'El pedido no tiene usuario asignado';
        return resumen;
      }

      const dispositivos = await DispositivosService.getActivosByUsuario(pedido.usuario_id);
      resumen.total_tokens = dispositivos.length;

      if (dispositivos.length === 0) {
        resumen.omitido = 'El usuario no tiene dispositivos registrados';
        return resumen;
      }

      const cafeteria = await obtenerNombreCafeteria(pedido.cafeteria_id);
      const titulo = definicion.titulo;
      const cuerpo = definicion.cuerpo(pedido, cafeteria);
      const data = {
        tipo: `pedido_${evento}`,
        pedido_id: String(pedido.id),
        codigo: String(codigoDe(pedido)),
        estado: estadoDesdeEvento(evento)
      };

      const resultados = await Promise.allSettled(
        dispositivos.map((dispositivo) =>
          FcmService.enviar({
            token: dispositivo.token_fcm,
            titulo,
            cuerpo,
            data
          })
        )
      );

      const tokensInvalidos = [];

      resultados.forEach((resultado, indice) => {
        const token = dispositivos[indice].token_fcm;
        if (resultado.status === 'fulfilled') {
          resumen.enviados += 1;
          resumen.resultados.push({
            token: recortar(token),
            ok: true,
            modo: resultado.value.modo,
            id: resultado.value.id
          });
        } else {
          resumen.fallidos += 1;
          const error = resultado.reason || {};
          if (error.tokenInvalido) tokensInvalidos.push(token);
          resumen.resultados.push({
            token: recortar(token),
            ok: false,
            codigo: error.codigoFcm || null,
            error: error.message || 'Error desconocido'
          });
        }
      });

      if (tokensInvalidos.length > 0) {
        try {
          resumen.tokens_invalidos = await DispositivosService.desactivarPorTokens(tokensInvalidos);
        } catch (errorDesactivar) {
          resumen.aviso_desactivacion = errorDesactivar.message;
        }
      }

      return resumen;
    } catch (error) {
      resumen.error = error.message;
      return resumen;
    }
  },

  /** Envío manual para que el equipo móvil valide su token. */
  async notificarPrueba(usuarioId) {
    return NotificacionesService.notificarPedido(
      { id: 0, usuario_id: usuarioId, cafeteria_id: null },
      'en_preparacion'
    );
  }
};

function recortar(token) {
  const texto = String(token);
  return texto.length > 16 ? `${texto.slice(0, 8)}…${texto.slice(-6)}` : texto;
}

module.exports = NotificacionesService;
