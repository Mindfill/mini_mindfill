-- 2026-09-18 — model_usage.usage_type values for note uploads.
--
-- The §2 extraction chain logs its model calls as 'notes_upload' (page
-- vision + section structuring), and §2.3 figure descriptions as
-- 'notes_figures'. Neither value was ever added to usage_type_enum, so every
-- one of those inserts failed silently (log_usage swallowed the error) and
-- upload spend never reached model_usage. Rows lost before this runs cannot
-- be recovered.
--
-- Safe to run more than once. ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block in older Postgres — run these as plain statements.

ALTER TYPE usage_type_enum ADD VALUE IF NOT EXISTS 'notes_upload';
ALTER TYPE usage_type_enum ADD VALUE IF NOT EXISTS 'notes_figures';
