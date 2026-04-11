-- Migration: Add auth columns to an existing users table.
-- Only needed if your database was created BEFORE the auth upgrade.
-- Skip this if you ran schema.sql fresh — those columns already exist.
--
-- Usage:  mysql -u root -p school_db < DB/migrate-add-auth-columns.sql

-- MySQL doesn't support ADD COLUMN IF NOT EXISTS, so these will
-- error harmlessly if the columns already exist.

ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
