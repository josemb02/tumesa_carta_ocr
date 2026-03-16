-- =========================================================
-- BeerMap - esquema PostgreSQL definitivo
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(254) UNIQUE,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash TEXT,

    fecha_nacimiento DATE,
    pais VARCHAR(80),
    ciudad VARCHAR(120),

    role VARCHAR(10) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_role_chk
        CHECK (role IN ('user','admin')),

    CONSTRAINT users_username_chk
        CHECK (LENGTH(username) >= 3),

    CONSTRAINT users_email_chk
        CHECK (email IS NULL OR POSITION('@' IN email) > 1)
);

-- =========================================================
-- USER AUTH PROVIDERS
-- =========================================================

CREATE TABLE user_auth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT auth_provider_chk
        CHECK (provider IN ('google','apple')),

    CONSTRAINT auth_unique
        UNIQUE (provider, provider_user_id)
);

-- =========================================================
-- MAP ICONS
-- =========================================================

CREATE TABLE map_icons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(40) NOT NULL UNIQUE,
    label VARCHAR(80) NOT NULL,

    price_points INTEGER NOT NULL DEFAULT 0,
    min_points INTEGER NOT NULL DEFAULT 0,

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT icon_price_chk
        CHECK (price_points >= 0),

    CONSTRAINT icon_min_points_chk
        CHECK (min_points >= 0)
);

-- =========================================================
-- USER ICONS
-- =========================================================

CREATE TABLE user_icons (
    user_id UUID NOT NULL,
    icon_id UUID NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, icon_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (icon_id)
        REFERENCES map_icons(id)
        ON DELETE RESTRICT
);

-- =========================================================
-- USER SETTINGS
-- =========================================================

CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY,
    selected_icon_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (selected_icon_id)
        REFERENCES map_icons(id)
        ON DELETE SET NULL
);

-- =========================================================
-- GROUPS
-- =========================================================

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

-- =========================================================
-- GROUP MEMBERS
-- =========================================================

CREATE TABLE group_members (
    group_id UUID NOT NULL,
    user_id UUID NOT NULL,

    role VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (group_id, user_id),

    FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT group_member_role_chk
        CHECK (role IN ('member','admin'))
);

-- =========================================================
-- CHECKINS
-- =========================================================

CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    group_id UUID,
    icon_id UUID,

    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,

    precio NUMERIC(6,2),

    note VARCHAR(180),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE SET NULL,

    FOREIGN KEY (icon_id)
        REFERENCES map_icons(id)
        ON DELETE SET NULL,

    CONSTRAINT checkins_lat_chk
        CHECK (lat >= -90 AND lat <= 90),

    CONSTRAINT checkins_lng_chk
        CHECK (lng >= -180 AND lng <= 180),

    CONSTRAINT checkins_precio_chk
        CHECK (precio IS NULL OR precio >= 0)
);

-- =========================================================
-- CHECKIN PHOTOS
-- =========================================================

CREATE TABLE checkin_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL,
    user_id UUID NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (checkin_id)
        REFERENCES checkins(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================================
-- POINTS LEDGER
-- =========================================================

CREATE TABLE points_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    delta INTEGER NOT NULL,
    reason VARCHAR(40) NOT NULL,
    ref_type VARCHAR(40),
    ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT points_reason_chk
        CHECK (reason IN ('checkin','buy_icon','admin_adjust','purchase'))
);

-- =========================================================
-- GROUP MESSAGES
-- =========================================================

CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================================
-- USER DEVICES
-- =========================================================

CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform VARCHAR(10) NOT NULL,
    push_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT device_platform_chk
        CHECK (platform IN ('android','ios')),

    CONSTRAINT device_unique
        UNIQUE (platform, push_token),

    CONSTRAINT device_user_unique
        UNIQUE (user_id, push_token)
);

-- =========================================================
-- USER POINTS TOTAL
-- =========================================================

CREATE TABLE user_points_total (

    user_id UUID PRIMARY KEY,

    total_points INTEGER NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_points_total_chk
        CHECK (total_points >= 0)
);

-- =========================================================
-- AUDIT LOGS
-- =========================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(80) NOT NULL,
    ip VARCHAR(45),
    user_agent VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ÍNDICES
-- =========================================================

-- checkins
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_group_id ON checkins(group_id);
CREATE INDEX idx_checkins_created_at ON checkins(created_at);
CREATE INDEX idx_checkins_lat_lng ON checkins(lat,lng);

-- rankings
CREATE INDEX idx_users_country ON users(pais);
CREATE INDEX idx_users_city ON users(ciudad);

-- chat
CREATE INDEX idx_group_messages_group_created
ON group_messages(group_id, created_at);

-- ledger
CREATE INDEX idx_points_ledger_user_id ON points_ledger(user_id);
CREATE INDEX idx_points_ledger_created_at ON points_ledger(created_at);

-- audit
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- misc
CREATE INDEX idx_user_auth_providers_user_id ON user_auth_providers(user_id);
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_checkin_photos_checkin_id ON checkin_photos(checkin_id);

CREATE INDEX idx_user_points_total_points
ON user_points_total(total_points DESC);