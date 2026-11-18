"""Consultas del repositorio contra PostgreSQL real, sin registros preexistentes."""
import os
from contextlib import contextmanager
from uuid import uuid4

import pytest


@pytest.fixture
def repository(monkeypatch):
    dsn = os.environ.get('TEST_DATABASE_URL')
    if not dsn:
        if os.environ.get('CI'):
            pytest.fail('CI requiere TEST_DATABASE_URL para la integración PostgreSQL')
        pytest.skip('Configura TEST_DATABASE_URL con una BD local cf_bot_test_*')
    import psycopg2
    from psycopg2.extensions import parse_dsn
    from app.infrastructure.database import DatabaseRepository

    config = parse_dsn(dsn)
    assert config.get('host') in ('localhost', '127.0.0.1')
    assert config.get('dbname', '').startswith('cf_bot_test_')
    schema = 'test_' + uuid4().hex
    admin = psycopg2.connect(dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            cur.execute(f'CREATE SCHEMA {schema}')
            cur.execute(f'SET search_path TO {schema}')
            cur.execute('''
                CREATE TABLE cafeterias(id bigint PRIMARY KEY, nombre text);
                CREATE TABLE usuarios(id bigint PRIMARY KEY, nombre text);
                CREATE TABLE configuracion_telegram_dueno(
                    usuario_id bigint REFERENCES usuarios, cafeteria_id bigint REFERENCES cafeterias,
                    telegram_chat_id bigint UNIQUE, notificaciones_activas boolean);
                CREATE TABLE productos(id bigint PRIMARY KEY, nombre text, stock integer,
                    stock_minimo integer, precio numeric, cafeteria_id bigint REFERENCES cafeterias,
                    activo boolean, eliminado_en timestamptz);
                INSERT INTO cafeterias VALUES (1,'Central'), (2,'Otra');
                INSERT INTO usuarios VALUES (1,'Dueño de prueba');
                INSERT INTO configuracion_telegram_dueno VALUES (1,1,999111222,true);
                INSERT INTO productos VALUES
                    (1,'Agotado',0,10,100,1,true,NULL),
                    (2,'Bajo',5,10,200,1,true,NULL),
                    (3,'Normal',25,10,300,1,true,NULL),
                    (4,'Ajeno',1,10,100,2,true,NULL),
                    (5,'Inactivo',0,10,100,1,false,NULL),
                    (6,'Eliminado',0,10,100,1,true,now());
            ''')

        @contextmanager
        def connection():
            conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
            try:
                with conn:
                    yield conn
            finally:
                conn.close()

        repo = DatabaseRepository()
        monkeypatch.setattr(repo, 'get_connection', connection)
        yield repo
    finally:
        with admin.cursor() as cur:
            cur.execute(f'DROP SCHEMA IF EXISTS {schema} CASCADE')
        admin.close()


@pytest.mark.integration
def test_consultas_persistidas_y_aislamiento(repository):
    repo = repository
    assert repo.verificar_conexion() is True
    owner = repo.verificar_dueno_autorizado(999111222)
    assert owner['dueno_nombre'] == 'Dueño de prueba'
    assert owner['cafeteria_id'] == 1
    assert [p['id'] for p in repo.obtener_stock_general(999111222)] == [1, 2, 3]
    assert [p['id'] for p in repo.obtener_productos_stock_bajo(999111222)] == [2]
    assert [p['id'] for p in repo.obtener_productos_agotados(999111222)] == [1]
    assert repo.obtener_stock_general(999111223) == []
