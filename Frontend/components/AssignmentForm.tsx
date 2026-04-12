"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { Course, AssignmentAll } from "@/lib/schemas";

export default function AssignmentForm() {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMaxPts, setEditMaxPts] = useState("");
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const response = await fetch("/api/courses");
      if (!response.ok) throw new Error("Failed to fetch courses");
      return response.json() as Promise<Course[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments", "all"],
    queryFn: async () => {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json() as Promise<AssignmentAll[]>;
    },
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { course_id: number; title: string; max_points: number }) => {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add assignment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setTitle("");
      setMaxPoints("100");
      toast.success("Assignment added!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add assignment");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, max_points }: { id: number; title: string; max_points: number }) => {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, max_points }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update assignment");
      }
      return res.json() as Promise<{ message: string; grades_cleared: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setEditingId(null);
      toast.success(data.message);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete assignment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Assignment deleted!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      course_id: parseInt(courseId),
      title,
      max_points: parseInt(maxPoints),
    });
  }

  const startEditing = (a: AssignmentAll) => {
    setEditingId(a.assignment_id);
    setEditTitle(a.title);
    setEditMaxPts(String(a.max_points));
  };

  const submitEdit = (original: AssignmentAll) => {
    if (!editTitle.trim() || !editMaxPts || Number(editMaxPts) <= 0) return;
    const newMax = Number(editMaxPts);

    if (newMax !== original.max_points && original.grade_count > 0) {
      if (!window.confirm("Changing max points will clear all existing grades for this assignment. Continue?")) return;
    }

    updateMutation.mutate({
      id: original.assignment_id,
      title: editTitle.trim(),
      max_points: newMax,
    });
  };

  const courseGroups = allAssignments.reduce<Record<string, AssignmentAll[]>>((acc, a) => {
    const key = a.course_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <>
      <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
        <h2 className="text-2xl font-semibold text-black mb-6">Add Assignment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">Course *</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              disabled={coursesLoading}
              className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
            >
              <option value="">
                {coursesLoading ? "Loading courses..." : "Select a course"}
              </option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">Assignment Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Exam"
              required
              maxLength={100}
              className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">Max Points</label>
            <input
              type="number"
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
              placeholder="100"
              required
              min="1"
              max="999"
              className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full px-4 cursor-pointer py-2 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "Adding..." : "Add Assignment"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Assignments</h2>
          {assignmentsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
              <p className="text-slate-600 mt-4">Loading assignments...</p>
            </div>
          ) : allAssignments.length === 0 ? (
            <p className="text-slate-500 text-center py-12">
              No assignments yet. Create one above.
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(courseGroups).map(([courseName, items]) => (
                <div key={courseName}>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {courseName}
                  </h3>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.assignment_id} className="border border-slate-200 rounded-lg p-4">
                        {editingId === a.assignment_id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") submitEdit(a); if (e.key === "Escape") setEditingId(null); }}
                                  maxLength={100}
                                  autoFocus
                                  className="w-full px-3 py-1.5 text-sm text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Max Points</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editMaxPts}
                                  onChange={(e) => setEditMaxPts(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") submitEdit(a); if (e.key === "Escape") setEditingId(null); }}
                                  className="w-full px-3 py-1.5 text-sm text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                />
                              </div>
                            </div>
                            {Number(editMaxPts) !== a.max_points && Number(editMaxPts) > 0 && a.grade_count > 0 && (
                              <p className="text-xs text-amber-600">
                                Changing max points will clear all {a.grade_count} existing grade{a.grade_count !== 1 ? "s" : ""}.
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => submitEdit(a)}
                                disabled={updateMutation.isPending || !editTitle.trim() || !editMaxPts || Number(editMaxPts) <= 0}
                                className="px-4 py-1.5 bg-black text-white text-sm rounded-lg font-medium hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                              >
                                {updateMutation.isPending ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium text-slate-900">{a.title}</span>
                              <span className="text-sm text-slate-400 ml-3">
                                {a.max_points} pts · {a.grade_count} grade{a.grade_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditing(a)}
                                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (!window.confirm(`Delete "${a.title}"? All grades for this assignment will be removed.`)) return;
                                  deleteMutation.mutate(a.assignment_id);
                                }}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
