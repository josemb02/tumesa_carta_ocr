from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


"""
Aquí defino las tablas.

MVP:
- Tabla menus
- Guarda JSON completo de la carta
"""

class Menu(Base):
    __tablename__ = "menus"

    # ID autoincremental
    id = Column(Integer, primary_key=True, index=True)

    # ID del bar al que pertenece la carta
    bar_id = Column(Integer, nullable=False, index=True)

    # JSON completo de la carta (lo guardo como texto)
    menu_json = Column(Text, nullable=False)

    # Fecha automática
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
