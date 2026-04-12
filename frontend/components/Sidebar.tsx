'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 bg-white text-black h-screen sticky top-0 overflow-y-auto border-r-2 border-slate-200">
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-12">CourseHub</h2>

        <nav className="space-y-3">
          <Link
            href="/dashboard"
            className={`block px-4 py-3 rounded-lg transition ${
              isActive('/dashboard')
                ? 'bg-slate-200 text-black'
                : 'text-black hover:bg-slate-100'
            }`}
          >
            Dashboard
          </Link>

          <Link
            href="/courses"
            className={`block px-4 py-3 rounded-lg transition ${
              isActive('/courses')
                ? 'bg-slate-200 text-black'
                : 'text-black hover:bg-slate-100'
            }`}
          >
            Add Course
          </Link>

          <Link
            href="/students"
            className={`block px-4 py-3 rounded-lg transition ${
              isActive('/students')
                ? 'bg-slate-200 text-black'
                : 'text-black hover:bg-slate-100'
            }`}
          >
            Students
          </Link>

          <Link
            href="/assignments"
            className={`block px-4 py-3 rounded-lg transition ${
              isActive('/assignments')
                ? 'bg-slate-200 text-black'
                : 'text-black hover:bg-slate-100'
            }`}
          >
            Add Assignment
          </Link>

          <Link
            href="/grading"
            className={`block px-4 py-3 rounded-lg transition ${
              isActive('/grading')
                ? 'bg-slate-200 text-black'
                : 'text-black hover:bg-slate-100'
            }`}
          >
            Grading
          </Link>
        </nav>
      </div>
    </aside>
  );
}
