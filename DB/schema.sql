CREATE DATABASE IF NOT EXISTS school_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE school_db;

-- 1. Users (Instructors + Auth metadata)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    -- Increment this when privileges change to invalidate old sessions.
    session_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Refresh tokens for long-lived session rotation
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    refresh_token_id CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    replaced_by_token_hash CHAR(64) NULL,
    created_by_ip VARCHAR(45) NULL,
    created_by_user_agent VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_refresh_user_expires (user_id, expires_at),
    INDEX idx_refresh_token_hash (token_hash)
);

-- 3. Students
CREATE TABLE IF NOT EXISTS students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL
);

-- 4. Courses
-- linked to users (instructor_id)
CREATE TABLE IF NOT EXISTS courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (instructor_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. Assignments
-- linked to courses
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    max_points INT NOT NULL DEFAULT 100,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- 6. Enrollments
-- Junction table for Courses and Students to handle the "has_roster" logic
CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    overall_grade DECIMAL(5, 2) DEFAULT 0.00,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    -- Ensures a student isn't enrolled in the same course twice
    UNIQUE KEY unique_enrollment (student_id, course_id)
);

-- 7. Assignment Grade
-- Individual scores for students on specific assignments
CREATE TABLE IF NOT EXISTS assignment_grade (
    score_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    assignment_id INT NOT NULL,
    score DECIMAL(5, 2) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    -- Logic constraint for the score range
    CONSTRAINT chk_score_range CHECK (score >= 0 AND score <= 100)
);

-- Backfill auth columns for older databases that created users before auth upgrade.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Seed default instructor:
-- Email: admin@school.edu
-- Password: ChangeMe123! (change immediately in production)
INSERT INTO users (user_id, email, password_hash, first_name, last_name, is_active, session_version)
VALUES (
  1,
  'admin@school.edu',
  '$2b$12$yfSwpRl7PUeXJLpCS6bbdeq2dbBl1Q/aEmD7b00nCHPUchSapNcD.',
  'Default',
  'Instructor',
  1,
  1
)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  is_active = VALUES(is_active),
  session_version = VALUES(session_version),
  password_hash = CASE
    WHEN password_hash = 'placeholder' THEN VALUES(password_hash)
    ELSE password_hash
  END;
