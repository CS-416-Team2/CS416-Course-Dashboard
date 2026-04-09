USE project2;

-- 1. Users (Instructors)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL
);

-- 2. Students
-- UPDATED: Removed AUTO_INCREMENT to allow manual ID insertion.
-- ADDED: Constraint to strictly enforce IDs between 1 and 10.
CREATE TABLE students (
    student_id INT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    CONSTRAINT chk_student_id CHECK (student_id >= 1 AND student_id <= 10)
);

-- 3. Courses
-- Linked to users (instructor_id)
CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (instructor_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Assignments
-- Linked to courses
CREATE TABLE assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    max_points INT NOT NULL DEFAULT 100,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- 5. Enrollments
-- Junction table for Courses and Students to handle the "has_roster" logic
CREATE TABLE enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    overall_grade DECIMAL(5, 2) DEFAULT 0.00,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    -- Ensures a student isn't enrolled in the same course twice
    UNIQUE KEY unique_enrollment (student_id, course_id)
);

-- 6. Assignment Grade
-- Individual scores for students on specific assignments
CREATE TABLE assignment_grade (
    score_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    assignment_id INT NOT NULL,
    score DECIMAL(5, 2) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    -- Logic constraint for the score range
    CONSTRAINT chk_score_range CHECK (score >= 0 AND score <= 100)
);

USE project2; 
-- 1. Force the Instructor to be user_id = 1
INSERT INTO users (user_id, email, password_hash, first_name, last_name) 
VALUES (1, 'david.dai@pnw.edu', 'hashed_pass_123', 'David', 'Dai');

-- 2. Force the Course to be course_id = 1 (and link it to user 1)
INSERT INTO courses (course_id, instructor_id, course_name) 
VALUES (1, 1, 'Software Engineering Course Management');

-- 3. Force the Assignment to be assignment_id = 1 (and link it to course 1)
INSERT INTO assignments (assignment_id, course_id, title, max_points) 
VALUES (1, 1, 'Initial Web Project', 100);

