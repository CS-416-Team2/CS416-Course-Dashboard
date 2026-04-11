USE school_db;

-- Track which instructor created each student for per-user data isolation.
ALTER TABLE students
  ADD COLUMN created_by INT NULL AFTER last_name,
  ADD CONSTRAINT fk_students_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Assign existing students to the default instructor (user_id = 1).
UPDATE students SET created_by = 1 WHERE created_by IS NULL;
