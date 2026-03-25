-- =========================================================
-- 006 — Google Auth
-- =========================================================
-- La tabla user_auth_providers ya existe desde 001_init.sql
-- con soporte para provider='google'.
--
-- password_hash ya es nullable desde el inicio.
--
-- Solo aseguramos que user_devices existe (por si la BD
-- se creó antes de que se añadiera el modelo al código).
-- =========================================================

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(10) NOT NULL,
    push_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT device_platform_chk
        CHECK (platform IN ('android', 'ios')),

    CONSTRAINT device_unique
        UNIQUE (platform, push_token),

    CONSTRAINT device_user_unique
        UNIQUE (user_id, push_token)
);
