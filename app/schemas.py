from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional


# -------------------------
# Esquemas de entrada (body)
# -------------------------

class ProductoIn(BaseModel):
    """
    Producto dentro de una categoría de la carta.
    Validaciones:
    - nombre obligatorio
    - precio >= 0
    - campos con longitudes razonables para evitar basura / DoS de texto
    """
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(..., min_length=1, max_length=120)
    precio: float = Field(..., ge=0, le=9999)
    descripcion: Optional[str] = Field(default="", max_length=500)
    imagen: Optional[str] = Field(default=None, max_length=500)


class CategoriaIn(BaseModel):
    """
    Categoría de la carta (Bebidas, Tapas, etc.).
    """
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(..., min_length=1, max_length=120)
    productos: List[ProductoIn] = Field(default_factory=list, max_items=300)


class MenuIn(BaseModel):
    """
    Carta completa.
    NOTA: barId lo seguimos recibiendo por query (barId=1)
    para que encaje con tu endpoint actual y Postman.
    """
    model_config = ConfigDict(extra="forbid")

    categorias: List[CategoriaIn] = Field(default_factory=list, max_items=200)
