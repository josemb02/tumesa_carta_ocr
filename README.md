# BeerMap API

Backend de una aplicación social orientada a registrar consumiciones, gestionar grupos, consultar rankings y permitir comunicación entre usuarios mediante chat.

El sistema está diseñado como un backend profesional, aplicando principios reales de arquitectura, seguridad, persistencia de datos y despliegue reproducible.

---

## Descripción

BeerMap es una API REST que permite:

- Registrar consumiciones (check-ins)
- Crear y gestionar grupos
- Consultar rankings globales y segmentados
- Enviar y leer mensajes en chats de grupo
- Autenticarse mediante JWT

El objetivo del proyecto es construir una base sólida, escalable y segura sobre la que poder desarrollar una aplicación real.

---

## Arquitectura del proyecto

El backend está organizado siguiendo separación de responsabilidades:

api/
└── app/
├── routers/ → Endpoints por funcionalidad
├── models.py → Modelos de base de datos
├── schemas.py → Validación de datos
├── database.py → Conexión a PostgreSQL
├── auth.py → Autenticación y JWT
├── middleware.py → Middleware global
├── ratelimit.py → Protección contra abuso
├── audit.py → Registro de acciones
├── config.py → Configuración del sistema
├── exceptions.py → Manejo de errores
└── main.py → Punto de entrada
Esta estructura permite mantener el código limpio, escalable y fácil de mantener.

---

## Stack tecnológico

### Backend
- FastAPI → Framework principal para la API
- Python → Lenguaje del backend
- SQLAlchemy → ORM para base de datos
- Pydantic → Validación de datos

### Base de datos
- PostgreSQL → Base de datos relacional principal

### Seguridad
- JWT → Autenticación basada en tokens
- Bcrypt → Hash de contraseñas
- Rate limiting → Protección contra ataques
- Auditoría → Registro de acciones

### Infraestructura
- Docker → Contenedorización
- Docker Compose → Orquestación de servicios

### Servicios auxiliares
- Redis → Memoria en caché y control de peticiones
- Adminer → Gestión visual de base de datos

### Testing
- Pytest → Tests automáticos
- Postman → Tests manuales

### CI/CD
- GitHub Actions → Automatización de pruebas y validación

---

## Explicación técnica de componentes

### FastAPI
Framework usado para construir la API REST.

Permite:
- Crear endpoints rápidamente
- Validar datos automáticamente
- Generar documentación Swagger
- Mantener código limpio y tipado

---

### PostgreSQL
Base de datos principal del sistema.

Se utiliza para almacenar:
- Usuarios
- Grupos
- Mensajes
- Check-ins
- Rankings
- Auditoría

Permite relaciones estructuradas y consultas eficientes.

---

### Redis
Servicio en memoria de alto rendimiento.

Se utiliza para:

- Controlar número de intentos de login
- Evitar ataques de fuerza bruta
- Limitar peticiones repetidas
- Preparar el sistema para cache

Ejemplo real:
Si un usuario intenta hacer login muchas veces seguidas, Redis guarda ese contador y bloquea temporalmente.

Esto evita sobrecargar la base de datos y mejora la seguridad.

---

### JWT (Autenticación)
Sistema de autenticación basado en tokens.

Flujo:
1. Usuario hace login
2. Se genera un token
3. El cliente lo guarda
4. Se usa en cada petición

Ejemplo:

Authorization: Bearer TOKEN

Permite proteger endpoints sin reenviar credenciales.

---

### Bcrypt
Sistema de hash de contraseñas.

Sirve para:
- No guardar contraseñas en texto plano
- Evitar filtraciones de datos sensibles

---

### Docker
Permite ejecutar cada parte del sistema en un contenedor independiente.

Ventajas:
- Entorno reproducible
- Aislamiento de servicios
- Fácil despliegue

---

### Docker Compose
Permite levantar todo el sistema con un solo comando:

docker-compose up --build

Coordina:
- API
- Base de datos
- Redis
- Adminer
- Frontend

---

### GitHub Actions
Sistema de CI/CD.

Sirve para:
- Ejecutar tests automáticamente
- Validar el código al subir cambios
- Evitar errores en producción

---

## Variables de entorno

### DATABASE_URL
Cadena de conexión a PostgreSQL.

Indica:
- usuario
- contraseña
- host
- base de datos

Ejemplo:
DATABASE_URL=postgresql://user:pass@db:5432/beermap

---

### JWT_SECRET
Clave para firmar tokens.

Sirve para evitar que los tokens puedan ser falsificados.

---

### REDIS_URL
Conexión con Redis.

Se usa para rate limiting y control de peticiones.

---

### LOGIN_MAX_ATTEMPTS
Número máximo de intentos de login.

Sirve para bloquear ataques de fuerza bruta.

---

### CHECKIN_COOLDOWN_SECONDS
Tiempo mínimo entre check-ins.

Evita spam y abuso del sistema.

---

## Funcionalidades principales

### Usuarios
- Registro
- Login
- Perfil autenticado

---

### Check-ins
- Registrar consumiciones
- Añadir localización
- Sumar puntos

---

### Rankings
- Ranking global
- Ranking por grupo
- Ranking por ubicación

Optimizado mediante tabla de puntos acumulados.

---

### Grupos
- Crear grupo
- Unirse por código
- Listar miembros

---

### Chat
- Enviar mensajes
- Leer mensajes
- Acceso restringido a miembros

---

## Seguridad aplicada

- Autenticación JWT
- Contraseñas hasheadas
- Rate limiting en login
- Validación de acceso a recursos
- Control de errores
- Uso de ORM para evitar inyección SQL
- Registro de acciones

---

## Ejecución del proyecto

Ejecutar:

docker-compose up --build

---

## Accesos

- API → http://localhost:8000  
- Docs → http://localhost:8000/docs  
- Frontend → http://localhost:5000  
- Adminer → http://localhost:8081  

---

## Testing

El proyecto incluye:

- Tests automáticos con Pytest
- Colección Postman para pruebas manuales

---

## Estado del proyecto

- Backend completo
- Seguridad implementada
- Docker operativo
- CI/CD activo
- Frontend en desarrollo

---

## Conclusión

BeerMap es un backend diseñado con enfoque profesional, preparado para:

- escalar
- integrarse con frontend
- desplegarse en entornos reales

Se han aplicado prácticas reales de desarrollo, seguridad e infraestructura.

---

## Autor

Proyecto desarrollado como base real de backend para aplicación social.