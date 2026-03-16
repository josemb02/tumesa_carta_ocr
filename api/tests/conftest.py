import os
import sys
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import text

# Añadimos la raíz del proyecto al path para poder importar app.main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import SessionLocal, engine, Base, get_db


# =========================================================
# PREPARACIÓN GLOBAL DE LA BASE DE TEST
# =========================================================
# En este proyecto usamos PostgreSQL real para los tests.
# No usamos SQLite porque varias constraints y tipos están
# pensados para Postgres y con SQLite fallan.
# =========================================================
@pytest.fixture(scope="session", autouse=True)
def preparar_base_de_test():
    """
    Prepara la base de datos de test una vez por sesión.

    Qué hace:
    - borra todas las tablas
    - las vuelve a crear limpias
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield

    Base.metadata.drop_all(bind=engine)


# =========================================================
# SESIÓN DE BASE DE DATOS POR TEST
# =========================================================
# Cada test usa su propia sesión.
# =========================================================
@pytest.fixture
def db():
    """
    Devuelve una sesión de base de datos para un test concreto.
    """
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()


# =========================================================
# LIMPIEZA DE DATOS ENTRE TESTS
# =========================================================
# Aquí vaciamos las tablas entre test y reiniciamos la BD
# para que un test no ensucie a otro.
# =========================================================
@pytest.fixture(autouse=True)
def limpiar_datos():
    """
    Limpia los datos antes de cada test.
    """
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE TABLE group_messages RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE points_ledger RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE checkin_photos RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE checkins RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE group_members RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE groups RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE user_points_total RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE user_devices RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE user_auth_providers RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE user_settings RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE user_icons RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE map_icons RESTART IDENTITY CASCADE"))
        connection.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE"))


# =========================================================
# CLIENTE FASTAPI DE TEST
# =========================================================
# Aquí se inyecta la base real de PostgreSQL en la app.
# =========================================================
@pytest.fixture
def client(db):
    """
    Devuelve un cliente de test de FastAPI.
    """
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()