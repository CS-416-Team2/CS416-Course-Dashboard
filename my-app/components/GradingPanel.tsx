"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

interface Course {
  course_id: number;
  course_name: string;
}

interface Assignment {
  assignment_id: number;
  title: string;
  max_points: number;
}

interface StudentGrade {
  student_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  score: number | null;
  score_id: number | null;
}

interface UnenrolledStudent {
  student_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
}

export default function GradingPanel() {
  const [courseId, setCourseId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [scores, setScores] = useState<Record<number, string>>({});
  const [selectedToEnroll, setSelectedToEnroll] = useState<number[]>([]);
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
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

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}/assignments`);
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json() as Promise<Assignment[]>;
    },
    enabled: !!courseId,
    staleTime: 60 * 1000,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["grades", courseId, assignmentId],
    queryFn: async () => {
      const params = new URLSearchParams({ course_id: courseId });
      if (assignmentId) params.set("assignment_id", assignmentId);
      const res = await fetch(`/api/grades?${params}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json() as Promise<StudentGrade[]>;
    },
    enabled: !!courseId && !!assignmentId,
    staleTime: 30 * 1000,
  });

  const { data: unenrolled = [], isLoading: unenrolledLoading } = useQuery({
    queryKey: ["unenrolled", courseId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}/unenrolled`);
      if (!res.ok) throw new Error("Failed to fetch unenrolled students");
      return res.json() as Promise<UnenrolledStudent[]>;
    },
    enabled: !!courseId && showEnrollPanel,
    staleTime: 15 * 1000,
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const grades = Object.entries(scores)
        .filter(([, val]) => val !== "")
        .map(([sid, val]) => ({ student_id: Number(sid), score: Number(val) }));

      if (grades.length === 0) throw new Error("No scores to save");

      const res = await fetch("/api/grades/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: Number(assignmentId),
          course_id: Number(courseId),
          grades,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save grades");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setScores({});
      toast.success("Grades saved!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentIds: number[]) => {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: studentIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to enroll students");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["unenrolled"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setSelectedToEnroll([]);
      toast.success("Students enrolled!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleScoreChange = (studentId: number, value: string) => {
    if (value !== "" && (Number(value) < 0 || Number(value) > 100)) return;
    setScores((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleCourseChange = (value: string) => {
    setCourseId(value);
    setAssignmentId("");
    setScores({});
    setShowEnrollPanel(false);
    setSelectedToEnroll([]);
  };

  const handleAssignmentChange = (value: string) => {
    setAssignmentId(value);
    setScores({});
  };

  const toggleEnrollStudent = (studentId: number) => {
    setSelectedToEnroll((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getGradeBadge = (score: number) => {
    let letter = "F";
    let classes = "bg-red-100 text-red-700";
    if (score >= 90) { letter = "A"; classes = "bg-green-100 text-green-700"; }
    else if (score >= 80) { letter = "B"; classes = "bg-blue-100 text-blue-700"; }
    else if (score >= 70) { letter = "C"; classes = "bg-yellow-100 text-yellow-700"; }
    else if (score >= 60) { letter = "D"; classes = "bg-orange-100 text-orange-700"; }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>{letter}</span>;
  };

  const pendingCount = Object.values(scores).filter((v) => v !== "").length;

  return (
    <div className="space-y-8">
      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Course *
          </label>
          <select
            value={courseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            disabled={coursesLoading}
            className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
          >
            <option value="">
              {coursesLoading ? "Loading..." : "Select a course"}
            </option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Assignment *
          </label>
          <select
            value={assignmentId}
            onChange={(e) => handleAssignmentChange(e.target.value)}
            disabled={!courseId || assignmentsLoading}
            className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none disabled:opacity-50"
          >
            <option value="">
              {!courseId
                ? "Select a course first"
                : assignmentsLoading
                ? "Loading..."
                : assignments.length === 0
                ? "No assignments yet"
                : "Select an assignment"}
            </option>
            {assignments.map((a) => (
              <option key={a.assignment_id} value={a.assignment_id}>
                {a.title} ({a.max_points} pts)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enroll Students Button + Panel */}
      {courseId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">
                Enroll Students in Course
              </h3>
              <button
                onClick={() => {
                  setShowEnrollPanel(!showEnrollPanel);
                  setSelectedToEnroll([]);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer"
              >
                {showEnrollPanel ? "Hide" : "Add Students to Course"}
              </button>
            </div>

            {showEnrollPanel && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {unenrolledLoading ? (
                  <p className="text-sm text-slate-500">Loading students...</p>
                ) : unenrolled.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    All students are already enrolled in this course.
                  </p>
                ) : (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
                      {unenrolled.map((s) => (
                        <label
                          key={s.student_id}
                          className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedToEnroll.includes(s.student_id)}
                            onChange={() => toggleEnrollStudent(s.student_id)}
                            className="w-4 h-4 accent-black"
                          />
                          <span className="text-sm text-slate-900">
                            {s.first_name}{" "}
                            {s.middle_name ? s.middle_name + " " : ""}
                            {s.last_name}
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedToEnroll.length > 0 && (
                      <button
                        onClick={() => enrollMutation.mutate(selectedToEnroll)}
                        disabled={enrollMutation.isPending}
                        className="px-5 py-2 bg-black text-white text-sm rounded-lg font-medium hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {enrollMutation.isPending
                          ? "Enrolling..."
                          : `Enroll ${selectedToEnroll.length} Student${selectedToEnroll.length > 1 ? "s" : ""}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students + Scores Table */}
      {courseId && assignmentId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Student Scores
              </h3>
              {pendingCount > 0 && (
                <button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending}
                  className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-slate-200 hover:text-black transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkMutation.isPending
                    ? "Saving..."
                    : `Save ${pendingCount} Grade${pendingCount > 1 ? "s" : ""}`}
                </button>
              )}
            </div>

            {studentsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                <p className="text-slate-600 mt-4">Loading students...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600">
                  No students enrolled in this course yet. Use the panel above to enroll students.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">
                        Student
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">
                        Current Score
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">
                        Grade
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">
                        New Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const currentScore = s.score;
                      const pendingVal = scores[s.student_id] ?? "";
                      return (
                        <tr
                          key={s.student_id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 text-slate-900 font-medium">
                            {s.first_name} {s.last_name}
                          </td>
                          <td className="py-3 px-4">
                            {currentScore !== null ? (
                              <span className={`font-semibold ${getScoreColor(currentScore)}`}>
                                {currentScore}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">
                                Not graded
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {currentScore !== null
                              ? getGradeBadge(currentScore)
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={pendingVal}
                              onChange={(e) =>
                                handleScoreChange(s.student_id, e.target.value)
                              }
                              placeholder={
                                currentScore !== null
                                  ? String(currentScore)
                                  : "0–100"
                              }
                              className="w-24 px-3 py-1.5 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-center placeholder:text-slate-400"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompt to select */}
      {!courseId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-lg">
            Select a course and assignment above to start grading.
          </p>
        </div>
      )}

      {courseId && !assignmentId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-lg">
            Select an assignment to view and grade students.
          </p>
        </div>
      )}
    </div>
  );
}
