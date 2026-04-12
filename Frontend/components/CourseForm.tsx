"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { CourseWithCounts } from "@/lib/schemas";

export default function CourseForm() {
  const [courseName, setCourseName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json() as Promise<CourseWithCounts[]>;
    },
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (data: { course_name: string }) => {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add course");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setCourseName("");
      toast.success("Course added successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add course");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ courseId, name }: { courseId: number; name: string }) => {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_name: name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditingId(null);
      toast.success("Course renamed!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (courseId: number) => {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Course deleted!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ course_name: courseName });
  };

  const handleDelete = (course: CourseWithCounts) => {
    if (!window.confirm(`Delete "${course.course_name}"? This will also remove all its assignments, enrollments, and grades.`)) return;
    deleteMutation.mutate(course.course_id);
  };

  const startRename = (course: CourseWithCounts) => {
    setEditingId(course.course_id);
    setEditName(course.course_name);
  };

  const submitRename = () => {
    if (!editingId || !editName.trim()) return;
    renameMutation.mutate({ courseId: editingId, name: editName.trim() });
  };

  return (
    <>
      <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
        <h2 className="text-2xl font-semibold text-black mb-6">Add Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Course Name *
            </label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Introduction to Computer Science"
              required
              maxLength={100}
              className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full px-4 cursor-pointer py-2 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Adding..." : "Add Course"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Courses</h2>
          {coursesLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
              <p className="text-slate-600 mt-4">Loading courses...</p>
            </div>
          ) : courses.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No courses yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <div key={course.course_id} className="border border-slate-200 rounded-lg p-4">
                  {editingId === course.course_id ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setEditingId(null); }}
                        maxLength={100}
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      />
                      <button
                        onClick={submitRename}
                        disabled={renameMutation.isPending || !editName.trim()}
                        className="px-4 py-1.5 bg-black text-white text-sm rounded-lg font-medium hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {renameMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-900">{course.course_name}</span>
                        <span className="text-sm text-slate-400 ml-3">
                          {course.student_count} student{course.student_count !== 1 ? "s" : ""} · {course.assignment_count} assignment{course.assignment_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startRename(course)}
                          className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(course)}
                          disabled={deleteMutation.isPending}
                          className="px-4 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg font-medium hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
