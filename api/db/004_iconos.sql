-- =========================================================
-- BeerMap - Migration 004: Sistema de iconos
-- =========================================================
-- Esta migración añade el sistema completo de iconos/emoticonos
-- con compra mediante puntos.
--
-- Tablas nuevas:
--   icons_catalog   — catálogo de iconos disponibles
--   user_owned_icons — iconos en posesión de cada usuario
--
-- Columna nueva en users:
--   active_icon_id  — icono seleccionado actualmente
--
-- Nota:
-- Se usa icons_catalog (no map_icons) para no colisionar
-- con la tabla legacy del modelo anterior.
-- Se usa user_owned_icons (no user_icons) por la misma razón.
--
-- Los iconos gratis no necesitan entrada en user_owned_icons;
-- se consideran disponibles para todos en el código de la API.
--
-- Ejecutar después de 003_avatar.sql
-- =========================================================


-- ─────────────────────────────────────────────────────────
-- CATÁLOGO DE ICONOS
-- ─────────────────────────────────────────────────────────
CREATE TABLE icons_catalog (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        VARCHAR(80)  NOT NULL,
    emoji         VARCHAR(10)  NOT NULL,
    descripcion   VARCHAR(200) NULL,
    coste_puntos  INTEGER      NOT NULL DEFAULT 0,
    -- gratis: disponible para todos sin coste
    -- premium: hay que comprarlo con puntos
    tipo          VARCHAR(10)  NOT NULL DEFAULT 'gratis',
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT icons_catalog_tipo_chk   CHECK (tipo IN ('gratis', 'premium')),
    CONSTRAINT icons_catalog_coste_chk  CHECK (coste_puntos >= 0)
);


-- ─────────────────────────────────────────────────────────
-- ICONOS EN POSESIÓN DEL USUARIO
-- ─────────────────────────────────────────────────────────
CREATE TABLE user_owned_icons (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- CASCADE: si se borra el usuario, se borran sus iconos
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- CASCADE: si se borra el icono del catálogo, se retira del inventario
    icon_id      UUID        NOT NULL REFERENCES icons_catalog(id) ON DELETE CASCADE,

    adquirido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un usuario no puede tener el mismo icono dos veces
    CONSTRAINT user_owned_icons_unique UNIQUE (user_id, icon_id)
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_user_owned_icons_user_id
    ON user_owned_icons(user_id);

CREATE INDEX idx_user_owned_icons_icon_id
    ON user_owned_icons(icon_id);


-- ─────────────────────────────────────────────────────────
-- ICONO ACTIVO EN TABLA USERS
-- ─────────────────────────────────────────────────────────
-- NULL = usa el primer icono gratis por defecto
ALTER TABLE users
    ADD COLUMN active_icon_id UUID NULL
    REFERENCES icons_catalog(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────
-- CATÁLOGO INICIAL
-- ─────────────────────────────────────────────────────────
INSERT INTO icons_catalog (nombre, emoji, descripcion, coste_puntos, tipo) VALUES

-- Gratis (disponibles para todos sin coste)
('La Caña',   '🍺', 'el clásico de toda la vida', 0, 'gratis'),
('El Brindis', '🍻', 'pa celebrar',                0, 'gratis'),
('El Blandito','🥤', 'para el que no bebe',         0, 'gratis'),

-- Premium (hay que ganarse los puntos)
('El Vaquero',          '🤠', NULL,   500, 'premium'),
('El Mareado',          '🥴', NULL,   750, 'premium'),
('El Chulo',            '😎', NULL,  1000, 'premium'),
('El Rico',             '🤑', NULL,  1250, 'premium'),
('El Soldado',          '🫡', NULL,  1500, 'premium'),
('El Pato',             '🦆', NULL,  2000, 'premium'),
('La Rana',             '🐸', NULL,  2500, 'premium'),
('El Taco',             '🌮', NULL,  3000, 'premium'),
('El Flamenco',         '🦩', NULL,  3500, 'premium'),
('La Bola de Discoteca','🪩', NULL,  4000, 'premium'),
('El Dragón',           '🐉', NULL,  5000, 'premium'),
('El Demonio',          '👺', NULL,  6000, 'premium'),
('Las Burbujas',        '🫧', NULL,  7500, 'premium'),
('El Mago',             '🪄', NULL, 10000, 'premium');
