# test para health: comprueba que el endpoint /health devuelve un status 200 y un json con {"status": "ok"}.
# Para esto, hago una petición GET a /health y compruebo la respuesta.

import httpx

BASE_URL = "http://127.0.0.1:8000"

def test_health_ok():
    r = httpx.get(f"{BASE_URL}/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
