# TuMesa - Carta OCR (MVP)

Este proyecto es un MVP para la asignatura **Puesta en Producción Segura**.

El objetivo del proyecto es permitir que un bar pueda guardar su carta en formato JSON a través de una API segura y posteriormente recuperarla. En una fase futura, ese JSON vendría generado automáticamente desde un OCR que lea una imagen de la carta.

En este proyecto me he centrado especialmente en aplicar buenas prácticas de desarrollo seguro alineadas con **OWASP Top 10 2025**, además de preparar el backend como si fuera un entorno de producción real utilizando Docker, control de errores profesional, logging y tests automatizados.

## Qué incluye

- API en **FastAPI (Python 3)**
- Base de datos **PostgreSQL**
- ORM con **SQLAlchemy**
- Validación fuerte con **Pydantic**
- Manejo global de errores (sin exponer stacktrace al cliente)
- Logging de peticiones y errores
- Middlewares de seguridad alineados con **OWASP Top 10 2025**
- Límite de tamaño del body (protección básica anti-DoS)
- Tests automatizados con **pytest + httpx**
- Despliegue con **Docker Compose** (API + BD)
- Colección de **Postman** para pruebas externas

Endpoints base:

- `GET /health`
- `POST /menus/guardar?barId=1`
- `GET /menus/{barId}`

## Seguridad aplicada (OWASP Top 10 2025)

Medidas aplicadas en este MVP:

- A03 (Injection): uso de SQLAlchemy ORM (sin SQL crudo) para reducir riesgo de SQL Injection.

- A04 (Insecure Design): validación estricta con Pydantic (nombre obligatorio, precios no negativos, estructura controlada).

- A05 (Security Misconfiguration): configuración por variables de entorno con `.env` (no se suben secretos al repositorio).

- A09 (Logging and Monitoring Failures): logging de peticiones (método, ruta, status y tiempo) y registro interno de errores.

- Cabeceras de seguridad HTTP: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

- Límite de tamaño del body para mitigar intentos básicos de denegación de servicio.

Además:

- Handler global para errores de validación (422).
- Handler global para errores inesperados (500) sin exponer información sensible.
- Separación clara entre lógica de negocio, modelos, esquemas y manejo de excepciones.

## Estructura del proyecto

app/
- main.py
- models.py
- schemas.py
- database.py

exceptions/
- custom_exceptions.py
- handlers.py

tests/
- test_health.py
- test_menus.py

postman/
- TuMesa Carta OCR.postman_collection.json

Dockerfile  
docker-compose.yml  
requirements.txt  
.env.example  

## Tests automatizados

Ejecutar tests:

```bash
pytest
```

Incluye pruebas para:

- GET /health
- Guardar un menú y recuperarlo
- Validación de JSON inválido (422)

## Cómo ejecutar (producción local)

1. Copiar `.env.example` a `.env` y cambiar la contraseña.
2. Levantar con Docker:

```bash
docker compose up -d --build
```

La API queda disponible en:

http://localhost:8000

Documentación Swagger:

http://localhost:8000/docs
