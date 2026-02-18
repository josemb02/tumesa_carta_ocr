# TuMesa - Carta OCR (MVP)

Este proyecto es un MVP para la asignatura **Puesta en Producción Segura**.

La idea es sencilla: poder guardar la carta de un bar en formato JSON (más adelante vendría de un OCR) y recuperarla desde una API en Python.

## Qué incluye
- API en **FastAPI (Python)**
- Base de datos **PostgreSQL**
- Despliegue con **Docker Compose** (varios contenedores)
- Endpoints base:
  - `GET /health`
  - `POST /menus/guardar?barId=1`
  - `GET /menus/{barId}`

## Cómo ejecutar (producción local)
1. Copiar `.env.example` a `.env` y cambiar la contraseña.
2. Levantar con Docker:

```bash
docker compose up -d --build
