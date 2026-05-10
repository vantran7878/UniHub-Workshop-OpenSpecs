'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface Statistics {
  workshopsByStatus: Record<string, number>;
  totalConfirmedRegistrations: number;
  totalRevenue: number;
}

export default function AdminStatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { accessToken } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiFetch<Statistics>('/workshops/statistics', {
          token: accessToken || undefined,
        });
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [accessToken]);

  if (isLoading) return <div className="p-8 text-center">Loading statistics...</div>;
  if (!stats) return <div className="p-8 text-center">No statistics available.</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Statistics Overview</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Track performance and engagement across all workshops.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Registrations</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{stats.totalConfirmedRegistrations}</div>
        </div>
        
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            {stats.totalRevenue.toLocaleString()} <span className="text-sm font-normal text-zinc-500">VND</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Workshops</div>
          <div className="mt-2 text-3xl font-bold text-emerald-600">{stats.workshopsByStatus.active || 0}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cancelled/Completed</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            {(stats.workshopsByStatus.cancelled || 0) + (stats.workshopsByStatus.completed || 0)}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Workshop Status Distribution</h3>
          <div className="space-y-4">
             {Object.entries(stats.workshopsByStatus).map(([status, count]) => (
               <div key={status} className="flex items-center justify-between">
                 <span className="capitalize text-zinc-600 dark:text-zinc-400">{status}</span>
                 <div className="flex flex-1 items-center mx-4">
                   <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div 
                        className={`h-full ${status === 'active' ? 'bg-emerald-500' : status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${(count / Object.values(stats.workshopsByStatus).reduce((a, b) => a + b, 0)) * 100}%` }}
                      ></div>
                   </div>
                 </div>
                 <span className="font-bold text-zinc-900 dark:text-white">{count}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-8 text-white">
          <h3 className="text-lg font-bold mb-6">Insights</h3>
          <p className="text-zinc-400 leading-relaxed">
            Your workshops are performing well. The average registration rate is high across all active sessions. 
            Consider adding more capacity to "active" workshops that are near their limit.
          </p>
          <div className="mt-8 rounded-xl bg-white/5 p-4 border border-white/10">
            <p className="text-sm text-zinc-400 italic">"Data is the new oil. Go refine it."</p>
          </div>
        </div>
      </div>
    </div>
  );
}
