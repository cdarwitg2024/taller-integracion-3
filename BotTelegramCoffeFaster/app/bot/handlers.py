import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from telegram import (
    Update,
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from telegram.constants import ParseMode
from telegram.ext import ContextTypes
from telegram.error import BadRequest
from app.infrastructure.subscriber_repo import subscriber_repo
from app.infrastructure.database import db_repo
from app.infrastructure.telegram_client import telegram_client

logger = logging.getLogger(__name__)


# ==========================================
# Componentes UI de Accesos Rápidos
# ==========================================

def obtener_teclado_accesos_rapidos() -> ReplyKeyboardMarkup:
    """Genera el teclado interactivo persistente en pantalla al estilo de la referencia (1 - 2 - 1 - 1)."""
    botones = [
        [KeyboardButton("📦 Consultar stock")],
        [KeyboardButton("⚠️ Stock bajo"), KeyboardButton("🔴 Agotados")],
        [KeyboardButton("🔔 Historial de alertas")],
        [KeyboardButton("👤 Mi Cafetería")]
    ]
    return ReplyKeyboardMarkup(botones, resize_keyboard=True, is_persistent=True)


def obtener_inline_accesos_rapidos() -> InlineKeyboardMarkup:
    """Genera el panel inline de botones para consultas frecuentes."""
    botones = [
        [InlineKeyboardButton("📦 Consultar stock general", callback_data="cb_stock_general")],
        [
            InlineKeyboardButton("⚠️ Stock bajo", callback_data="cb_stock_bajo"),
            InlineKeyboardButton("🔴 Agotados", callback_data="cb_stock_agotados")
        ],
        [InlineKeyboardButton("🔔 Historial de alertas", callback_data="cb_alertas")],
        [InlineKeyboardButton("👤 Mi Cafetería", callback_data="cb_mi_cafeteria")]
    ]
    return InlineKeyboardMarkup(botones)


async def enviar_o_editar(mensaje_obj, texto: str, reply_markup=None, edit: bool = False):
    """Envía un mensaje nuevo o edita el actual si proviene de un callback query."""
    if edit and hasattr(mensaje_obj, "edit_text"):
        try:
            await mensaje_obj.edit_text(texto, parse_mode=ParseMode.HTML, reply_markup=reply_markup)
            return
        except BadRequest as e:
            if "Message is not modified" in str(e):
                return
            logger.debug(f"No se pudo editar mensaje inline, enviando nuevo: {e}")
    await mensaje_obj.reply_text(texto, parse_mode=ParseMode.HTML, reply_markup=reply_markup)


# ==========================================
# Generadores de Formato para Consultas
# ==========================================

def generar_texto_stock_general(dueno: Dict[str, Any], prods: List[Dict[str, Any]]) -> str:
    """Formatea la planilla de stock general con resumen ejecutivo."""
    total = len(prods)
    agotados = [p for p in prods if p.get("stock", 0) <= 0]
    bajos = [p for p in prods if 0 < p.get("stock", 0) <= max(p.get("stock_minimo", 10), 10)]
    optimos = [p for p in prods if p.get("stock", 0) > max(p.get("stock_minimo", 10), 10)]

    texto = (
        f"📦 <b>Inventario General - {dueno['cafeteria_nombre']}</b>\n"
        f"<b>Dueño Responsable:</b> {dueno['dueno_nombre']} (ID #{dueno['cafeteria_id']})\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"📊 <b>Resumen de existencias:</b>\n"
        f"• Total productos: <b>{total}</b>\n"
        f"• 🟢 En nivel óptimo: <b>{len(optimos)}</b>\n"
        f"• 🟡 Con stock bajo: <b>{len(bajos)}</b>\n"
        f"• 🔴 Agotados: <b>{len(agotados)}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"<b>Detalle de insumos:</b>\n\n"
    )

    if not prods:
        texto += "<i>No hay productos registrados en el inventario de esta cafetería.</i>\n"
        return texto

    for p in prods:
        stock = p.get("stock", 0)
        stock_min = p.get("stock_minimo", 10)
        nombre = p.get("nombre", "Producto")
        prod_id = p.get("id")

        if stock <= 0:
            icono = "🔴"
            tag = " [Agotado]"
        elif stock <= stock_min or stock <= 10:
            icono = "🟡"
            tag = " [Stock bajo]"
        else:
            icono = "🟢"
            tag = ""

        texto += f"{icono} <b>{nombre}</b> (#{prod_id}): <b>{stock}</b> unid. (Mín: {stock_min}){tag}\n"

    texto += f"\n<i>Inventario activo de {dueno['cafeteria_nombre']}.</i>"
    return texto


def generar_texto_stock_bajo(dueno: Dict[str, Any], prods: List[Dict[str, Any]]) -> str:
    """Formatea la lista de productos que requieren reposición."""
    if not prods:
        return (
            f"✅ <b>Sin Productos con Stock Bajo</b>\n"
            f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
            f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n\n"
            f"Todos los productos en barra cuentan con cantidades suficientes sobre el umbral mínimo (10 unidades).\n"
            f"<i>No se requieren reposiciones inmediatas.</i>"
        )

    texto = (
        f"⚠️ <b>Productos con Stock Bajo</b>\n"
        f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
        f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"<i>Insumos en nivel crítico que requieren reposición en barra:</i>\n\n"
    )
    for p in prods:
        texto += (
            f"🟡 <b>{p['nombre']}</b> (ID #{p['id']})\n"
            f"  • Cantidad disponible: <b>{p['stock']}</b> unidades\n"
            f"  • Mínimo requerido: <b>{p['stock_minimo']}</b> unidades\n"
            f"  • Estado: <i>Requiere reposición prioritaria</i>\n\n"
        )
    texto += f"<i>Mostrando {len(prods)} productos con stock bajo en {dueno['cafeteria_nombre']}.</i>"
    return texto


def generar_texto_productos_agotados(dueno: Dict[str, Any], prods: List[Dict[str, Any]]) -> str:
    """Formatea la lista de productos con quiebre de stock total."""
    if not prods:
        return (
            f"✅ <b>Sin Productos Agotados</b>\n"
            f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
            f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n\n"
            f"¡Excelente noticia! No hay quiebres de stock en este momento. Todos los productos registrados cuentan con unidades disponibles para la venta."
        )

    texto = (
        f"🔴 <b>Productos Agotados (Quiebre de Stock)</b>\n"
        f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
        f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"<i>¡Atención! Insumos con 0 existencias que no pueden comercializarse:</i>\n\n"
    )
    for p in prods:
        texto += (
            f"🔴 <b>{p['nombre']}</b> (ID #{p['id']})\n"
            f"  • Cantidad disponible: <b>0 unidades</b>\n"
            f"  • Mínimo configurado: <b>{p['stock_minimo']}</b> unidades\n"
            f"  • Acción: <i>Gestionar reposición urgente desde bodega o pausar en app de ventas</i>\n\n"
        )
    texto += f"<i>Mostrando {len(prods)} productos agotados en {dueno['cafeteria_nombre']}.</i>"
    return texto


def generar_texto_alertas(dueno: Dict[str, Any], alertas: List[Dict[str, Any]]) -> str:
    """Formatea el historial de alertas recientes."""
    if not alertas:
        return (
            f"<b>Sin alertas registradas:</b>\n"
            f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
            f"<b>Cafetería:</b> {dueno['cafeteria_nombre']}\n\n"
            f"No se han reportado quiebres ni niveles críticos recientemente."
        )

    texto = (
        f"<b>Historial de Alertas de Reposición</b>\n"
        f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
        f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n\n"
    )
    for a in alertas:
        prod_nom = a.get("producto_nombre") or "Insumo de Barra"
        stock = a.get("stock_actual", 0)
        stock_min = a.get("stock_minimo", 10)
        fecha = a.get("creado_en")
        fecha_str = fecha.strftime("%d/%m/%Y %H:%M") if hasattr(fecha, "strftime") else str(fecha)
        icono = "🔴" if stock <= 0 else "🟡"
        estado = "Sin stock" if stock <= 0 else "Stock bajo"
        msg = a.get("mensaje") or ""

        texto += (
            f"{icono} <b>{prod_nom}</b> ({estado})\n"
            f"  Cantidad disponible: <b>{stock}</b> (Mínimo: {stock_min})\n"
            f"  Fecha: {fecha_str}\n"
        )
        if msg:
            texto += f"  <i>{msg}</i>\n"
        texto += "\n"

    texto += f"<i>Alertas exclusivas de {dueno['cafeteria_nombre']}.</i>"
    return texto


def generar_texto_estado(dueno: Optional[Dict[str, Any]], chat_id: int, db_ok: bool) -> str:
    """Formatea la tarjeta de estado operativo del sistema."""
    estado_db = "Conectada (Supabase)" if db_ok else "Sin conexión"
    if dueno:
        estado_disp = f"Vinculado como Dueño ({dueno['dueno_nombre']})"
        cafeteria_linea = f"<b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        acceso_linea = "<b>Acceso a Inventario:</b> Habilitado y Seguro"
    else:
        estado_disp = "NO VINCULADO / DESVINCULADO"
        cafeteria_linea = "<b>Cafetería Asignada:</b> Ninguna (Sin permisos)\n"
        acceso_linea = "<b>Acceso a Inventario:</b> BLOQUEADO POR SEGURIDAD"

    return (
        f"<b>Panel Operativo y de Seguridad - CoffeeFaster</b>\n\n"
        f"<b>Canal de Telegram:</b> Operativo\n"
        f"<b>Base de Datos:</b> {estado_db}\n"
        f"<b>Dispositivo:</b> {estado_disp}\n"
        f"<b>Tu Chat ID:</b> <code>{chat_id}</code>\n"
        f"{cafeteria_linea}"
        f"{acceso_linea}\n"
    )


def generar_texto_mi_cafeteria(dueno: Optional[Dict[str, Any]], chat_id: int, db_ok: bool) -> str:
    """Formatea la tarjeta de información del Dueño y su Cafetería."""
    estado_db = "🟢 Conectada (Supabase)" if db_ok else "🔴 Sin conexión"
    if not dueno:
        return (
            f"👤 <b>Perfil de Usuario - CoffeeFaster</b>\n\n"
            f"<b>Dispositivo:</b> 🔴 NO VINCULADO\n"
            f"<b>Tu Chat ID:</b> <code>{chat_id}</code>\n\n"
            f"<i>Para vincular este chat, abre la App de Escritorio, dirígete a Inventario -> Telegram e ingresa tu Chat ID.</i>"
        )

    notif_estado = "🟢 Activas" if dueno.get("notificaciones_activas", True) else "🟡 En pausa (/suscribir)"

    return (
        f"👤 <b>Mi Cafetería - Panel del Dueño</b>\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"🏪 <b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        f"👤 <b>Dueño Responsable:</b> {dueno['dueno_nombre']}\n"
        f"📱 <b>Chat ID Telegram:</b> <code>{chat_id}</code>\n"
        f"🔔 <b>Alertas Automáticas:</b> {notif_estado}\n"
        f"🗄️ <b>Base de Datos:</b> {estado_db}\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"<i>Dispositivo verificado con permisos de supervisión de inventario y recepción de alertas automáticas.</i>"
    )


# ==========================================
# Respuestas Ejecutoras de Consulta
# ==========================================

async def responder_stock_general(target_message, dueno: Dict[str, Any], chat_id: int, edit: bool = False):
    """Ejecuta y responde la consulta de stock general."""
    prods = db_repo.obtener_stock_general(chat_id=chat_id)
    texto = generar_texto_stock_general(dueno, prods)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⚠️ Ver stock bajo", callback_data="cb_stock_bajo"),
            InlineKeyboardButton("🔴 Ver agotados", callback_data="cb_stock_agotados")
        ],
        [InlineKeyboardButton("🔄 Actualizar inventario", callback_data="cb_stock_general")]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


async def responder_stock_bajo(target_message, dueno: Dict[str, Any], chat_id: int, edit: bool = False):
    """Ejecuta y responde la consulta de productos con stock bajo."""
    prods = db_repo.obtener_productos_stock_bajo(chat_id=chat_id, umbral=10)
    texto = generar_texto_stock_bajo(dueno, prods)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📦 Ver todo el stock", callback_data="cb_stock_general"),
            InlineKeyboardButton("🔴 Ver agotados", callback_data="cb_stock_agotados")
        ],
        [InlineKeyboardButton("🔄 Actualizar", callback_data="cb_stock_bajo")]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


async def responder_productos_agotados(target_message, dueno: Dict[str, Any], chat_id: int, edit: bool = False):
    """Ejecuta y responde la consulta de productos agotados."""
    prods = db_repo.obtener_productos_agotados(chat_id=chat_id)
    texto = generar_texto_productos_agotados(dueno, prods)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📦 Ver todo el stock", callback_data="cb_stock_general"),
            InlineKeyboardButton("⚠️ Ver stock bajo", callback_data="cb_stock_bajo")
        ],
        [InlineKeyboardButton("🔄 Actualizar", callback_data="cb_stock_agotados")]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


async def responder_alertas(target_message, dueno: Dict[str, Any], chat_id: int, edit: bool = False):
    """Ejecuta y responde la consulta de historial de alertas."""
    alertas = db_repo.obtener_ultimas_alertas(chat_id=chat_id, limite=5)
    texto = generar_texto_alertas(dueno, alertas)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📦 Ver inventario", callback_data="cb_stock_general"),
            InlineKeyboardButton("⚠️ Stock bajo", callback_data="cb_stock_bajo")
        ],
        [InlineKeyboardButton("🔄 Actualizar alertas", callback_data="cb_alertas")]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


async def responder_estado(target_message, dueno: Optional[Dict[str, Any]], chat_id: int, edit: bool = False):
    """Ejecuta y responde el estado del sistema."""
    db_ok = db_repo.verificar_conexion()
    texto = generar_texto_estado(dueno, chat_id, db_ok)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📦 Consultar stock", callback_data="cb_stock_general"),
            InlineKeyboardButton("⚡ Menú principal", callback_data="cb_menu")
        ]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


async def responder_mi_cafeteria(target_message, dueno: Optional[Dict[str, Any]], chat_id: int, edit: bool = False):
    """Ejecuta y responde la consulta de información del Dueño y su cafetería."""
    db_ok = db_repo.verificar_conexion()
    texto = generar_texto_mi_cafeteria(dueno, chat_id, db_ok)
    inline_nav = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📦 Ver inventario general", callback_data="cb_stock_general"),
            InlineKeyboardButton("🔔 Historial de alertas", callback_data="cb_alertas")
        ],
        [
            InlineKeyboardButton("📖 Protocolo de actuación", callback_data="cb_ayuda"),
            InlineKeyboardButton("🔄 Actualizar", callback_data="cb_mi_cafeteria")
        ]
    ])
    await enviar_o_editar(target_message, texto, reply_markup=inline_nav, edit=edit)


# ==========================================
# Manejadores de Comandos
# ==========================================

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador del comando /start con autenticación estricta para el Dueño."""
    if not update.effective_chat or not update.message:
        return

    chat_id = update.effective_chat.id
    user_name = update.effective_user.first_name if update.effective_user else "Usuario"

    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        mensaje = (
            f"<b>¡Hola, {user_name}!</b>\n\n"
            f"<b>Bot de Alertas de Stock - CoffeeFaster</b>\n\n"
            f"<b>Dispositivo NO vinculado:</b>\n"
            f"Este canal es de uso exclusivo y confidencial para el <b>Dueño de Cafetería</b>.\n\n"
            f"Tu Chat ID es: <code>{chat_id}</code>\n\n"
            f"<b>Para autorizar este dispositivo:</b>\n"
            f"1. Abre la <b>App de Escritorio</b> de CoffeeFaster e inicia sesión como Dueño.\n"
            f"2. Dirígete al módulo de <b>Inventario</b> y haz clic en <b>Telegram</b>.\n"
            f"3. Ingresa tu Chat ID (<code>{chat_id}</code>) y confirma la vinculación.\n\n"
            f"<i>Por motivos de seguridad, las consultas de stock y alertas automáticas están bloqueadas para chats no autorizados.</i>"
        )
        await update.message.reply_text(mensaje, parse_mode=ParseMode.HTML)
        return

    # Si está vinculado y autorizado como Dueño
    mensaje = (
        f"<b>¡Bienvenido/a, {dueno['dueno_nombre']}!</b>\n\n"
        f"<b>Panel de Control de Stock - CoffeeFaster</b>\n"
        f"<b>Cafetería:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        f"<b>Estado:</b> Dispositivo vinculado como Dueño autorizado.\n\n"
        f"Utiliza los <b>accesos rápidos</b> a continuación para consultar tu inventario al instante:"
    )
    # Envía teclado interactivo permanente en la interfaz
    await update.message.reply_text(
        mensaje,
        parse_mode=ParseMode.HTML,
        reply_markup=obtener_teclado_accesos_rapidos()
    )
    # Envía panel con botones inline rápidos
    await update.message.reply_text(
        "⚡ <b>Accesos Rápidos para Consultas Frecuentes:</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=obtener_inline_accesos_rapidos()
    )


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el menú interactivo de consultas rápidas."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Debes vincular tu dispositivo como Dueño en la App Desktop.\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return

    await update.message.reply_text(
        f"⚡ <b>Accesos Rápidos para Consultas Frecuentes</b>\n"
        f"<b>Cafetería:</b> {dueno['cafeteria_nombre']}\n\n"
        f"Selecciona una opción para ejecutar la consulta:",
        parse_mode=ParseMode.HTML,
        reply_markup=obtener_inline_accesos_rapidos()
    )


async def cmd_stock_general(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Consulta rápida: Inventario y stock completo de la cafetería."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return
    await responder_stock_general(update.message, dueno, chat_id, edit=False)


async def cmd_stock_bajo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Consulta rápida: Productos en nivel crítico que requieren reposición."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return
    await responder_stock_bajo(update.message, dueno, chat_id, edit=False)


async def cmd_productos_agotados(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Consulta rápida: Productos con existencia 0 (quiebre de stock)."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return
    await responder_productos_agotados(update.message, dueno, chat_id, edit=False)


async def cmd_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Alias para consultar stock."""
    await cmd_stock_general(update, context)


async def cmd_alertas(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el historial de alertas recientes EXCLUSIVAS de la cafetería del Dueño."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return
    await responder_alertas(update.message, dueno, chat_id, edit=False)


async def cmd_estado(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el estado operativo del sistema y la vinculación de seguridad."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    await responder_estado(update.message, dueno, chat_id, edit=False)


async def cmd_mi_cafeteria(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el panel del Dueño y Cafetería vinculada."""
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    await responder_mi_cafeteria(update.message, dueno, chat_id, edit=False)


async def cmd_ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Protocolo y guía de actuación para el Dueño de Cafetería."""
    if not update.message:
        return
    mensaje = (
        f"<b>Protocolo Operativo de Inventario - CoffeeFaster</b>\n\n"
        f"<b>Accesos Rápidos Disponibles:</b>\n"
        f"• <b>📦 Consultar stock:</b> Inventario completo con resumen de existencias.\n"
        f"• <b>⚠️ Stock bajo:</b> Insumos bajo el umbral crítico que requieren reposición.\n"
        f"• <b>🔴 Agotados:</b> Insumos con stock en 0 para compras urgentes.\n"
        f"• <b>🔔 Historial de alertas:</b> Últimos avisos recibidos.\n"
        f"• <b>👤 Mi Cafetería:</b> Perfil del dueño, vinculación y estado del sistema.\n\n"
        f"<b>Protocolo de Reposición en Barra:</b>\n"
        f"1. <b>Revisión inmediata:</b> Verificar disponibilidad en bodega interna.\n"
        f"2. <b>Reposición:</b> Trasladar unidades a la estación de baristas.\n"
        f"3. <b>Alerta de Quiebre:</b> Si no hay existencias en bodega, gestionar compra urgente.\n"
        f"4. <b>Stock 0:</b> Si se agota por completo, pausar producto en el sistema de ventas.\n"
    )
    await update.message.reply_text(
        mensaje,
        parse_mode=ParseMode.HTML,
        reply_markup=obtener_teclado_accesos_rapidos()
    )


# ==========================================
# Manejadores de Interacción Táctil y Callbacks
# ==========================================

async def handle_boton_acceso_rapido(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Captura la pulsación de los botones del teclado persistente (ReplyKeyboard)."""
    if not update.effective_chat or not update.effective_message or not update.effective_message.text:
        return

    texto = update.effective_message.text.strip().lower()

    if "consultar stock" in texto or texto in ("stock", "inventario", "📦", "📦 consultar stock"):
        await cmd_stock_general(update, context)
    elif "stock bajo" in texto or texto in ("bajo", "insumos bajos", "⚠️ stock bajo", "⚠️ productos con stock bajo"):
        await cmd_stock_bajo(update, context)
    elif "agotado" in texto or "sin stock" in texto or texto in ("🔴 agotados", "🔴 productos agotados", "agotados"):
        await cmd_productos_agotados(update, context)
    elif "alerta" in texto or "historial" in texto or texto in ("🔔 historial de alertas", "🔔 alertas"):
        await cmd_alertas(update, context)
    elif "mi cafetería" in texto or "mi cafeteria" in texto or "cafeteria" in texto or "usuario" in texto or "dueño" in texto or texto in ("👤 mi cafetería", "👤 usuario", "👤 perfil"):
        await cmd_mi_cafeteria(update, context)
    elif "estado" in texto or texto in ("ℹ️ estado del sistema", "📊 estado del sistema"):
        await cmd_estado(update, context)
    elif "menu" in texto or "menú" in texto:
        await cmd_menu(update, context)
    elif "ayuda" in texto or "protocolo" in texto:
        await cmd_ayuda(update, context)


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Maneja las interacciones con botones inline (CallbackQuery)."""
    query = update.callback_query
    if not query:
        return

    await query.answer()
    data = query.data
    chat_id = query.message.chat.id if query.message else update.effective_chat.id

    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    if not dueno:
        if query.message:
            await query.message.reply_text(
                f"<b>Acceso denegado:</b> Chat ID no vinculado (<code>{chat_id}</code>).",
                parse_mode=ParseMode.HTML
            )
        return

    if data == "cb_stock_general":
        await responder_stock_general(query.message, dueno, chat_id, edit=True)
    elif data == "cb_stock_bajo":
        await responder_stock_bajo(query.message, dueno, chat_id, edit=True)
    elif data == "cb_stock_agotados":
        await responder_productos_agotados(query.message, dueno, chat_id, edit=True)
    elif data == "cb_alertas":
        await responder_alertas(query.message, dueno, chat_id, edit=True)
    elif data == "cb_mi_cafeteria":
        await responder_mi_cafeteria(query.message, dueno, chat_id, edit=True)
    elif data == "cb_estado":
        await responder_estado(query.message, dueno, chat_id, edit=True)
    elif data == "cb_ayuda":
        mensaje = (
            f"<b>Protocolo Operativo de Inventario - CoffeeFaster</b>\n\n"
            f"<b>Protocolo de Reposición en Barra:</b>\n"
            f"1. <b>Revisión inmediata:</b> Verificar disponibilidad en bodega interna.\n"
            f"2. <b>Reposición:</b> Trasladar unidades a la estación de baristas.\n"
            f"3. <b>Alerta de Quiebre:</b> Si no hay existencias en bodega, gestionar compra urgente.\n"
            f"4. <b>Stock 0:</b> Si se agota por completo, pausar producto en el sistema de ventas.\n"
        )
        inline_nav = InlineKeyboardMarkup([
            [InlineKeyboardButton("📦 Consultar stock", callback_data="cb_stock_general")],
            [InlineKeyboardButton("👤 Volver a Mi Cafetería", callback_data="cb_mi_cafeteria")]
        ])
        await enviar_o_editar(query.message, mensaje, reply_markup=inline_nav, edit=True)
    elif data == "cb_menu":
        await query.message.reply_text(
            f"⚡ <b>Accesos Rápidos para Consultas Frecuentes</b>\n"
            f"<b>Cafetería:</b> {dueno['cafeteria_nombre']}\n\n"
            f"Elige una opción:",
            parse_mode=ParseMode.HTML,
            reply_markup=obtener_inline_accesos_rapidos()
        )


# ==========================================
# Suscripciones y Pruebas
# ==========================================

async def cmd_suscribir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reactiva la recepción de alertas para el Dueño vinculado."""
    if not update.effective_chat or not update.message:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            f"<b>No vinculado:</b> Primero debes vincular este Chat ID (<code>{chat_id}</code>) "
            f"desde la App Desktop de CoffeeFaster con tu cuenta de Dueño.",
            parse_mode=ParseMode.HTML
        )
        return

    activado = db_repo.actualizar_estado_notificaciones(chat_id, activas=True)
    if activado:
        await update.message.reply_text(
            f"<b>Notificaciones activadas:</b> Recibirás alertas automáticas de stock crítico para {dueno['cafeteria_nombre']}.",
            parse_mode=ParseMode.HTML,
            reply_markup=obtener_teclado_accesos_rapidos()
        )
    else:
        await update.message.reply_text("Las alertas ya se encontraban activadas en este dispositivo.")


async def cmd_desuscribir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Pausa temporalmente la recepción de alertas en el dispositivo del Dueño."""
    if not update.effective_chat or not update.message:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            "Este chat no se encuentra vinculado como Dueño en el sistema.",
            parse_mode=ParseMode.HTML
        )
        return

    pausado = db_repo.actualizar_estado_notificaciones(chat_id, activas=False)
    if pausado:
        await update.message.reply_text(
            "<b>Notificaciones pausadas:</b> Ya no recibirás avisos automáticos de reposición.\n"
            "Usa /suscribir cuando desees reactivarlas, o desvincula el chat definitivamente desde la App de Escritorio.",
            parse_mode=ParseMode.HTML
        )
    else:
        await update.message.reply_text("Las alertas ya estaban en pausa.")


async def cmd_test_alerta(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Envía una simulación de alerta orientada exclusivamente al Dueño autorizado."""
    if not update.effective_chat or not update.message:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Debes vincular tu dispositivo como Dueño en la App Desktop antes de probar alertas.\n"
            f"Tu Chat ID es: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return

    es_sin_stock = False
    if context.args and context.args[0].lower() in ("0", "sin_stock", "sinstock", "agotado"):
        es_sin_stock = True

    prods = db_repo.obtener_productos_stock_bajo(chat_id=chat_id, umbral=15)
    prod = prods[0] if prods else {
        "id": 2,
        "nombre": "Leche entera",
        "stock": 5,
        "stock_minimo": 12,
        "cafeteria_id": dueno["cafeteria_id"]
    }

    stock_val = 0 if es_sin_stock else prod.get("stock", 5)

    test_payload = {
        "evento": "ALERTA_STOCK_BAJO",
        "es_prueba": True,
        "destinatario_chat_id": chat_id,
        "dueno_nombre": dueno["dueno_nombre"],
        "producto": {
            "id": prod["id"],
            "nombre": prod["nombre"],
            "stock_actual": stock_val,
            "stock_anterior": stock_val + 6,
            "stock_minimo_configurado": prod.get("stock_minimo", 10),
            "cafeteria_id": dueno["cafeteria_id"]
        },
        "umbral_disparo": 10,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    mensaje_html = telegram_client.formatear_alerta_encargado(test_payload)
    await update.message.reply_text(mensaje_html, parse_mode=ParseMode.HTML)


async def cmd_test_sin_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Envía una simulación de alerta de Sin Stock con círculo rojo (🔴)."""
    if not update.effective_chat or not update.message:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Debes vincular tu dispositivo como Dueño en la App Desktop antes de probar alertas.\n"
            f"Tu Chat ID es: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return

    test_payload = {
        "evento": "ALERTA_STOCK_BAJO",
        "es_prueba": True,
        "destinatario_chat_id": chat_id,
        "dueno_nombre": dueno["dueno_nombre"],
        "producto": {
            "id": 1,
            "nombre": "Café en Grano",
            "stock_actual": 0,
            "stock_anterior": 4,
            "stock_minimo_configurado": 10,
            "cafeteria_id": dueno["cafeteria_id"]
        },
        "umbral_disparo": 10,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    mensaje_html = telegram_client.formatear_alerta_encargado(test_payload)
    await update.message.reply_text(mensaje_html, parse_mode=ParseMode.HTML)
