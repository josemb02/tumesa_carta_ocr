import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

"""
Este archivo centraliza la conexión a la base de datos.

Aquí:
- Leemos DATABASE_URL desde el .env
- Creamos el engine
- Creamos la sesión
- Definimos la Base para los modelos
"""

# Cojo la URL desde variables de entorno
DATABASE_URL = os.getenv("DATABASE_URL")

# Si no está definida, prefiero fallar inmediatamente
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no está definida en el entorno.")

# Creo el engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True  # evita errores por conexiones muertas
)

# Generador de sesiones
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base para los modelos
Base = declarative_base()


def get_db():
    """
    Dependencia de FastAPI.

    Abre sesión antes del endpoint
    La cierra al terminar
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
