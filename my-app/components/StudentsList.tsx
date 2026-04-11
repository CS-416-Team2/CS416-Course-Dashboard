'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface Student {
  student_id: number;
  first_name: string;
  last_name: string;
  average_score: number;
}

const safeNumber = (val: unknown): number =>
  typeof val === "number" ? val : Number(val ?? 0) || 0;

function parseStudentsPayload(json: unknown): Student[] {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && 'students' in json && Array.isArray((json as { students: unknown }).students)
      ? (json as { students: unknown[] }).students
      : [];

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const score = r.average_score ?? r.score;
    return {
      student_id: Number(r.student_id),
      first_name: String(r.first_name ?? ''),
      last_name: String(r.last_name ?? ''),
      average_score: safeNumber(score),
    };
  });
}

export default function StudentsList({ courseId }: { courseId?: number | null }) {
  const [sortOrder, setSortOrder] = useState<'highest' | 'lowest'>('highest');

  const queryParam = courseId ? `&course_id=${courseId}` : '';
  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ['students', courseId ?? 'all'],
    queryFn: async (): Promise<Student[]> => {
      const response = await fetch(`/api/students?include_scores=true${queryParam}`, {
        next: { revalidate: 60 },
      });
      if (!response.ok) throw new Error('Failed to fetch students');
      const json: unknown = await response.json();
      return parseStudentsPayload(json);
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load students');
    }
  }, [error]);

  const sortedStudents = [...students].sort((a, b) => {
    const aScore = a.average_score ?? 0;
    const bScore = b.average_score ?? 0;
    return sortOrder === 'highest' ? bScore - aScore : aScore - bScore;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBg = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-700';
    if (score >= 80) return 'bg-blue-100 text-blue-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700';
    if (score >= 60) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Students</h2>
          <div className="flex gap-3 ">
            <button
              onClick={() => setSortOrder('highest')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortOrder === 'highest'
                  ? 'bg-black text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200'
              }`}
            >
              Highest Score
            </button>
            <button
              onClick={() => setSortOrder('lowest')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortOrder === 'lowest'
                  ? 'bg-black text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200'
              }`}
            >
              Lowest Score
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            <p className="text-slate-600 mt-4">Loading students...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">Failed to load students</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 mb-4">No students yet</p>
            <Link
              href="/students"
              className="inline-block px-6 py-2 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 hover:text-black transition"
            >
              Add Student
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">Name</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">Average Score</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">Grade</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => (
                  <tr key={student.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-4 text-slate-900 font-medium">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className={`py-4 px-4 font-semibold ${getScoreColor(student.average_score ?? 0)}`}>
                      {(student.average_score ?? 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeBg(student.average_score ?? 0)}`}>
                        {getGrade(student.average_score ?? 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
