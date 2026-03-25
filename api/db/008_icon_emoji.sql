-- Migración 008: añadir columna icon_emoji a checkins
-- Guarda el emoji del icono elegido de forma desnormalizada
-- para no depender de la FK a map_icons (que no tiene campo emoji).

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(10) NULL;
