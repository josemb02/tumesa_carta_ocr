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


def crear_grupo(client, headers, nombre="grupo_chat"):
    """
    Este helper crea un grupo usando el usuario autenticado.
    """
    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": nombre
        }
    )

    return response.json()


def test_send_message_group(client):
    """
    Este test comprueba que un usuario del grupo
    puede enviar un mensaje correctamente.
    """
    headers = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers)

    response = client.post(
        f"/chat/group/{grupo['id']}",
        headers=headers,
        json={
            "message": "hola grupo"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert data["message"] == "hola grupo"
    assert "id" in data
    assert "user_id" in data


def test_send_empty_message_group(client):
    """
    Este test comprueba que no se puede enviar
    un mensaje vacío de verdad.
    """
    headers = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers)

    response = client.post(
        f"/chat/group/{grupo['id']}",
        headers=headers,
        json={
            "message": "     "
        }
    )

    assert response.status_code == 400


def test_list_messages_group(client):
    """
    Este test comprueba que se pueden listar
    los mensajes del grupo.
    """
    headers = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers)

    client.post(
        f"/chat/group/{grupo['id']}",
        headers=headers,
        json={
            "message": "primer mensaje"
        }
    )

    response = client.get(
        f"/chat/group/{grupo['id']}",
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["message"] == "primer mensaje"


def test_list_messages_group_order(client):
    """
    Este test comprueba que los mensajes se devuelven
    ordenados del más reciente al más antiguo.
    """
    headers = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers)

    client.post(
        f"/chat/group/{grupo['id']}",
        headers=headers,
        json={
            "message": "mensaje uno"
        }
    )

    client.post(
        f"/chat/group/{grupo['id']}",
        headers=headers,
        json={
            "message": "mensaje dos"
        }
    )

    response = client.get(
        f"/chat/group/{grupo['id']}",
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) >= 2
    assert data[0]["message"] == "mensaje dos"
    assert data[1]["message"] == "mensaje uno"


def test_chat_forbidden_if_not_member(client):
    """
    Este test comprueba que un usuario que no pertenece
    al grupo no puede leer el chat.
    """
    headers_owner = crear_usuario_y_token(client)
    grupo = crear_grupo(client, headers_owner)

    headers_other = crear_usuario_y_token(client)

    response = client.get(
        f"/chat/group/{grupo['id']}",
        headers=headers_other
    )

    assert response.status_code == 403