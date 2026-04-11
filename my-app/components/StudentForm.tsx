"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

interface Course {
  course_id: number;
  course_name: string;
}

export default function StudentForm() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json() as Promise<Course[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      first_name: string;
      middle_name: string | null;
      last_name: string;
      course_ids: number[];
    }) => {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add student");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setSelectedCourses([]);
      toast.success("Student added successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add student");
    },
  });

  const toggleCourse = (courseId: number) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    mutation.mutate({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      course_ids: selectedCourses,
    });
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-semibold text-black mb-6">Add Student</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black mb-2">
            First Name *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. John"
            required
            maxLength={50}
            className="w-full px-4 py-2 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Middle Name (Optional)
          </label>
          <input
            type="text"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="e.g. Michael"
            maxLength={50}
            className="w-full px-4 py-2 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Last Name *
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Doe"
            required
            maxLength={50}
            className="w-full px-4 py-2 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Enroll in Courses (Optional)
          </label>
          {coursesLoading ? (
            <p className="text-sm text-slate-400">Loading courses...</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-slate-400">
              No courses available. Create a course first.
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-300 rounded-lg p-3">
              {courses.map((course) => (
                <label
                  key={course.course_id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course.course_id)}
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
          {selectedCourses.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {selectedCourses.length} course{selectedCourses.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 cursor-pointer hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? "Adding..." : "Add Student"}
        </button>
      </form>
    </div>
  );
}
