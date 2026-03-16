import uuid


def crear_usuario_y_token(client):
    """
    Este helper crea un usuario, hace login
    y devuelve las cabeceras con el token.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"user_{unique}@test.com"
    username = f"user_{unique}"

    # Se usa una IP distinta en cada test para no chocar
    # con el rate limit de login y register.
    ip_falsa = f"10.0.0.{int(unique[:2], 16) % 200 + 1}"

    register = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": email,
            "password": "12345678"
        }
    )

    assert register.status_code == 201, register.text

    login = client.post(
        "/auth/login",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "email": email,
            "password": "12345678"
        }
    )

    assert login.status_code == 200, login.text

    token = login.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }

    return headers

def crear_grupo(client, headers, nombre="grupo_checkins"):
    """
    Este helper crea un grupo para usarlo en tests de check-ins.
    """
    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": nombre
        }
    )

    return response.json()


def test_create_checkin(client):
    """
    Este test comprueba que un usuario autenticado
    puede crear un check-in correctamente.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "note": "cerveza de prueba"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert str(data["lat"]) == "37.388600"
    assert str(data["lng"]) == "-5.982300"
    assert data["note"] == "cerveza de prueba"


def test_create_checkin_with_price(client):
    """
    Este test comprueba que el check-in acepta precio
    y lo devuelve correctamente.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "precio": 2.80,
            "note": "cerveza con precio"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert float(data["precio"]) == 2.8
    assert data["note"] == "cerveza con precio"


def test_checkin_negative_price(client):
    """
    Este test comprueba que no se permite un precio negativo.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "precio": -1,
            "note": "precio inválido"
        }
    )

    assert response.status_code == 400


def test_checkin_invalid_lat(client):
    """
    Este test comprueba que no se permite una latitud fuera de rango.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 120,
            "lng": -5.9823,
            "note": "lat inválida"
        }
    )

    assert response.status_code == 400


def test_checkin_invalid_lng(client):
    """
    Este test comprueba que no se permite una longitud fuera de rango.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -200,
            "note": "lng inválida"
        }
    )

    assert response.status_code == 400


def test_checkin_cooldown(client):
    """
    Este test comprueba que no se pueden hacer dos check-ins seguidos
    dentro del tiempo de cooldown.
    """
    headers = crear_usuario_y_token(client)

    response_1 = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "note": "primer checkin"
        }
    )

    assert response_1.status_code == 201

    response_2 = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3887,
            "lng": -5.9824,
            "note": "segundo checkin"
        }
    )

    assert response_2.status_code == 409


def test_create_checkin_in_valid_group(client):
    """
    Este test comprueba que se puede crear un check-in
    dentro de un grupo al que el usuario pertenece.
    """
    headers = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers)

    response = client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "group_id": grupo["id"],
            "note": "checkin en grupo"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert data["note"] == "checkin en grupo"


def test_create_checkin_in_group_without_membership(client):
    """
    Este test comprueba que un usuario no puede crear un check-in
    en un grupo al que no pertenece.
    """
    headers_owner = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers_owner)

    headers_other = crear_usuario_y_token(client)

    response = client.post(
        "/checkins",
        headers=headers_other,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "group_id": grupo["id"],
            "note": "checkin prohibido"
        }
    )

    assert response.status_code == 403


def test_my_map_returns_checkins(client):
    """
    Este test comprueba que el endpoint del mapa personal
    devuelve los check-ins del usuario autenticado.
    """
    headers = crear_usuario_y_token(client)

    client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": 37.3886,
            "lng": -5.9823,
            "note": "mapa checkin"
        }
    )

    response = client.get(
        "/checkins/my-map",
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1
    assert "id" in data[0]
    assert "lat" in data[0]
    assert "lng" in data[0]