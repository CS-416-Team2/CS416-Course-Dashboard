"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { Student, Course } from "@/lib/schemas";

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
  const [editFirst, setEditFirst] = useState("");
  const [editMiddle, setEditMiddle] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editCourses, setEditCourses] = useState<number[]>([]);
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await fetch("/api/students");
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

  const deleteMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete student");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Student deleted!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      studentId,
      firstName,
      middleName,
      lastName,
      courseIds,
    }: {
      studentId: number;
      firstName: string;
      middleName: string;
      lastName: string;
      courseIds: number[];
    }) => {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          course_ids: courseIds,
        }),
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
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      refetchEnrollments();
      toast.success("Student updated!");
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const startEditing = (student: Student) => {
    setEditingId(student.student_id);
    setEditFirst(student.first_name);
    setEditMiddle(student.middle_name);
    setEditLast(student.last_name);
    setEditCourses([]);
    setEnrollmentsLoaded(false);
  };

  const toggleCourse = (courseId: number) => {
    setEditCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  if (editingId !== null && !enrollmentsLoaded && enrollments.length > 0) {
    setEditCourses(enrollments.map((c) => c.course_id));
    setEnrollmentsLoaded(true);
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
                            firstName: editFirst.trim(),
                            middleName: editMiddle.trim(),
                            lastName: editLast.trim(),
                            courseIds: editCourses,
                          })
                        }
                        disabled={saveMutation.isPending || !editFirst.trim() || !editLast.trim()}
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(student)}
                        className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete ${student.first_name} ${student.last_name}? This will remove all their enrollments and grades.`)) return;
                          deleteMutation.mutate(student.student_id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg font-medium hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {editingId === student.student_id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">First Name *</label>
                        <input
                          type="text"
                          value={editFirst}
                          onChange={(e) => setEditFirst(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Middle Name</label>
                        <input
                          type="text"
                          value={editMiddle}
                          onChange={(e) => setEditMiddle(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={editLast}
                          onChange={(e) => setEditLast(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2">Enrolled Courses</label>
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
