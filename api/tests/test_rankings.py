import uuid


def crear_usuario_y_token(
    client,
    fecha_nacimiento="2000-01-01",
    pais="España",
    ciudad="Sevilla"
):
    """
    Este helper crea un usuario con datos de perfil,
    hace login y devuelve cabeceras con el token.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"user_{unique}@test.com"
    username = f"user_{unique}"

    # Se usa una IP distinta para no chocar con el rate limit.
    ip_falsa = f"10.0.2.{int(unique[:2], 16) % 200 + 1}"

    register = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": email,
            "password": "12345678",
            "fecha_nacimiento": fecha_nacimiento,
            "pais": pais,
            "ciudad": ciudad
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

    return {
        "headers": headers,
        "email": email,
        "username": username
    }

def crear_grupo(client, headers, nombre="grupo_rankings"):
    """
    Este helper crea un grupo y devuelve su respuesta.
    """
    response = client.post(
        "/groups",
        headers=headers,
        json={
            "name": nombre
        }
    )

    return response.json()


def unir_usuario_a_grupo(client, headers, join_code):
    """
    Este helper une un usuario a un grupo usando join_code.
    """
    return client.post(
        "/groups/join",
        headers=headers,
        json={
            "join_code": join_code
        }
    )


def crear_checkin(client, headers, lat=37.3886, lng=-5.9823, note="checkin ranking"):
    """
    Este helper crea un check-in para sumar un punto.
    """
    return client.post(
        "/checkins",
        headers=headers,
        json={
            "lat": lat,
            "lng": lng,
            "note": note
        }
    )


def test_global_ranking_returns_users_with_points(client):
    """
    Este test comprueba que el ranking global devuelve
    usuarios con sus puntos correctamente.
    """
    user1 = crear_usuario_y_token(client)
    user2 = crear_usuario_y_token(client)

    crear_checkin(client, user1["headers"], note="checkin user1")

    response = client.get(
        "/rankings/global",
        headers=user1["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 2

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert user1["username"] in usernames
    assert user2["username"] in usernames


def test_global_ranking_orders_by_points(client):
    """
    Este test comprueba que el ranking global ordena
    de mayor a menor por puntos.
    """
    user1 = crear_usuario_y_token(client)
    user2 = crear_usuario_y_token(client)

    crear_checkin(client, user1["headers"], note="punto 1 user1")

    response = client.get(
        "/rankings/global",
        headers=user1["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    posiciones = {}

    for i in range(len(data)):
        posiciones[data[i]["username"]] = i

    assert posiciones[user1["username"]] < posiciones[user2["username"]]


def test_country_ranking_filters_by_country(client):
    """
    Este test comprueba que el ranking por país
    filtra correctamente.
    """
    user_spain = crear_usuario_y_token(client, pais="España", ciudad="Sevilla")
    user_france = crear_usuario_y_token(client, pais="Francia", ciudad="París")

    crear_checkin(client, user_spain["headers"], note="checkin españa")
    crear_checkin(client, user_france["headers"], note="checkin francia")

    response = client.get(
        "/rankings/country/España",
        headers=user_spain["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert user_spain["username"] in usernames
    assert user_france["username"] not in usernames


def test_country_ranking_trims_input(client):
    """
    Este test comprueba que el ranking por país
    funciona aunque el texto lleve espacios.
    """
    user_spain = crear_usuario_y_token(client, pais="España", ciudad="Sevilla")
    crear_checkin(client, user_spain["headers"], note="checkin españa trim")

    response = client.get(
        "/rankings/country/   España   ",
        headers=user_spain["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert user_spain["username"] in usernames


def test_city_ranking_filters_by_city(client):
    """
    Este test comprueba que el ranking por ciudad
    filtra correctamente.
    """
    user_sevilla = crear_usuario_y_token(client, pais="España", ciudad="Sevilla")
    user_madrid = crear_usuario_y_token(client, pais="España", ciudad="Madrid")

    crear_checkin(client, user_sevilla["headers"], note="checkin sevilla")
    crear_checkin(client, user_madrid["headers"], note="checkin madrid")

    response = client.get(
        "/rankings/city/Sevilla",
        headers=user_sevilla["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert user_sevilla["username"] in usernames
    assert user_madrid["username"] not in usernames


def test_city_ranking_trims_input(client):
    """
    Este test comprueba que el ranking por ciudad
    funciona aunque el texto lleve espacios.
    """
    user_sevilla = crear_usuario_y_token(client, pais="España", ciudad="Sevilla")
    crear_checkin(client, user_sevilla["headers"], note="checkin sevilla trim")

    response = client.get(
        "/rankings/city/   Sevilla   ",
        headers=user_sevilla["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert user_sevilla["username"] in usernames


def test_group_ranking_returns_group_members(client):
    """
    Este test comprueba que el ranking de grupo
    devuelve a los miembros del grupo.
    """
    owner = crear_usuario_y_token(client)
    user2 = crear_usuario_y_token(client)

    grupo = crear_grupo(client, owner["headers"], nombre="grupo_ranking")
    unir_usuario_a_grupo(client, user2["headers"], grupo["join_code"])

    crear_checkin(client, owner["headers"], note="checkin owner")

    response = client.get(
        f"/rankings/group/{grupo['id']}",
        headers=owner["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    usernames = []
    for fila in data:
        usernames.append(fila["username"])

    assert owner["username"] in usernames
    assert user2["username"] in usernames


def test_group_ranking_orders_by_points(client):
    """
    Este test comprueba que el ranking del grupo
    ordena por puntos de mayor a menor.
    """
    owner = crear_usuario_y_token(client)
    user2 = crear_usuario_y_token(client)

    grupo = crear_grupo(client, owner["headers"], nombre="grupo_orden")
    unir_usuario_a_grupo(client, user2["headers"], grupo["join_code"])

    crear_checkin(client, owner["headers"], note="checkin owner ranking")

    response = client.get(
        f"/rankings/group/{grupo['id']}",
        headers=owner["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    posiciones = {}

    for i in range(len(data)):
        posiciones[data[i]["username"]] = i

    assert posiciones[owner["username"]] < posiciones[user2["username"]]


def test_group_ranking_forbidden_if_not_member(client):
    """
    Este test comprueba que un usuario ajeno
    no puede ver el ranking de un grupo.
    """
    owner = crear_usuario_y_token(client)
    other = crear_usuario_y_token(client)

    grupo = crear_grupo(client, owner["headers"], nombre="grupo_privado_ranking")

    response = client.get(
        f"/rankings/group/{grupo['id']}",
        headers=other["headers"]
    )

    assert response.status_code == 403


def test_group_ranking_returns_zero_for_user_without_points(client):
    """
    Este test comprueba que un usuario sin puntos
    aparece con 0 en el ranking del grupo.
    """
    owner = crear_usuario_y_token(client)
    user2 = crear_usuario_y_token(client)

    grupo = crear_grupo(client, owner["headers"], nombre="grupo_ceros")
    unir_usuario_a_grupo(client, user2["headers"], grupo["join_code"])

    crear_checkin(client, owner["headers"], note="checkin owner cero")

    response = client.get(
        f"/rankings/group/{grupo['id']}",
        headers=owner["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    puntos_user2 = None

    for fila in data:
        if fila["username"] == user2["username"]:
            puntos_user2 = fila["points"]

    assert puntos_user2 == 0