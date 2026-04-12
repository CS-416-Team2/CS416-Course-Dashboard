'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import type { Stats } from '@/lib/schemas';

export default function StatsOverview({ courseId }: { courseId?: number | null }) {
  const queryParam = courseId ? `?course_id=${courseId}` : '';
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats', courseId ?? 'all'],
    queryFn: async () => {
      const response = await fetch(`/api/stats${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<Stats>;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load stats');
    }
  }, [error]);

  const defaultStats: Stats = {
    totalStudents: 0,
    enrolledStudents: 0,
    averageScore: 0,
    highestScore: 0,
    passingRate: 0,
  };

  const displayStats = stats || defaultStats;

  const StatCard = ({
    icon,
    title,
    value,
    subtitle,
  }: {
    icon: string;
    title: string;
    value: string | number;
    subtitle: string;
  }) => (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-slate-600 font-medium">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-2">{isLoading ? '-' : value}</div>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        icon="👥"
        title="Total Students"
        value={`${displayStats.enrolledStudents}/${displayStats.totalStudents}`}
        subtitle="Students enrolled"
      />
      <StatCard
        icon="📈"
        title="Average Score"
        value={displayStats.averageScore.toFixed(2)}
        subtitle="Mean class score"
      />
      <StatCard
        icon="🏆"
        title="Highest Score"
        value={displayStats.highestScore}
        subtitle="Top performance"
      />
      <StatCard
        icon="📚"
        title="Passing Rate"
        value={`${displayStats.passingRate}%`}
        subtitle="Students ≥60 score"
      />
    </div>
  );
}
