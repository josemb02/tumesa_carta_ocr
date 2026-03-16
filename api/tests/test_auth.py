import uuid


def generar_ip_falsa(unique: str) -> str:
    """
    Genera una IP falsa para que los tests no choquen
    con el rate limit de register y login.
    """
    return f"10.0.1.{int(unique[:2], 16) % 200 + 1}"


def test_register_user(client):
    """
    Este test comprueba que un usuario se puede registrar correctamente.
    """
    unique = uuid.uuid4().hex[:8]
    ip_falsa = generar_ip_falsa(unique)

    response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": f"testuser_{unique}",
            "email": f"test_{unique}@test.com",
            "password": "12345678"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert "email" in data
    assert "username" in data
    assert data["email"] == f"test_{unique}@test.com"
    assert data["username"] == f"testuser_{unique}"


def test_register_user_with_profile_fields(client):
    """
    Este test comprueba que el registro guarda también
    los campos extra del perfil.
    """
    unique = uuid.uuid4().hex[:8]
    ip_falsa = generar_ip_falsa(unique)

    response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": f"profile_{unique}",
            "email": f"profile_{unique}@test.com",
            "password": "12345678",
            "fecha_nacimiento": "2000-05-10",
            "pais": "España",
            "ciudad": "Sevilla"
        }
    )

    assert response.status_code == 201
    data = response.json()

    assert data["username"] == f"profile_{unique}"
    assert data["email"] == f"profile_{unique}@test.com"
    assert data["fecha_nacimiento"] == "2000-05-10"
    assert data["pais"] == "España"
    assert data["ciudad"] == "Sevilla"


def test_register_duplicate_email(client):
    """
    Este test comprueba que no se puede registrar
    dos veces el mismo email.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"duplicate_{unique}@test.com"
    ip_falsa = generar_ip_falsa(unique)

    first_response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": f"user1_{unique}",
            "email": email,
            "password": "12345678"
        }
    )

    assert first_response.status_code == 201, first_response.text

    response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": f"user2_{unique}",
            "email": email,
            "password": "12345678"
        }
    )

    assert response.status_code == 409


def test_register_duplicate_username(client):
    """
    Este test comprueba que no se puede registrar
    dos veces el mismo username.
    """
    unique = uuid.uuid4().hex[:8]
    username = f"sameuser_{unique}"
    ip_falsa = generar_ip_falsa(unique)

    first_response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": f"first_{unique}@test.com",
            "password": "12345678"
        }
    )

    assert first_response.status_code == 201, first_response.text

    response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": f"second_{unique}@test.com",
            "password": "12345678"
        }
    )

    assert response.status_code == 409


def test_login_user(client):
    """
    Este test comprueba que un usuario registrado
    puede hacer login y recibir un token.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"login_{unique}@test.com"
    username = f"loginuser_{unique}"
    ip_falsa = generar_ip_falsa(unique)

    register_response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": email,
            "password": "12345678"
        }
    )

    assert register_response.status_code == 201, register_response.text

    response = client.post(
        "/auth/login",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "email": email,
            "password": "12345678"
        }
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    """
    Este test comprueba que el login falla
    si la contraseña es incorrecta.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"wrong_{unique}@test.com"
    username = f"wronguser_{unique}"
    ip_falsa = generar_ip_falsa(unique)

    register_response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": email,
            "password": "12345678"
        }
    )

    assert register_response.status_code == 201, register_response.text

    response = client.post(
        "/auth/login",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "email": email,
            "password": "incorrecta"
        }
    )

    assert response.status_code == 401


def test_auth_me(client):
    """
    Este test comprueba que /auth/me devuelve
    el usuario autenticado a partir del token JWT.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"me_{unique}@test.com"
    username = f"meuser_{unique}"
    ip_falsa = generar_ip_falsa(unique)

    register_response = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "username": username,
            "email": email,
            "password": "12345678",
            "fecha_nacimiento": "1999-01-15",
            "pais": "España",
            "ciudad": "Sevilla"
        }
    )

    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/auth/login",
        headers={"X-Forwarded-For": ip_falsa},
        json={
            "email": email,
            "password": "12345678"
        }
    )

    assert login_response.status_code == 200, login_response.text

    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == email
    assert data["username"] == username
    assert data["fecha_nacimiento"] == "1999-01-15"
    assert data["pais"] == "España"
    assert data["ciudad"] == "Sevilla"