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

```
api/
└── api_app/
├── routers/ → Endpoints por funcionalidad (auth, chat, grupos, rankings, check-ins)
├── models.py → Modelos de base de datos
├── schemas.py → Validación de datos
├── database.py → Conexión a PostgreSQL
├── auth.py → Autenticación y JWT
├── middleware.py → Middleware global
├── ratelimit.py → Protección contra abuso
├── audit.py → Registro de acciones del sistema
├── config.py → Configuración del sistema
├── exceptions.py → Manejo centralizado de errores
└── main.py → Punto de entrada
```

Estructura adicional del proyecto:

```
api/
├── db/ → Script SQL inicial
├── tests/ → Tests automatizados con Pytest
├── postman/ → Colección de pruebas manuales
├── exceptions/ → Sistema avanzado de manejo de errores
```

Esta estructura permite mantener el código limpio, escalable, mantenible y alineado con estándares profesionales de desarrollo backend.

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

## Arquitectura de contenedores

El sistema se ejecuta completamente mediante Docker Compose, permitiendo un entorno reproducible, aislado y preparado para despliegue.

### API (FastAPI)
Contenedor principal del sistema.

Se encarga de:
- Exponer los endpoints REST
- Gestionar la lógica de negocio
- Aplicar la autenticación y seguridad
- Validar datos
- Comunicarse con PostgreSQL y Redis

---

### PostgreSQL
Base de datos relacional donde se almacenan:

- Usuarios
- Grupos
- Check-ins
- Rankings
- Mensajes
- Auditoría

Permite integridad de datos y consultas eficientes.

---

### Redis
Servicio en memoria de alto rendimiento.

Se utiliza para:

- Controlar intentos de login
- Aplicar rate limiting
- Evitar ataques de fuerza bruta
- Optimizar rendimiento del sistema

Ejemplo real:
Si un usuario intenta iniciar sesión múltiples veces en poco tiempo, Redis bloquea temporalmente el acceso.

---

### Adminer
Interfaz web para gestión de base de datos.

Permite:
- Visualizar tablas
- Ejecutar consultas
- Administrar datos fácilmente

---

### Frontend
Aplicación cliente que consume la API y permite la interacción del usuario con el sistema.

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
Servicio en memoria de alto rendimiento que refuerza la seguridad y el rendimiento.

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

---

### Bcrypt
Sistema de hash de contraseñas que garantiza que no se almacenen credenciales en texto plano.

---

### Docker
Permite ejecutar cada parte del sistema en contenedores independientes.

Ventajas:
- Entorno reproducible
- Aislamiento de servicios
- Facilidad de despliegue

---

### Docker Compose
Permite levantar todo el sistema con un solo comando:

```
docker-compose up --build
```

Coordina:
- API
- Base de datos
- Redis
- Adminer
- Frontend

---

### GitHub Actions
Sistema de CI/CD que:

- Ejecuta tests automáticamente
- Valida el código en cada cambio
- Garantiza estabilidad del sistema

---

## Variables de entorno

### DATABASE_URL
Cadena de conexión a PostgreSQL.

Ejemplo:
```
DATABASE_URL=postgresql://user:pass@db:5432/beermap
```

---

### JWT_SECRET
Clave para firmar tokens y garantizar su autenticidad.

---

### REDIS_URL
Conexión con Redis.

---

### LOGIN_MAX_ATTEMPTS
Número máximo de intentos de login antes de bloqueo.

---

### CHECKIN_COOLDOWN_SECONDS
Tiempo mínimo entre acciones para evitar abuso del sistema.

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
- Sistema de puntos

---

### Rankings
- Ranking global
- Ranking por grupo
- Ranking por ubicación

---

### Grupos
- Crear grupo
- Unirse por código
- Gestión de miembros

---

### Chat
- Envío de mensajes
- Lectura de mensajes
- Acceso restringido

---

## Seguridad aplicada

El sistema incorpora múltiples capas de seguridad:

- Autenticación JWT
- Contraseñas hasheadas con bcrypt
- Rate limiting en login
- Validación de acceso a recursos
- Control de errores centralizado
- Uso de ORM para evitar inyección SQL
- Registro de acciones mediante auditoría

Además, se han aplicado medidas basadas en OWASP Top 10.

👉 Ver documento completo de seguridad:
[OWASP.md](./OWASP.md)

---

## Testing

El proyecto incluye:

### Tests automáticos
Ejecutar:
```
pytest
```

Incluye pruebas de:
- autenticación
- chat
- check-ins
- grupos
- rankings

---

### Tests manuales
Colección Postman incluida en:
```
api/postman/BeerMap.postman_collection.json
```

---

## Ejecución del proyecto

Ejecutar:

```
docker-compose up --build
```

Esto levanta todos los servicios del sistema de forma coordinada.

---

## Accesos

- API → http://localhost:8000  
- Docs → http://localhost:8000/docs  
- Frontend → http://localhost:5000  
- Adminer → http://localhost:8081  

---

## Estado del proyecto

- Backend completamente funcional
- Seguridad implementada
- Arquitectura modular
- Contenedores operativos
- Testing integrado
- CI/CD activo

---

## Conclusión

BeerMap es un backend desarrollado con enfoque profesional que integra:

- Arquitectura limpia y modular
- Seguridad aplicada en múltiples niveles
- Testing automatizado
- Infraestructura contenerizada

El sistema está preparado para escalar, integrarse con clientes reales y desplegarse en entornos productivos.

---

## Autor

Proyecto desarrollado como base real de backend para aplicación social.