from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import json

from app.database import Base, engine, get_db
from app.models import Menu

"""
API principal.

Objetivo del MVP:
- Levantar API
- Comprobar salud
- Probar que Postgres conecta
- Guardar y leer una carta (JSON)
"""

app = FastAPI(title="TuMesa Carta OCR", version="1.0.0")


# Creo las tablas automáticamente al arrancar (MVP rápido)
# En un proyecto más pro usaríamos migraciones (Alembic), pero para el trabajo vale.
@app.on_event("startup")
def crear_tablas():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/menus/guardar")
def guardar_menu(barId: int, db: Session = Depends(get_db)):
    """
    Endpoint de prueba:

    - Simulo un JSON de carta (más adelante será el que venga del OCR)
    - Lo guardo en Postgres
    """
    menu = {
        "barId": barId,
        "categorias": [
            {
                "nombre": "Bebidas",
                "productos": [
                    {"nombre": "Cerveza", "precio": 2.5, "descripcion": "", "imagen": None}
                ]
            }
        ]
    }

    nuevo = Menu(
        bar_id=barId,
        menu_json=json.dumps(menu, ensure_ascii=False)
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {"ok": True, "id": nuevo.id}


@app.get("/menus/{barId}")
def obtener_menu(barId: int, db: Session = Depends(get_db)):
    """
    Devuelve la última carta guardada de un bar.
    """
    menu = (
        db.query(Menu)
        .filter(Menu.bar_id == barId)
        .order_by(Menu.created_at.desc())
        .first()
    )

    if menu is None:
        return {"ok": False, "mensaje": "No hay carta guardada para este bar"}

    # Devuelvo el JSON como objeto
    return {"ok": True, "menu": json.loads(menu.menu_json)}
