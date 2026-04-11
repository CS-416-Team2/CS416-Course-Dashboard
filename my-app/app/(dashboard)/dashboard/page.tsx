import StatsOverview from '@/components/StatsOverview';
import StudentsList from '@/components/StudentsList';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="p-12">
      <div className="max-w-7xl">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-lg text-slate-600 mb-12">
          Overview of your courses, students, and performance metrics.
        </p>

        <div className="mb-16">
          <StatsOverview />
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

        <StudentsList />
      </div>
    </div>
  );
}
