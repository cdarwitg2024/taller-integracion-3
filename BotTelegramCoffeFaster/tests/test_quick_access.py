import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram import Update, Message, Chat, User, CallbackQuery
from app.bot.handlers import (
    obtener_teclado_accesos_rapidos,
    obtener_inline_accesos_rapidos,
    generar_texto_stock_general,
    generar_texto_stock_bajo,
    generar_texto_productos_agotados,
    generar_texto_mi_cafeteria,
    cmd_stock_general,
    cmd_stock_bajo,
    cmd_productos_agotados,
    cmd_mi_cafeteria,
    handle_boton_acceso_rapido,
    handle_callback_query,
)

def test_teclado_accesos_rapidos():
    teclado = obtener_teclado_accesos_rapidos()
    assert teclado.is_persistent is True
    assert teclado.resize_keyboard is True
    assert len(teclado.keyboard) == 4
    # Fila 1: 1 botón a lo ancho
    assert len(teclado.keyboard[0]) == 1
    assert teclado.keyboard[0][0].text == "📦 Consultar stock"
    # Fila 2: 2 botones lado a lado
    assert len(teclado.keyboard[1]) == 2
    assert teclado.keyboard[1][0].text == "⚠️ Stock bajo"
    assert teclado.keyboard[1][1].text == "🔴 Agotados"
    # Fila 3: 1 botón a lo ancho
    assert len(teclado.keyboard[2]) == 1
    assert teclado.keyboard[2][0].text == "🔔 Historial de alertas"
    # Fila 4: 1 botón a lo ancho
    assert len(teclado.keyboard[3]) == 1
    assert teclado.keyboard[3][0].text == "👤 Mi Cafetería"

def test_inline_accesos_rapidos():
    inline = obtener_inline_accesos_rapidos()
    callback_datas = [btn.callback_data for row in inline.inline_keyboard for btn in row]
    assert "cb_stock_general" in callback_datas
    assert "cb_stock_bajo" in callback_datas
    assert "cb_stock_agotados" in callback_datas
    assert "cb_alertas" in callback_datas
    assert "cb_mi_cafeteria" in callback_datas

def test_generar_texto_stock_general():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}
    prods = [
        {"id": 1, "nombre": "Café Grano", "stock": 0, "stock_minimo": 10},
        {"id": 2, "nombre": "Leche Entera", "stock": 5, "stock_minimo": 10},
        {"id": 3, "nombre": "Muffin", "stock": 25, "stock_minimo": 10},
    ]
    texto = generar_texto_stock_general(dueno, prods)
    assert "Inventario General" in texto
    assert "Café Central" in texto
    assert "🔴 Agotados: <b>1</b>" in texto
    assert "🟡 Con stock bajo: <b>1</b>" in texto
    assert "🟢 En nivel óptimo: <b>1</b>" in texto
    assert "🔴 <b>Café Grano</b>" in texto
    assert "🟡 <b>Leche Entera</b>" in texto
    assert "🟢 <b>Muffin</b>" in texto

def test_generar_texto_stock_bajo_con_productos():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}
    prods = [
        {"id": 2, "nombre": "Leche Entera", "stock": 5, "stock_minimo": 10},
    ]
    texto = generar_texto_stock_bajo(dueno, prods)
    assert "Productos con Stock Bajo" in texto
    assert "Leche Entera" in texto
    assert "Cantidad disponible: <b>5</b>" in texto

def test_generar_texto_stock_bajo_vacio():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}
    texto = generar_texto_stock_bajo(dueno, [])
    assert "Sin Productos con Stock Bajo" in texto
    assert "cantidades suficientes" in texto

def test_generar_texto_productos_agotados_con_productos():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}
    prods = [
        {"id": 1, "nombre": "Café Grano", "stock": 0, "stock_minimo": 10},
    ]
    texto = generar_texto_productos_agotados(dueno, prods)
    assert "Productos Agotados" in texto
    assert "Café Grano" in texto
    assert "Cantidad disponible: <b>0 unidades</b>" in texto

def test_generar_texto_productos_agotados_vacio():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}
    texto = generar_texto_productos_agotados(dueno, [])
    assert "Sin Productos Agotados" in texto
    assert "No hay quiebres de stock" in texto

def test_generar_texto_mi_cafeteria():
    dueno = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1, "notificaciones_activas": True}
    texto = generar_texto_mi_cafeteria(dueno, 12345, db_ok=True)
    assert "Mi Cafetería" in texto
    assert "Café Central" in texto
    assert "Carlos" in texto
    assert "12345" in texto
    assert "Conectada (Supabase)" in texto

@pytest.mark.asyncio
async def test_handle_boton_acceso_rapido_dispara_consultas():
    # Mocking Update and Context
    update = MagicMock(spec=Update)
    message = MagicMock(spec=Message)
    chat = MagicMock(spec=Chat)
    chat.id = 12345
    message.chat = chat
    message.reply_text = AsyncMock()
    update.effective_chat = chat
    update.effective_message = message
    context = MagicMock()

    with patch("app.bot.handlers.cmd_stock_general", new_callable=AsyncMock) as mock_general, \
         patch("app.bot.handlers.cmd_stock_bajo", new_callable=AsyncMock) as mock_bajo, \
         patch("app.bot.handlers.cmd_productos_agotados", new_callable=AsyncMock) as mock_agotados, \
         patch("app.bot.handlers.cmd_mi_cafeteria", new_callable=AsyncMock) as mock_cafeteria:

        # Test botón "📦 Consultar stock"
        message.text = "📦 Consultar stock"
        await handle_boton_acceso_rapido(update, context)
        mock_general.assert_awaited_once_with(update, context)

        # Test botón "⚠️ Stock bajo" (formato referencia)
        message.text = "⚠️ Stock bajo"
        await handle_boton_acceso_rapido(update, context)
        mock_bajo.assert_awaited_once_with(update, context)

        # Test botón "🔴 Agotados" (formato referencia)
        message.text = "🔴 Agotados"
        await handle_boton_acceso_rapido(update, context)
        mock_agotados.assert_awaited_once_with(update, context)

        # Test botón "👤 Mi Cafetería" (formato referencia)
        message.text = "👤 Mi Cafetería"
        await handle_boton_acceso_rapido(update, context)
        mock_cafeteria.assert_awaited_once_with(update, context)

@pytest.mark.asyncio
async def test_handle_callback_query_dispara_consultas():
    update = MagicMock(spec=Update)
    query = MagicMock(spec=CallbackQuery)
    message = MagicMock(spec=Message)
    chat = MagicMock(spec=Chat)
    chat.id = 12345
    message.chat = chat
    message.edit_text = AsyncMock()
    message.reply_text = AsyncMock()
    query.message = message
    query.answer = AsyncMock()
    update.callback_query = query
    context = MagicMock()

    dueno_data = {"dueno_nombre": "Carlos", "cafeteria_nombre": "Café Central", "cafeteria_id": 1}

    with patch("app.bot.handlers.db_repo.verificar_dueno_autorizado", return_value=dueno_data), \
         patch("app.bot.handlers.responder_stock_general", new_callable=AsyncMock) as mock_resp_general, \
         patch("app.bot.handlers.responder_stock_bajo", new_callable=AsyncMock) as mock_resp_bajo, \
         patch("app.bot.handlers.responder_productos_agotados", new_callable=AsyncMock) as mock_resp_agotados, \
         patch("app.bot.handlers.responder_mi_cafeteria", new_callable=AsyncMock) as mock_resp_cafeteria:

        query.data = "cb_stock_general"
        await handle_callback_query(update, context)
        mock_resp_general.assert_awaited_once()

        query.data = "cb_stock_bajo"
        await handle_callback_query(update, context)
        mock_resp_bajo.assert_awaited_once()

        query.data = "cb_stock_agotados"
        await handle_callback_query(update, context)
        mock_resp_agotados.assert_awaited_once()

        query.data = "cb_mi_cafeteria"
        await handle_callback_query(update, context)
        mock_resp_cafeteria.assert_awaited_once()

def test_db_repo_consultas():
    from app.infrastructure.database import db_repo
    if not db_repo.verificar_conexion():
        pytest.skip("Base de datos no disponible para prueba de integración")

    test_chat = 999111222
    prev_row = None
    with db_repo.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT usuario_id, cafeteria_id, telegram_chat_id, notificaciones_activas FROM configuracion_telegram_dueno WHERE usuario_id = 1;")
            prev_row = cur.fetchone()
            cur.execute("DELETE FROM configuracion_telegram_dueno WHERE usuario_id = 1 OR telegram_chat_id = %s;", (test_chat,))
            cur.execute(
                "INSERT INTO configuracion_telegram_dueno (usuario_id, cafeteria_id, telegram_chat_id, notificaciones_activas) VALUES (1, 1, %s, true);",
                (test_chat,)
            )
            conn.commit()

    try:
        dueno = db_repo.verificar_dueno_autorizado(test_chat)
        assert dueno is not None
        assert dueno["dueno_nombre"] == "Carlos"

        prods_general = db_repo.obtener_stock_general(test_chat)
        assert isinstance(prods_general, list)

        prods_bajo = db_repo.obtener_productos_stock_bajo(test_chat, umbral=10)
        assert isinstance(prods_bajo, list)

        prods_agotados = db_repo.obtener_productos_agotados(test_chat)
        assert isinstance(prods_agotados, list)
    finally:
        with db_repo.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM configuracion_telegram_dueno WHERE usuario_id = 1 OR telegram_chat_id = %s;", (test_chat,))
                if prev_row:
                    cur.execute(
                        "INSERT INTO configuracion_telegram_dueno (usuario_id, cafeteria_id, telegram_chat_id, notificaciones_activas) VALUES (%s, %s, %s, %s);",
                        prev_row
                    )
                conn.commit()
