'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import StatsOverview from '@/components/StatsOverview';
import StudentsList from '@/components/StudentsList';
import Link from 'next/link';

interface Course {
  course_id: number;
  course_name: string;
}

export default function Dashboard() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async (): Promise<Course[]> => {
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const selectedCourse = courses.find((c) => c.course_id === selectedCourseId);

  return (
    <div className="p-12">
      <div className="max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
            <p className="text-lg text-slate-600">
              {selectedCourse
                ? `Viewing stats for ${selectedCourse.course_name}`
                : 'Overview of all courses, students, and performance metrics.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedCourseId ?? ''}
              onChange={(e) =>
                setSelectedCourseId(e.target.value ? Number(e.target.value) : null)
              }
              className="px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition min-w-[200px]"
            >
              <option value="">All Courses</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-16">
          <StatsOverview courseId={selectedCourseId} />
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-slate-200 hover:text-black transition"
            >
              + Add Course
            </Link>
            <Link
              href="/students"
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-slate-200 hover:text-black transition"
            >
              + Add Student
            </Link>
            <Link
              href="/assignments"
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-slate-200 hover:text-black transition"
            >
              + Add Assignment
            </Link>
          </div>
        </div>

        <StudentsList courseId={selectedCourseId} />
      </div>
    </div>
  );
}
