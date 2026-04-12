"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParsedRow {
  student_id: number | null;
  first_name: string;
  middle_name: string;
  last_name: string;
  score: number | null;
  course_id: number | null;
  course_name: string;
  assignment_id: number | null;
  assignment_title: string;
  max_points: number | null;
  _error?: string;
  _row: number;
}

interface PreviewData {
  new_courses: Array<{ course_name: string }>;
  new_assignments: Array<{ title: string; max_points: number; course_name: string }>;
  new_students: Array<{
    student_id: number | null;
    first_name: string;
    middle_name: string;
    last_name: string;
    auto_id?: boolean;
  }>;
  updated_students: Array<{
    student_id: number;
    old_first_name: string; old_middle_name: string; old_last_name: string;
    new_first_name: string; new_middle_name: string; new_last_name: string;
  }>;
  new_enrollments: Array<{
    student_id: number | null; student_name: string;
    course_id: number | null; course_name: string;
  }>;
  new_grades: Array<{
    student_id: number | null; student_name: string;
    assignment_id: number | null; assignment_title: string;
    score: number; max_points: number;
  }>;
  updated_grades: Array<{
    student_id: number; student_name: string;
    assignment_id: number; assignment_title: string;
    old_score: number; new_score: number; max_points: number;
  }>;
  errors: Array<{ row: number; message: string }>;
  summary: {
    new_courses: number; new_assignments: number;
    new_students: number; updated_students: number;
    new_enrollments: number;
    new_grades: number; updated_grades: number;
    errors: number;
  };
}

interface CommitResult {
  message: string;
  courses_added: number;
  assignments_added: number;
  students_added: number;
  students_updated: number;
  enrollments_added: number;
  grades_added: number;
  grades_updated: number;
  rows_skipped: number;
}

/* ------------------------------------------------------------------ */
/*  CSV parser                                                         */
/* ------------------------------------------------------------------ */

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  student_id: ["student_id", "studentid", "sid", "student"],
  first_name: ["first_name", "firstname", "first", "fname"],
  middle_name: ["middle_name", "middlename", "middle", "mname"],
  last_name: ["last_name", "lastname", "last", "lname"],
  score: ["score", "grade"],
  course_id: ["course_id", "courseid"],
  course_name: ["course_name", "coursename", "course"],
  assignment_id: ["assignment_id", "assignmentid"],
  assignment_title: ["assignment_title", "assignmenttitle", "assignment_name", "assignmentname", "assignment", "title"],
  max_points: ["max_points", "maxpoints", "max", "points_possible", "total_points"],
};

function findColumn(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsv(text: string): { rows: ParsedRow[]; error?: string } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2)
    return { rows: [], error: "CSV must have a header row and at least one data row." };

  const header = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const colIdx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    colIdx[field] = findColumn(header, aliases);
  }

  const hasStudentId = colIdx.student_id >= 0;
  const hasName = colIdx.first_name >= 0 && colIdx.last_name >= 0;
  if (!hasStudentId && !hasName) {
    return {
      rows: [],
      error: "CSV must have at least a 'student_id' column or both 'first_name' and 'last_name' columns.",
    };
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCsvLine(line);

    let error: string | undefined;

    const parseNum = (field: string): number | null => {
      if (colIdx[field] < 0) return null;
      const val = cols[colIdx[field]]?.trim();
      if (!val) return null;
      const n = Number(val);
      if (isNaN(n)) {
        error = error || `Invalid ${field.replace(/_/g, " ")}`;
        return null;
      }
      return n;
    };
    const getStr = (field: string) =>
      colIdx[field] >= 0 ? (cols[colIdx[field]]?.trim() ?? "") : "";

    const sid = parseNum("student_id");
    const fname = getStr("first_name");
    const mname = getStr("middle_name");
    const lname = getStr("last_name");
    const score = parseNum("score");
    const cid = parseNum("course_id");
    const cname = getStr("course_name");
    const aid = parseNum("assignment_id");
    const atitle = getStr("assignment_title");
    const maxPts = parseNum("max_points");

    if (sid === null && (!fname || !lname)) {
      if (!fname && !lname && cid === null && !cname && aid === null && !atitle && score === null)
        continue;
      error = error || "Need student_id or first + last name";
    }
    if (sid !== null && sid <= 0) error = error || "Invalid student_id";

    rows.push({
      student_id: sid,
      first_name: fname,
      middle_name: mname,
      last_name: lname,
      score,
      course_id: cid,
      course_name: cname,
      assignment_id: aid,
      assignment_title: atitle,
      max_points: maxPts,
      _error: error,
      _row: i + 1,
    });
  }

  return { rows };
}

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  color,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  color: "green" | "amber" | "red" | "blue" | "purple";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  const styles: Record<string, { wrap: string; badge: string }> = {
    green: { wrap: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
    amber: { wrap: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700" },
    red: { wrap: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700" },
    blue: { wrap: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700" },
    purple: { wrap: "bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-700" },
  };
  const s = styles[color];

  return (
    <div className={`border rounded-lg overflow-hidden ${s.wrap}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">{open ? "▼" : "▶"}</span>
          <span className="font-semibold text-sm text-slate-800">{title}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{count}</span>
        </div>
      </button>
      {open && <div className="border-t px-4 py-3 bg-white/60">{children}</div>}
    </div>
  );
}

function Blank() {
  return <span className="text-slate-300">—</span>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CsvImportPanel() {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const validRows = rows.filter((r) => !r._error);

  const buildPayload = () =>
    validRows.map((r) => ({
      student_id: r.student_id,
      first_name: r.first_name || null,
      middle_name: r.middle_name || null,
      last_name: r.last_name || null,
      score: r.score,
      course_id: r.course_id,
      course_name: r.course_name || null,
      assignment_id: r.assignment_id,
      assignment_title: r.assignment_title || null,
      max_points: r.max_points,
    }));

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/csv/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: buildPayload() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Preview failed");
      }
      return res.json() as Promise<PreviewData>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep("review");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/csv/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: buildPayload() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json() as Promise<CommitResult>;
    },
    onSuccess: (data) => {
      setCommitResult(data);
      setStep("done");
      for (const k of ["students", "courses", "grades", "stats", "assignments"]) {
        queryClient.invalidateQueries({ queryKey: [k] });
      }
      toast.success("Import completed successfully!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const resetAll = () => {
    setStep("upload");
    setRows([]);
    setParseError("");
    setFileName("");
    setPreview(null);
    setCommitResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const errorCount = rows.filter((r) => r._error).length;
  const totalChanges = preview
    ? preview.summary.new_courses +
      preview.summary.new_assignments +
      preview.summary.new_students +
      preview.summary.updated_students +
      preview.summary.new_enrollments +
      preview.summary.new_grades +
      preview.summary.updated_grades
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8">
        {/* header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900">Bulk CSV Import</h2>
          {step !== "upload" && (
            <button onClick={resetAll} className="text-sm text-slate-500 hover:text-slate-700 transition cursor-pointer">
              Start Over
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Upload a CSV to create courses, assignments, students, enrollments, and grades — all at once.
          Only include the columns you need.
        </p>

        {/* step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(["Upload", "Review", "Done"] as const).map((label, i) => {
            const stepMap = ["upload", "review", "done"] as const;
            const isActive = stepMap[i] === step;
            const isPast = stepMap.indexOf(step) > i;
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isPast ? "bg-black" : "bg-slate-200"}`} />}
                <div className={`flex items-center gap-1.5 text-sm font-medium ${isActive ? "text-black" : isPast ? "text-slate-600" : "text-slate-300"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${isActive ? "bg-black text-white" : isPast ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {isPast ? "✓" : i + 1}
                  </div>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===================== STEP 1 — UPLOAD ===================== */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Accepted Columns (all optional)</p>
              <code className="text-xs text-slate-700 block">
                student_id, first_name, middle_name, last_name, course_name, course_id, assignment_title, assignment_id, max_points, score
              </code>
              <p className="text-xs text-slate-500 mt-2">
                Use <code className="bg-white px-1 py-0.5 rounded">course_name</code> to create new courses, or <code className="bg-white px-1 py-0.5 rounded">course_id</code> to reference existing ones.
                Same for <code className="bg-white px-1 py-0.5 rounded">assignment_title</code> vs <code className="bg-white px-1 py-0.5 rounded">assignment_id</code>.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition cursor-pointer">
                Choose CSV File
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
              <span className="text-sm text-slate-500">{fileName || "No file selected"}</span>
              {fileName && (
                <button onClick={resetAll} className="text-sm text-slate-400 hover:text-slate-600 transition cursor-pointer">Clear</button>
              )}
            </div>

            {parseError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{parseError}</div>
            )}

            {rows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Parsed Data ({validRows.length} valid{errorCount > 0 ? `, ${errorCount} with errors` : ""})
                </h3>
                <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Row</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Student ID</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">First</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Middle</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Last</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Course</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Assignment</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Max Pts</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Score</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={r._error ? "bg-red-50" : "hover:bg-slate-50"}>
                          <td className="py-2 px-3 text-slate-400 text-xs">{r._row}</td>
                          <td className="py-2 px-3 text-slate-900">
                            {r.student_id !== null ? r.student_id : <span className="text-slate-300 italic text-xs">auto</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-900">{r.first_name || <Blank />}</td>
                          <td className="py-2 px-3 text-slate-400">{r.middle_name || "—"}</td>
                          <td className="py-2 px-3 text-slate-900">{r.last_name || <Blank />}</td>
                          <td className="py-2 px-3 text-slate-900">
                            {r.course_id !== null ? <span className="text-slate-500">#{r.course_id}</span> : r.course_name || <Blank />}
                          </td>
                          <td className="py-2 px-3 text-slate-900">
                            {r.assignment_id !== null ? <span className="text-slate-500">#{r.assignment_id}</span> : r.assignment_title || <Blank />}
                          </td>
                          <td className="py-2 px-3 text-slate-900">{r.max_points !== null ? r.max_points : <Blank />}</td>
                          <td className="py-2 px-3 text-slate-900">{r.score !== null ? r.score : <Blank />}</td>
                          <td className="py-2 px-3">
                            {r._error
                              ? <span className="text-red-600 text-xs font-medium">{r._error}</span>
                              : <span className="text-emerald-600 text-xs font-medium">OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <button
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewMutation.isPending ? "Analyzing…" : `Preview Changes (${validRows.length} row${validRows.length !== 1 ? "s" : ""})`}
              </button>
            )}
          </div>
        )}

        {/* ===================== STEP 2 — REVIEW ===================== */}
        {step === "review" && preview && (
          <div className="space-y-4">
            {/* summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-2">
              {[
                { label: "Courses", n: preview.summary.new_courses, cls: "text-violet-700 bg-violet-50 border-violet-200" },
                { label: "Assignments", n: preview.summary.new_assignments, cls: "text-violet-700 bg-violet-50 border-violet-200" },
                { label: "New Students", n: preview.summary.new_students, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                { label: "Updated Students", n: preview.summary.updated_students, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                { label: "Enrollments", n: preview.summary.new_enrollments, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                { label: "New Grades", n: preview.summary.new_grades, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                { label: "Grade Updates", n: preview.summary.updated_grades, cls: "text-amber-700 bg-amber-50 border-amber-200" },
              ].map(({ label, n, cls }) => (
                <div key={label} className={`p-3 rounded-lg border text-center ${cls}`}>
                  <div className="text-2xl font-bold">{n}</div>
                  <div className="text-xs font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {totalChanges === 0 && preview.summary.errors === 0 && (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg">No changes detected. Everything is already up to date.</div>
            )}

            {/* New Courses */}
            <Section title="New Courses" count={preview.new_courses.length} color="purple" defaultOpen>
              <ul className="space-y-1 text-sm">
                {preview.new_courses.map((c, i) => (
                  <li key={i} className="text-slate-900 font-medium">{c.course_name}</li>
                ))}
              </ul>
            </Section>

            {/* New Assignments */}
            <Section title="New Assignments" count={preview.new_assignments.length} color="purple" defaultOpen>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">Title</th>
                  <th className="py-1 px-2 font-medium">Max Points</th>
                  <th className="py-1 px-2 font-medium">Course</th>
                </tr></thead>
                <tbody>{preview.new_assignments.map((a, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900 font-medium">{a.title}</td>
                    <td className="py-1.5 px-2 text-slate-900">{a.max_points}</td>
                    <td className="py-1.5 px-2 text-slate-600">{a.course_name}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* New Students */}
            <Section title="New Students" count={preview.new_students.length} color="green" defaultOpen>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">ID</th>
                  <th className="py-1 px-2 font-medium">Name</th>
                </tr></thead>
                <tbody>{preview.new_students.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">
                      {s.student_id ?? <span className="text-slate-400 italic text-xs">auto-assign</span>}
                    </td>
                    <td className="py-1.5 px-2 text-slate-900">{s.first_name} {s.middle_name} {s.last_name}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* Updated Students */}
            <Section title="Updated Students" count={preview.updated_students.length} color="amber" defaultOpen>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">ID</th>
                  <th className="py-1 px-2 font-medium">Current Name</th>
                  <th className="py-1 px-2 font-medium" />
                  <th className="py-1 px-2 font-medium">New Name</th>
                </tr></thead>
                <tbody>{preview.updated_students.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">{s.student_id}</td>
                    <td className="py-1.5 px-2 text-red-600 line-through">{s.old_first_name} {s.old_middle_name} {s.old_last_name}</td>
                    <td className="py-1.5 px-2 text-slate-400">→</td>
                    <td className="py-1.5 px-2 text-emerald-700 font-medium">{s.new_first_name} {s.new_middle_name} {s.new_last_name}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* New Enrollments */}
            <Section title="New Enrollments" count={preview.new_enrollments.length} color="blue" defaultOpen>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">Student</th>
                  <th className="py-1 px-2 font-medium">Course</th>
                </tr></thead>
                <tbody>{preview.new_enrollments.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">{e.student_name}{e.student_id ? ` (#${e.student_id})` : ""}</td>
                    <td className="py-1.5 px-2 text-slate-900">{e.course_name}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* New Grades */}
            <Section title="New Grades" count={preview.new_grades.length} color="green">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">Student</th>
                  <th className="py-1 px-2 font-medium">Assignment</th>
                  <th className="py-1 px-2 font-medium">Score</th>
                </tr></thead>
                <tbody>{preview.new_grades.map((g, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">{g.student_name}</td>
                    <td className="py-1.5 px-2 text-slate-900">{g.assignment_title}</td>
                    <td className="py-1.5 px-2 text-slate-900">{g.score} / {g.max_points}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* Updated Grades */}
            <Section title="Grade Updates" count={preview.updated_grades.length} color="amber">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">Student</th>
                  <th className="py-1 px-2 font-medium">Assignment</th>
                  <th className="py-1 px-2 font-medium">Old → New</th>
                </tr></thead>
                <tbody>{preview.updated_grades.map((g, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">{g.student_name}</td>
                    <td className="py-1.5 px-2 text-slate-900">{g.assignment_title}</td>
                    <td className="py-1.5 px-2">
                      <span className="text-red-600 line-through">{g.old_score}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="text-emerald-700 font-medium">{g.new_score}</span>
                      <span className="text-slate-400 ml-1">/ {g.max_points}</span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* Errors */}
            <Section title="Errors" count={preview.errors.length} color="red" defaultOpen={preview.errors.length > 0}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500">
                  <th className="py-1 px-2 font-medium">Row</th>
                  <th className="py-1 px-2 font-medium">Issue</th>
                </tr></thead>
                <tbody>{preview.errors.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 text-slate-900">{e.row}</td>
                    <td className="py-1.5 px-2 text-red-600">{e.message}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>

            {/* action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending || totalChanges === 0}
                className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {commitMutation.isPending ? "Importing…" : `Commit ${totalChanges} Change${totalChanges !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => { setStep("upload"); setPreview(null); }}
                disabled={commitMutation.isPending}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ===================== STEP 3 — DONE ===================== */}
        {step === "done" && commitResult && (
          <div className="space-y-6">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <div className="text-3xl mb-2">✓</div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-3">Import Complete</h3>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {commitResult.courses_added > 0 && (
                  <span className="text-violet-700">{commitResult.courses_added} course{commitResult.courses_added !== 1 ? "s" : ""} created</span>
                )}
                {commitResult.assignments_added > 0 && (
                  <span className="text-violet-700">{commitResult.assignments_added} assignment{commitResult.assignments_added !== 1 ? "s" : ""} created</span>
                )}
                {commitResult.students_added > 0 && (
                  <span className="text-emerald-700">{commitResult.students_added} student{commitResult.students_added !== 1 ? "s" : ""} added</span>
                )}
                {commitResult.students_updated > 0 && (
                  <span className="text-amber-700">{commitResult.students_updated} student{commitResult.students_updated !== 1 ? "s" : ""} updated</span>
                )}
                {commitResult.enrollments_added > 0 && (
                  <span className="text-blue-700">{commitResult.enrollments_added} enrollment{commitResult.enrollments_added !== 1 ? "s" : ""} added</span>
                )}
                {commitResult.grades_added > 0 && (
                  <span className="text-emerald-700">{commitResult.grades_added} grade{commitResult.grades_added !== 1 ? "s" : ""} added</span>
                )}
                {commitResult.grades_updated > 0 && (
                  <span className="text-amber-700">{commitResult.grades_updated} grade{commitResult.grades_updated !== 1 ? "s" : ""} updated</span>
                )}
                {commitResult.rows_skipped > 0 && (
                  <span className="text-slate-500">{commitResult.rows_skipped} row{commitResult.rows_skipped !== 1 ? "s" : ""} skipped</span>
                )}
              </div>
            </div>
            <button onClick={resetAll} className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-slate-700 transition cursor-pointer">
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
