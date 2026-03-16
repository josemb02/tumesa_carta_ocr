import uuid


def crear_usuario_y_token(client):
    """
    Este helper crea un usuario, hace login
    y devuelve las cabeceras con el token.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"user_{unique}@test.com"
    username = f"user_{unique}"

    # Se usa una IP distinta para no chocar con el rate limit
    # de register y login durante los tests.
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


def test_create_group(client):
    """
    Este test comprueba que un usuario autenticado
    puede crear un grupo correctamente.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "grupo_test"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "grupo_test"
    assert "join_code" in data
    assert "id" in data


def test_create_group_trims_name(client):
    """
    Este test comprueba que el nombre del grupo
    se limpia antes de guardarse.
    """
    headers = crear_usuario_y_token(client)

    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "   grupo_limpio   "
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "grupo_limpio"


def test_create_duplicate_group_name_for_same_owner(client):
    """
    Este test comprueba que un usuario no puede crear
    dos grupos con el mismo nombre.
    """
    headers = crear_usuario_y_token(client)

    first_response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "grupo_repetido"
        }
    )

    assert first_response.status_code == 201, first_response.text

    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "grupo_repetido"
        }
    )

    assert response.status_code == 409


def test_list_my_groups(client):
    """
    Este test comprueba que el usuario puede ver
    los grupos a los que pertenece.
    """
    headers = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "grupo_listado"
        }
    )

    assert create_response.status_code == 201, create_response.text

    response = client.get(
        "/groups/my",
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1


def test_join_group(client):
    """
    Este test comprueba que un segundo usuario
    puede unirse a un grupo mediante join_code.
    """
    # usuario 1 crea el grupo
    headers_owner = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers_owner,
        json={
            "name": "grupo_join"
        }
    )

    assert create_response.status_code == 201, create_response.text

    join_code = create_response.json()["join_code"]

    # usuario 2 se une
    headers_user2 = crear_usuario_y_token(client)

    response = client.post(
        "/groups/join",
        headers=headers_user2,
        json={
            "join_code": join_code
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["join_code"] == join_code
    assert data["name"] == "grupo_join"


def test_join_group_with_lowercase_and_spaces(client):
    """
    Este test comprueba que el join_code funciona
    aunque llegue en minúsculas.
    """
    headers_owner = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers_owner,
        json={
            "name": "grupo_codigo"
        }
    )

    assert create_response.status_code == 201, create_response.text

    join_code = create_response.json()["join_code"]

    headers_user2 = crear_usuario_y_token(client)

    response = client.post(
        "/groups/join",
        headers=headers_user2,
        json={
            "join_code": join_code.lower()
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["join_code"] == join_code
    assert data["name"] == "grupo_codigo"


def test_join_group_twice_returns_conflict(client):
    """
    Este test comprueba que un usuario no puede
    unirse dos veces al mismo grupo.
    """
    headers_owner = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers_owner,
        json={
            "name": "grupo_duplicado"
        }
    )

    assert create_response.status_code == 201, create_response.text

    join_code = create_response.json()["join_code"]

    headers_user2 = crear_usuario_y_token(client)

    first_join = client.post(
        "/groups/join",
        headers=headers_user2,
        json={
            "join_code": join_code
        }
    )

    assert first_join.status_code == 200, first_join.text

    response = client.post(
        "/groups/join",
        headers=headers_user2,
        json={
            "join_code": join_code
        }
    )

    assert response.status_code == 409


def test_list_group_members(client):
    """
    Este test comprueba que un miembro del grupo
    puede listar los usuarios que pertenecen a ese grupo.
    """
    headers_owner = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers_owner,
        json={
            "name": "grupo_miembros"
        }
    )

    assert create_response.status_code == 201, create_response.text

    grupo = create_response.json()
    join_code = grupo["join_code"]

    headers_user2 = crear_usuario_y_token(client)

    join_response = client.post(
        "/groups/join",
        headers=headers_user2,
        json={
            "join_code": join_code
        }
    )

    assert join_response.status_code == 200, join_response.text

    response = client.get(
        f"/groups/{grupo['id']}/members",
        headers=headers_owner
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 2


def test_list_group_members_forbidden_if_not_member(client):
    """
    Este test comprueba que un usuario ajeno
    no puede ver los miembros de un grupo.
    """
    headers_owner = crear_usuario_y_token(client)

    create_response = client.post(
        "/groups",
        headers=headers_owner,
        json={
            "name": "grupo_privado"
        }
    )

    assert create_response.status_code == 201, create_response.text

    grupo = create_response.json()

    headers_other = crear_usuario_y_token(client)

    response = client.get(
        f"/groups/{grupo['id']}/members",
        headers=headers_other
    )

    assert response.status_code == 403