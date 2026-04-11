"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

interface Student {
  student_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
}

interface Course {
  course_id: number;
  course_name: string;
}

function parseStudents(json: unknown): Student[] {
  const rows =
    Array.isArray(json)
      ? json
      : json &&
          typeof json === "object" &&
          "students" in json &&
          Array.isArray((json as { students: unknown }).students)
        ? (json as { students: unknown[] }).students
        : [];
  return rows.map((r) => {
    const s = r as Record<string, unknown>;
    return {
      student_id: Number(s.student_id),
      first_name: String(s.first_name ?? ""),
      middle_name: String(s.middle_name ?? ""),
      last_name: String(s.last_name ?? ""),
    };
  });
}

export default function ManageStudents() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCourses, setEditCourses] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await fetch("/api/students?include_scores=true");
      if (!res.ok) throw new Error("Failed to fetch students");
      return parseStudents(await res.json());
    },
    staleTime: 30 * 1000,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json() as Promise<Course[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollments = [], refetch: refetchEnrollments } = useQuery({
    queryKey: ["enrollments", editingId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${editingId}/enrollments`);
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json() as Promise<Course[]>;
    },
    enabled: editingId !== null,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      studentId,
      courseIds,
    }: {
      studentId: number;
      courseIds: number[];
    }) => {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_ids: courseIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      refetchEnrollments();
      toast.success("Enrollments updated!");
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const startEditing = (studentId: number) => {
    setEditingId(studentId);
    setEditCourses([]);
  };

  const handleEnrollmentsLoaded = (enrolled: Course[]) => {
    setEditCourses(enrolled.map((c) => c.course_id));
  };

  const toggleCourse = (courseId: number) => {
    setEditCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const isEnrollmentsReady =
    editingId !== null && enrollments !== undefined;

  if (
    isEnrollmentsReady &&
    editCourses.length === 0 &&
    enrollments.length > 0
  ) {
    handleEnrollmentsLoaded(enrollments);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Manage Student Enrollments
        </h2>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
            <p className="text-slate-600 mt-4">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            No students yet. Add a student first.
          </p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.student_id}
                className="border border-slate-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-900">
                      {student.first_name}{" "}
                      {student.middle_name ? student.middle_name + " " : ""}
                      {student.last_name}
                    </span>
                    <span className="text-sm text-slate-400 ml-2">
                      ID: {student.student_id}
                    </span>
                  </div>
                  {editingId === student.student_id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          saveMutation.mutate({
                            studentId: student.student_id,
                            courseIds: editCourses,
                          })
                        }
                        disabled={saveMutation.isPending}
                        className="px-4 py-1.5 bg-black text-white text-sm rounded-lg font-medium hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {saveMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(student.student_id)}
                      className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                    >
                      Edit Courses
                    </button>
                  )}
                </div>

                {editingId === student.student_id && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {courses.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No courses available.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {courses.map((course) => (
                          <label
                            key={course.course_id}
                            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={editCourses.includes(course.course_id)}
                              onChange={() => toggleCourse(course.course_id)}
                              className="w-4 h-4 accent-black"
                            />
                            <span className="text-sm text-slate-900">
                              {course.course_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      {editCourses.length} course{editCourses.length !== 1 ? "s" : ""} selected
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
