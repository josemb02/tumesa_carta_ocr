-- =========================================================
-- 007 — Foto en check-in
-- =========================================================
-- Añade una URL de foto opcional directamente en la fila
-- del check-in. Un check-in puede tener como máximo una foto.
-- El frontend sube la imagen a Cloudinary y aquí solo se guarda
-- la URL pública resultante.
-- =========================================================

ALTER TABLE checkins
    ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL;
