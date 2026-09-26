import logging
from typing import List, Dict, Any, Optional
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabaseRepository:
    """Repositorio de infraestructura para operaciones con PostgreSQL/Supabase."""
    
    def __init__(self):
        self._cached_target = None

    def get_connection(self):
        """Obtiene una conexión probando endpoints candidatos con auto-fallback y caché."""
        if self._cached_target:
            try:
                return psycopg2.connect(
                    host=self._cached_target[0],
                    port=self._cached_target[1],
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    dbname=settings.DB_NAME,
                    connect_timeout=2
                )
            except Exception:
                self._cached_target = None

        candidates = [
            (settings.DB_HOST, settings.DB_PORT),
            ("supabase_db_db_CoffeeFaster", 5432),
            ("db", 5432),
            ("host.docker.internal", 54322),
            ("172.17.0.1", 54322),
            ("172.19.0.1", 54322),
            ("localhost", 54322),
        ]

        seen = set()
        unique = [c for c in candidates if c[0] and not (c in seen or seen.add(c))]

        last_error = None
        for host, port in unique:
            try:
                conn = psycopg2.connect(
                    host=host,
                    port=port,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    dbname=settings.DB_NAME,
                    connect_timeout=2
                )
                self._cached_target = (host, port)
                logger.info(f"Conectado exitosamente a PostgreSQL en {host}:{port}")
                return conn
            except Exception as e:
                last_error = e
                continue

        raise last_error or Exception("No se pudo conectar a ninguna instancia de PostgreSQL.")

    def verificar_conexion(self) -> bool:
        """Verifica la conectividad con la base de datos."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                    return True
        except Exception as e:
            logger.warning(f"Error verificando conexión DB: {e}")
            return False

    def guardar_alerta(
        self,
        cafeteria_id: Optional[int],
        producto_id: Optional[int],
        stock_actual: int,
        stock_minimo: int,
        mensaje: str
    ) -> Optional[int]:
        """Inserta el registro de alerta en la tabla alertas_stock."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Validar existencia de FK para no romper restricciones
                    cur.execute("SELECT 1 FROM cafeterias WHERE id = %s;", (cafeteria_id,))
                    caf_valida = cur.fetchone() is not None

                    cur.execute("SELECT 1 FROM productos WHERE id = %s;", (producto_id,))
                    prod_valido = cur.fetchone() is not None

                    final_caf_id = cafeteria_id if caf_valida else None
                    final_prod_id = producto_id if prod_valido else None

                    extra = ""
                    if not caf_valida:
                        extra += f" [Cafetería #{cafeteria_id} no registrada]"
                    if not prod_valido:
                        extra += f" [Producto #{producto_id} no registrado]"

                    msg = (mensaje + extra).strip()

                    # Evitar duplicados si el trigger de PostgreSQL ya insertó la alerta hace segundos
                    cur.execute(
                        """
                        SELECT id FROM alertas_stock
                        WHERE cafeteria_id IS NOT DISTINCT FROM %s
                          AND producto_id IS NOT DISTINCT FROM %s
                          AND stock_actual = %s
                          AND creado_en >= NOW() - INTERVAL '15 seconds'
                        ORDER BY id DESC
                        LIMIT 1;
                        """,
                        (final_caf_id, final_prod_id, stock_actual)
                    )
                    existente = cur.fetchone()
                    if existente:
                        alerta_id = existente[0]
                        logger.info(f"Alerta ya registrada previamente en DB por trigger (ID #{alerta_id})")
                        return alerta_id

                    cur.execute(
                        """
                        INSERT INTO alertas_stock (
                            cafeteria_id, producto_id, stock_actual, stock_minimo, mensaje, leida
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (final_caf_id, final_prod_id, stock_actual, stock_minimo, msg, False)
                    )
                    alerta_id = cur.fetchone()[0]
                    conn.commit()
                    logger.info(f"Alerta registrada en tabla alertas_stock (ID #{alerta_id})")
                    return alerta_id
        except Exception as e:
            logger.error(f"Error guardando alerta en DB: {e}")
            return None

    def verificar_dueno_autorizado(self, chat_id: Optional[int]) -> Optional[Dict[str, Any]]:
        """Verifica en base de datos si el chat_id pertenece a un Dueño activo y vinculado."""
        if not chat_id:
            return None
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT 
                            ctd.cafeteria_id,
                            c.nombre AS cafeteria_nombre,
                            u.id AS dueno_id,
                            u.nombre AS dueno_nombre,
                            ctd.notificaciones_activas
                        FROM configuracion_telegram_dueno ctd
                        JOIN cafeterias c ON c.id = ctd.cafeteria_id
                        JOIN usuarios u ON u.id = ctd.usuario_id
                        WHERE ctd.telegram_chat_id = %s
                        LIMIT 1;
                        """,
                        (chat_id,)
                    )
                    row = cur.fetchone()
                    if row:
                        return dict(row)

                    cur.execute("SELECT * FROM verificar_dueno_telegram(%s);", (chat_id,))
                    row_rpc = cur.fetchone()
                    if row_rpc:
                        return dict(row_rpc)

                    # Soporte de contingencia si el chat_id está configurado en .env
                    if chat_id in settings.DEFAULT_CHAT_IDS:
                        cur.execute(
                            """
                            SELECT c.id as cafeteria_id, c.nombre as cafeteria_nombre, u.id as dueno_id, u.nombre as dueno_nombre, true as notificaciones_activas
                            FROM usuarios u
                            JOIN roles r ON r.id = u.rol_id
                            JOIN cafeteria_usuarios cu ON cu.usuario_id = u.id
                            JOIN cafeterias c ON c.id = cu.cafeteria_id
                            WHERE r.nombre = 'dueño'
                            LIMIT 1;
                            """
                        )
                        fallback_dueno = cur.fetchone()
                        if fallback_dueno:
                            return dict(fallback_dueno)

                    return None
        except Exception as e:
            logger.error(f"Error verificando autorización de dueño para chat {chat_id}: {e}")
            return None

    def obtener_ultimas_alertas(self, chat_id: int, limite: int = 5) -> List[Dict[str, Any]]:
        """Recupera las últimas alertas EXCLUSIVAS de la cafetería del Dueño vinculado.
        Si el chat está desvinculado o no autorizado, retorna lista vacía por seguridad."""
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM obtener_alertas_dueno(%s, %s);",
                        (chat_id, limite)
                    )
                    rows = cur.fetchall()
                    if rows:
                        return [dict(row) for row in rows]

                    # Consulta directa de respaldo por cafeteria_id vinculada
                    cur.execute(
                        """
                        SELECT 
                            a.id, a.cafeteria_id, a.producto_id, a.stock_actual, a.stock_minimo, a.mensaje, a.creado_en,
                            p.nombre AS producto_nombre, c.nombre AS cafeteria_nombre
                        FROM alertas_stock a
                        LEFT JOIN productos p ON p.id = a.producto_id
                        JOIN cafeterias c ON c.id = a.cafeteria_id
                        JOIN configuracion_telegram_dueno ctd ON ctd.cafeteria_id = a.cafeteria_id
                        WHERE ctd.telegram_chat_id = %s
                        ORDER BY a.id DESC
                        LIMIT %s;
                        """,
                        (chat_id, limite)
                    )
                    return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"Error consultando alertas seguras: {e}")
            return []

    def obtener_stock_general(self, chat_id: int) -> List[Dict[str, Any]]:
        """Consulta TODO el inventario de la cafetería del Dueño vinculado."""
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT 
                            p.id,
                            p.nombre,
                            p.stock,
                            p.stock_minimo,
                            p.precio,
                            p.cafeteria_id,
                            c.nombre AS cafeteria_nombre
                        FROM productos p
                        JOIN cafeterias c ON c.id = p.cafeteria_id
                        JOIN configuracion_telegram_dueno ctd ON ctd.cafeteria_id = p.cafeteria_id
                        WHERE ctd.telegram_chat_id = %s
                          AND (p.activo = true OR p.activo IS NULL)
                          AND p.eliminado_en IS NULL
                        ORDER BY p.stock ASC, p.nombre ASC;
                        """,
                        (chat_id,)
                    )
                    rows = cur.fetchall()
                    if rows:
                        return [dict(r) for r in rows]

                    if chat_id in settings.DEFAULT_CHAT_IDS:
                        cur.execute(
                            """
                            SELECT 
                                p.id, p.nombre, p.stock, p.stock_minimo, p.precio, p.cafeteria_id, c.nombre AS cafeteria_nombre
                            FROM productos p
                            JOIN cafeterias c ON c.id = p.cafeteria_id
                            WHERE (p.activo = true OR p.activo IS NULL)
                              AND p.eliminado_en IS NULL
                            ORDER BY p.stock ASC, p.nombre ASC;
                            """
                        )
                        return [dict(r) for r in cur.fetchall()]
                    return []
        except Exception as e:
            logger.error(f"Error consultando inventario general: {e}")
            return []

    def obtener_productos_stock_bajo(self, chat_id: int, umbral: int = 10) -> List[Dict[str, Any]]:
        """Consulta productos de stock bajo (0 < stock <= stock_minimo o <= umbral) de la cafetería del Dueño vinculado."""
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT 
                            p.id,
                            p.nombre,
                            p.stock,
                            p.stock_minimo,
                            p.precio,
                            p.cafeteria_id,
                            c.nombre AS cafeteria_nombre
                        FROM productos p
                        JOIN cafeterias c ON c.id = p.cafeteria_id
                        JOIN configuracion_telegram_dueno ctd ON ctd.cafeteria_id = p.cafeteria_id
                        WHERE ctd.telegram_chat_id = %s
                          AND p.stock > 0
                          AND (p.stock <= p.stock_minimo OR p.stock <= %s)
                          AND (p.activo = true OR p.activo IS NULL)
                          AND p.eliminado_en IS NULL
                        ORDER BY p.stock ASC, p.nombre ASC;
                        """,
                        (chat_id, umbral)
                    )
                    rows = cur.fetchall()
                    if rows:
                        return [dict(r) for r in rows]

                    # Fallback a RPC si está disponible
                    try:
                        cur.execute(
                            "SELECT * FROM obtener_stock_bajo_dueno(%s, %s);",
                            (chat_id, umbral)
                        )
                        rpc_rows = cur.fetchall()
                        rpc_filtrados = [dict(r) for r in rpc_rows if r.get('stock', 0) > 0]
                        if rpc_filtrados:
                            return rpc_filtrados
                    except Exception:
                        pass

                    if chat_id in settings.DEFAULT_CHAT_IDS:
                        cur.execute(
                            """
                            SELECT 
                                p.id, p.nombre, p.stock, p.stock_minimo, p.precio, p.cafeteria_id, c.nombre AS cafeteria_nombre
                            FROM productos p
                            JOIN cafeterias c ON c.id = p.cafeteria_id
                            WHERE p.stock > 0
                              AND (p.stock <= p.stock_minimo OR p.stock <= %s)
                              AND (p.activo = true OR p.activo IS NULL)
                              AND p.eliminado_en IS NULL
                            ORDER BY p.stock ASC, p.nombre ASC;
                            """,
                            (umbral,)
                        )
                        return [dict(r) for r in cur.fetchall()]
                    return []
        except Exception as e:
            logger.error(f"Error consultando stock bajo: {e}")
            return []

    def obtener_productos_agotados(self, chat_id: int) -> List[Dict[str, Any]]:
        """Consulta productos agotados (stock <= 0) de la cafetería del Dueño vinculado."""
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT 
                            p.id,
                            p.nombre,
                            p.stock,
                            p.stock_minimo,
                            p.precio,
                            p.cafeteria_id,
                            c.nombre AS cafeteria_nombre
                        FROM productos p
                        JOIN cafeterias c ON c.id = p.cafeteria_id
                        JOIN configuracion_telegram_dueno ctd ON ctd.cafeteria_id = p.cafeteria_id
                        WHERE ctd.telegram_chat_id = %s
                          AND p.stock <= 0
                          AND (p.activo = true OR p.activo IS NULL)
                          AND p.eliminado_en IS NULL
                        ORDER BY p.nombre ASC;
                        """,
                        (chat_id,)
                    )
                    rows = cur.fetchall()
                    if rows:
                        return [dict(r) for r in rows]

                    if chat_id in settings.DEFAULT_CHAT_IDS:
                        cur.execute(
                            """
                            SELECT 
                                p.id, p.nombre, p.stock, p.stock_minimo, p.precio, p.cafeteria_id, c.nombre AS cafeteria_nombre
                            FROM productos p
                            JOIN cafeterias c ON c.id = p.cafeteria_id
                            WHERE p.stock <= 0
                              AND (p.activo = true OR p.activo IS NULL)
                              AND p.eliminado_en IS NULL
                            ORDER BY p.nombre ASC;
                            """
                        )
                        return [dict(r) for r in cur.fetchall()]
                    return []
        except Exception as e:
            logger.error(f"Error consultando productos agotados: {e}")
            return []


    def obtener_destinatarios_activos(self, cafeteria_id: Optional[int] = None) -> List[int]:
        """Obtiene la lista de telegram_chat_id de los Dueños activos en la base de datos."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    if cafeteria_id is not None:
                        cur.execute(
                            """
                            SELECT telegram_chat_id 
                            FROM configuracion_telegram_dueno 
                            WHERE cafeteria_id = %s AND notificaciones_activas = true;
                            """,
                            (cafeteria_id,)
                        )
                    else:
                        cur.execute(
                            """
                            SELECT telegram_chat_id 
                            FROM configuracion_telegram_dueno 
                            WHERE notificaciones_activas = true;
                            """
                        )
                    return [row[0] for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"Error obteniendo destinatarios activos desde DB: {e}")
            return []

    def actualizar_estado_notificaciones(self, chat_id: int, activas: bool) -> bool:
        """Activa o pausa las notificaciones del dueño vinculado."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE configuracion_telegram_dueno
                        SET notificaciones_activas = %s, actualizado_en = CURRENT_TIMESTAMP
                        WHERE telegram_chat_id = %s
                        RETURNING id;
                        """,
                        (activas, chat_id)
                    )
                    actualizado = cur.fetchone() is not None
                    conn.commit()
                    return actualizado
        except Exception as e:
            logger.error(f"Error actualizando estado de notificaciones para {chat_id}: {e}")
            return False

    def desvincular_dueno(self, chat_id: int) -> bool:
        """Elimina la vinculación del chat_id de la base de datos."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM configuracion_telegram_dueno WHERE telegram_chat_id = %s RETURNING id;",
                        (chat_id,)
                    )
                    eliminado = cur.fetchone() is not None
                    conn.commit()
                    return eliminado
        except Exception as e:
            logger.error(f"Error desvinculando chat {chat_id} en DB: {e}")
            return False

    def obtener_nombre_cafeteria(self, cafeteria_id: Optional[int]) -> Optional[str]:
        """Consulta el nombre comercial de una cafetería."""
        if not cafeteria_id:
            return None
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT nombre FROM cafeterias WHERE id = %s;", (cafeteria_id,))
                    res = cur.fetchone()
                    return res[0] if res else None
        except Exception as e:
            logger.warning(f"Error obteniendo nombre de cafetería: {e}")
            return None

db_repo = DatabaseRepository()

