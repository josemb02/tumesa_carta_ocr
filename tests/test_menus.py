# test para menus: comprueba que se puede guardar un menu y luego obtenerlo.
# Primero guardo un menu con POST /menus/guardar
# Luego lo obtengo con GET /menus/{barId}

import httpx

BASE_URL = "http://127.0.0.1:8000"

# También compruebo que el menú guardado es el mismo que el obtenido (sin map/forEach, bucles clásicos)
def test_guardar_y_obtener_menu():
    payload = {
        "categorias": [
            {
                "nombre": "Bebidas",
                "productos": [
                    {
                        "nombre": "Cerveza",
                        "precio": 2.5,
                        "descripcion": "",
                        "imagen": None
                    }
                ],
            }
        ],
    }

# Guardamos el menú con POST /menus/guardar?barId=1 y comprobamos la respuesta
# Luego obtenemos el menú con GET /menus/1 y comprobamos que es el mismo (barId, categorías, productos, etc.)
    r = httpx.post(f"{BASE_URL}/menus/guardar?barId=1", json=payload)
    assert r.status_code == 200

    data = r.json()
    assert data["ok"] is True
    assert "id" in data

    r2 = httpx.get(f"{BASE_URL}/menus/1")
    assert r2.status_code == 200

    data2 = r2.json()
    assert data2["ok"] is True
    assert data2["menu"]["barId"] == 1
    assert len(data2["menu"]["categorias"]) == 1

# También compruebo que el menú guardado es el mismo que el obtenido (sin map/forEach, bucles clásicos)

def test_guardar_menu_invalido():
    payload = {
        "categorias": [
            {
                "nombre": "",  # inválido (min_length=1)
                "productos": [
                    {"nombre": "Cerveza", "precio": -5}  # inválido (precio < 0)
                ],
            }
        ],
    }

    r = httpx.post(f"{BASE_URL}/menus/guardar?barId=1", json=payload)

    assert r.status_code == 422

    data = r.json()
    assert data["ok"] is False
