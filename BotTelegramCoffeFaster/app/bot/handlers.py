import logging
from datetime import datetime, timezone
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes
from app.infrastructure.subscriber_repo import subscriber_repo
from app.infrastructure.database import db_repo
from app.infrastructure.telegram_client import telegram_client

logger = logging.getLogger(__name__)

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador del comando /start con autenticación estricta para el Dueño."""
    if not update.effective_chat:
        return

    chat_id = update.effective_chat.id
    user_name = update.effective_user.first_name if update.effective_user else "Usuario"

    # Verificar si el chat_id está vinculado a un Dueño activo en la base de datos
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
        f"Recibirás avisos inmediatos en tiempo real cuando cualquier producto en barra "
        f"cruce el umbral crítico (≤ 10 unidades).\n\n"
        f"<b>Comandos disponibles:</b>\n"
        f"• /stock - Planilla de productos con stock bajo en tu cafetería (≤ 10 un.)\n"
        f"• /alertas - Historial reciente de avisos de reposición\n"
        f"• /estado - Estado de vinculación y conexión a la base de datos\n"
        f"• /test_alerta - Simular alerta de stock bajo (🟡)\n"
        f"• /test_sin_stock - Simular alerta de sin stock (🔴)\n"
        f"• /ayuda - Protocolo de actuación para reposición\n"
        f"• /desuscribir - Pausar temporalmente las notificaciones automáticas\n"
    )
    await update.message.reply_text(mensaje, parse_mode=ParseMode.HTML)

async def cmd_ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Protocolo y guía de actuación para el Dueño de Cafetería."""
    mensaje = (
        f"<b>Protocolo Operativo de Inventario - CoffeeFaster</b>\n\n"
        f"<b>¿Cómo se generan las alertas automáticas?</b>\n"
        f"Cada vez que se registra una venta en el sistema y el stock de un producto baja de más de 10 "
        f"a 10 o menos unidades, el sistema dispara una notificación directa y privada al Dueño vinculado.\n\n"
        f"<b>Regla Antispam (BR-06):</b>\n"
        f"Solo recibirás <b>una alerta</b> al momento exacto en que el producto cruza el umbral crítico. "
        f"No se enviarán mensajes repetitivos por cada venta subsiguiente mientras el producto siga bajo 10.\n\n"
        f"<b>Protocolo de Reposición en Barra:</b>\n"
        f"1. <b>Revisión inmediata:</b> Verificar disponibilidad en bodega interna.\n"
        f"2. <b>Reposición:</b> Trasladar unidades a la estación de baristas.\n"
        f"3. <b>Alerta de Quiebre:</b> Si no hay existencias en bodega, gestionar compra urgente.\n"
        f"4. <b>Stock 0:</b> Si se agota por completo, pausar producto en el sistema de ventas.\n\n"
        f"<b>Comandos de supervisión:</b>\n"
        f"• /stock : Ver qué productos requieren reposición ahora.\n"
        f"• /alertas : Ver últimas alertas registradas.\n"
        f"• /estado : Ver conexiones y estado de vinculación.\n"
    )
    await update.message.reply_text(mensaje, parse_mode=ParseMode.HTML)

async def cmd_estado(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el estado operativo del sistema y la vinculación de seguridad."""
    if not update.effective_chat:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)
    db_ok = db_repo.verificar_conexion()

    estado_db = "Conectada (Supabase)" if db_ok else "Sin conexión"

    if dueno:
        estado_disp = f"Vinculado como Dueño ({dueno['dueno_nombre']})"
        cafeteria_linea = f"<b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n"
        acceso_linea = "<b>Acceso a Inventario:</b> Habilitado y Seguro"
    else:
        estado_disp = "NO VINCULADO / DESVINCULADO"
        cafeteria_linea = "<b>Cafetería Asignada:</b> Ninguna (Sin permisos)\n"
        acceso_linea = "<b>Acceso a Inventario:</b> BLOQUEADO POR SEGURIDAD"

    mensaje = (
        f"<b>Panel Operativo y de Seguridad - CoffeeFaster</b>\n\n"
        f"<b>Canal de Telegram:</b> Operativo\n"
        f"<b>Base de Datos:</b> {estado_db}\n"
        f"<b>Dispositivo:</b> {estado_disp}\n"
        f"<b>Tu Chat ID:</b> <code>{chat_id}</code>\n"
        f"{cafeteria_linea}"
        f"{acceso_linea}\n"
    )
    await update.message.reply_text(mensaje, parse_mode=ParseMode.HTML)

async def cmd_alertas(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Muestra el historial de alertas recientes EXCLUSIVAS de la cafetería del Dueño."""
    if not update.effective_chat:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n"
            f"Por seguridad, la base de datos no expone información confidencial.\n\n"
            f"Tu Chat ID: <code>{chat_id}</code>",
            parse_mode=ParseMode.HTML
        )
        return

    alertas = db_repo.obtener_ultimas_alertas(chat_id=chat_id, limite=5)

    if not alertas:
        await update.message.reply_text(
            f"<b>Sin alertas registradas:</b>\n"
            f"<b>Dueño:</b> {dueno['dueno_nombre']}\n"
            f"<b>Cafetería:</b> {dueno['cafeteria_nombre']}\n\n"
            f"No se han reportado quiebres ni niveles críticos en tu cafetería.",
            parse_mode=ParseMode.HTML
        )
        return

    texto = (
        f"<b>Historial de Alertas de Reposición</b>\n"
        f"<b>Dueño Responsable:</b> {dueno['dueno_nombre']}\n"
        f"<b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n\n"
    )
    for a in alertas:
        prod_nom = a.get("producto_nombre") or "Insumo de Barra"
        stock = a.get("stock_actual", 0)
        stock_min = a.get("stock_minimo", 10)
        fecha = a.get("creado_en")
        fecha_str = fecha.strftime("%d/%m/%Y %H:%M") if hasattr(fecha, "strftime") else str(fecha)
        if stock <= 0:
            icono = "🔴"
            estado = "Sin stock"
        else:
            icono = "🟡"
            estado = "Stock bajo"
        msg = a.get("mensaje") or ""

        texto += (
            f"{icono} <b>{prod_nom}</b> ({estado})\n"
            f"  Cantidad disponible: <b>{stock}</b>\n"
            f"  Mínimo que deberían existir: <b>{stock_min}</b>\n"
            f"  Fecha de registro: {fecha_str}\n"
        )
        if msg:
            texto += f"  <i>{msg}</i>\n"
        texto += "\n"

    texto += f"<i>Alertas exclusivas del Dueño ({dueno['dueno_nombre']}) en {dueno['cafeteria_nombre']}.</i>"
    await update.message.reply_text(texto, parse_mode=ParseMode.HTML)

async def cmd_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Planilla de reposición rápida EXCLUSIVA de la cafetería del Dueño."""
    if not update.effective_chat:
        return

    chat_id = update.effective_chat.id
    dueno = db_repo.verificar_dueno_autorizado(chat_id)

    if not dueno:
        await update.message.reply_text(
            f"<b>Acceso denegado:</b> Este chat no está vinculado como Dueño autorizado.\n\n"
            f"Si desvinculaste tu cuenta o aún no la configuras, ingresa a la App de Escritorio "
            f"para vincular tu Chat ID: <code>{chat_id}</code>.",
            parse_mode=ParseMode.HTML
        )
        return

    prods = db_repo.obtener_productos_stock_bajo(chat_id=chat_id, umbral=10)

    if not prods:
        await update.message.reply_text(
            f"<b>Inventario Óptimo</b>\n"
            f"<b>Dueño Responsable:</b> {dueno['dueno_nombre']}\n"
            f"<b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']}\n\n"
            f"Todos los productos en barra se encuentran en niveles óptimos. No se requieren reposiciones inmediatas.",
            parse_mode=ParseMode.HTML
        )
        return

    texto = (
        f"<b>Planilla de Stock Crítico</b>\n"
        f"<b>Dueño Responsable:</b> {dueno['dueno_nombre']}\n"
        f"<b>Cafetería Asignada:</b> {dueno['cafeteria_nombre']} (ID #{dueno['cafeteria_id']})\n\n"
        f"<i>Insumos en nivel crítico o que requieren reposición en tu cafetería:</i>\n\n"
    )
    for p in prods:
        if p["stock"] <= 0:
            icono = "🔴"
            estado = "Sin stock"
        else:
            icono = "🟡"
            estado = "Stock bajo"

        texto += (
            f"{icono} <b>{p['nombre']}</b> (ID: #{p['id']})\n"
            f"  Cantidad disponible: <b>{p['stock']}</b>\n"
            f"  Mínimo que deberían existir: <b>{p['stock_minimo']}</b>\n"
            f"  Estado: <i>{estado}</i>\n\n"
        )

    texto += f"<i>Inventario exclusivo de {dueno['cafeteria_nombre']}.</i>"
    await update.message.reply_text(texto, parse_mode=ParseMode.HTML)

async def cmd_suscribir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reactiva la recepción de alertas para el Dueño vinculado."""
    if not update.effective_chat:
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
            parse_mode=ParseMode.HTML
        )
    else:
        await update.message.reply_text("Las alertas ya se encontraban activadas en este dispositivo.")

async def cmd_desuscribir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Pausa temporalmente la recepción de alertas en el dispositivo del Dueño."""
    if not update.effective_chat:
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
    if not update.effective_chat:
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

    # Permitir /test_alerta sin_stock o 0 para simular sin stock
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
    await update.message.reply_text(
        mensaje_html,
        parse_mode=ParseMode.HTML
    )

async def cmd_test_sin_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Envía una simulación de alerta de Sin Stock con círculo rojo (🔴)."""
    if not update.effective_chat:
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
    await update.message.reply_text(
        mensaje_html,
        parse_mode=ParseMode.HTML
    )
