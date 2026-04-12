import { z } from "zod";

export const courseSchema = z.object({
  course_id: z.number(),
  course_name: z.string(),
});

export const courseWithCountsSchema = courseSchema.extend({
  student_count: z.number(),
  assignment_count: z.number(),
});

export const assignmentSchema = z.object({
  assignment_id: z.number(),
  title: z.string(),
  max_points: z.number(),
});

export const assignmentWithGradeCountSchema = assignmentSchema.extend({
  grade_count: z.number(),
});

export const assignmentAllSchema = assignmentWithGradeCountSchema.extend({
  course_id: z.number(),
  course_name: z.string(),
});

export const studentSchema = z.object({
  student_id: z.number(),
  first_name: z.string(),
  middle_name: z.string(),
  last_name: z.string(),
});

export const studentWithScoreSchema = z.object({
  student_id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  average_score: z.number(),
});

export const studentGradeSchema = studentSchema.extend({
  score: z.number().nullable(),
  score_id: z.number().nullable(),
});

export const statsSchema = z.object({
  totalStudents: z.number(),
  enrolledStudents: z.number(),
  averageScore: z.number(),
  highestScore: z.number(),
  passingRate: z.number(),
});

export const csvRowSchema = z.object({
  student_id: z.number(),
  first_name: z.string(),
  middle_name: z.string(),
  last_name: z.string(),
  score: z.number(),
  error: z.string().optional(),
});

export type Course = z.infer<typeof courseSchema>;
export type CourseWithCounts = z.infer<typeof courseWithCountsSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignmentWithGradeCount = z.infer<typeof assignmentWithGradeCountSchema>;
export type AssignmentAll = z.infer<typeof assignmentAllSchema>;
export type Student = z.infer<typeof studentSchema>;
export type StudentWithScore = z.infer<typeof studentWithScoreSchema>;
export type StudentGrade = z.infer<typeof studentGradeSchema>;
export type Stats = z.infer<typeof statsSchema>;
export type CsvRow = z.infer<typeof csvRowSchema>;
