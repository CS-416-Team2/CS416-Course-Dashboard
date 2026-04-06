CREATE DATABASE IF NOT EXISTS course_management;
USE course_management;

CREATE TABLE students (
    student_id INT PRIMARY KEY CHECK (student_id BETWEEN 1 AND 10),
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL
);

CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL
);

CREATE TABLE grades (
    grade_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    CONSTRAINT chk_score_range CHECK (score BETWEEN 0 AND 100)
);
