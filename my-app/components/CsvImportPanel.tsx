"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { Course, Assignment, CsvRow } from "@/lib/schemas";

function parseCsv(text: string): { rows: CsvRow[]; error?: string } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], error: "CSV must have a header row and at least one data row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["student_id", "first_name", "last_name", "score"];
  for (const col of required) {
    if (!header.includes(col)) {
      return { rows: [], error: `Missing required column: "${col}". Expected: student_id, first_name, middle_name, last_name, score` };
    }
  }

  const idx = {
    student_id: header.indexOf("student_id"),
    first_name: header.indexOf("first_name"),
    middle_name: header.indexOf("middle_name"),
    last_name: header.indexOf("last_name"),
    score: header.indexOf("score"),
  };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.trim());

    const sid = Number(cols[idx.student_id]);
    const fname = cols[idx.first_name] ?? "";
    const mname = idx.middle_name >= 0 ? (cols[idx.middle_name] ?? "") : "";
    const lname = cols[idx.last_name] ?? "";
    const score = Number(cols[idx.score]);

    let error: string | undefined;
    if (!Number.isInteger(sid) || sid <= 0) error = "Invalid student_id";
    else if (!fname) error = "Missing first_name";
    else if (!lname) error = "Missing last_name";
    else if (isNaN(score) || score < 0) error = "Invalid score";

    rows.push({ student_id: sid, first_name: fname, middle_name: mname, last_name: lname, score, error });
  }

  return { rows };
}

export default function CsvImportPanel() {
  const [courseId, setCourseId] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [assignmentId, setAssignmentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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
    enabled: !!courseId && mode === "existing",
    staleTime: 60 * 1000,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = rows.filter((r) => !r.error);
      if (validRows.length === 0) throw new Error("No valid rows to import");

      const grades = validRows.map((r) => ({
        student_id: r.student_id,
        first_name: r.first_name,
        middle_name: r.middle_name,
        last_name: r.last_name,
        score: r.score,
      }));

      if (mode === "new") {
        const res = await fetch(`/api/courses/${courseId}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle,
            max_points: parseInt(maxPoints),
            grades,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to import");
        }
        return res.json();
      } else {
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
          throw new Error(err.error || "Failed to import");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      const count = rows.filter((r) => !r.error).length;
      toast.success(`Imported ${count} grade${count !== 1 ? "s" : ""} successfully!`);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetForm = () => {
    setRows([]);
    setParseError("");
    setFileName("");
    setNewTitle("");
    setMaxPoints("100");
    setAssignmentId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, error } = parseCsv(text);
      if (error) {
        setParseError(error);
        setRows([]);
      } else {
        setParseError("");
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  const canSubmit =
    validCount > 0 &&
    !!courseId &&
    (mode === "new" ? newTitle.trim() !== "" && parseInt(maxPoints) > 0 : !!assignmentId) &&
    !importMutation.isPending;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Import Grades from CSV</h2>
        <p className="text-sm text-slate-500 mb-6">
          Upload a CSV with columns: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">student_id, first_name, middle_name, last_name, score</code>
        </p>

        <div className="space-y-6">
          {/* Course selector */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">Course *</label>
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setAssignmentId("");
              }}
              disabled={coursesLoading}
              className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            >
              <option value="">{coursesLoading ? "Loading..." : "Select a course"}</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
              ))}
            </select>
          </div>

          {/* Mode toggle */}
          {courseId && (
            <div>
              <label className="block text-sm font-medium text-black mb-2">Import Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={mode === "new"}
                    onChange={() => { setMode("new"); setAssignmentId(""); }}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-slate-900">Create new assignment</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={mode === "existing"}
                    onChange={() => setMode("existing")}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-slate-900">Grade existing assignment</span>
                </label>
              </div>
            </div>
          )}

          {/* New assignment fields */}
          {courseId && mode === "new" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Assignment Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Midterm Exam"
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
                  min="1"
                  max="999"
                  className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* Existing assignment selector */}
          {courseId && mode === "existing" && (
            <div>
              <label className="block text-sm font-medium text-black mb-2">Assignment *</label>
              <select
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                disabled={assignmentsLoading}
                className="w-full px-4 py-2 text-black border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none disabled:opacity-50"
              >
                <option value="">
                  {assignmentsLoading ? "Loading..." : assignments.length === 0 ? "No assignments yet" : "Select an assignment"}
                </option>
                {assignments.map((a) => (
                  <option key={a.assignment_id} value={a.assignment_id}>
                    {a.title} ({a.max_points} pts)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File input */}
          {courseId && (
            <div>
              <label className="block text-sm font-medium text-black mb-2">CSV File *</label>
              <div className="flex items-center gap-4">
                <label className="px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer">
                  Choose File
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFile}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-slate-500">
                  {fileName || "No file selected"}
                </span>
                {fileName && (
                  <button
                    onClick={resetForm}
                    className="text-sm text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Preview ({validCount} valid{errorCount > 0 ? `, ${errorCount} with errors` : ""})
                </h3>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">ID</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">First</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">Middle</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">Last</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">Score</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r.error ? "bg-red-50" : "hover:bg-slate-50"}>
                        <td className="py-2 px-3 text-slate-900">{r.student_id}</td>
                        <td className="py-2 px-3 text-slate-900">{r.first_name}</td>
                        <td className="py-2 px-3 text-slate-400">{r.middle_name || "—"}</td>
                        <td className="py-2 px-3 text-slate-900">{r.last_name}</td>
                        <td className="py-2 px-3 text-slate-900">{r.score}</td>
                        <td className="py-2 px-3">
                          {r.error ? (
                            <span className="text-red-600 text-xs font-medium">{r.error}</span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit */}
          {rows.length > 0 && (
            <button
              onClick={() => importMutation.mutate()}
              disabled={!canSubmit}
              className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending
                ? "Importing..."
                : `Import ${validCount} Grade${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
