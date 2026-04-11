USE school_db;

-- Remove duplicate grade rows, keeping the one with the highest score_id (latest entry).
DELETE ag1 FROM assignment_grade ag1
INNER JOIN assignment_grade ag2
  ON ag1.student_id = ag2.student_id
 AND ag1.assignment_id = ag2.assignment_id
 AND ag1.score_id < ag2.score_id;

-- Now enforce one grade per student per assignment.
ALTER TABLE assignment_grade
  ADD UNIQUE KEY unique_student_assignment (student_id, assignment_id);
