-- Migration: Switch from percentage-based to points-based scoring.
-- Removes the CHECK constraint that limited scores to 0-100.
-- Scores are now validated against each assignment's max_points in application code.
--
-- Usage:  mysql -u root -p school_db < DB/migrate-points-based-scoring.sql

ALTER TABLE assignment_grade DROP CHECK chk_score_range;
ALTER TABLE assignment_grade ADD CONSTRAINT chk_score_non_negative CHECK (score >= 0);
