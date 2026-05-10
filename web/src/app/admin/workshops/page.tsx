'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { Workshop } from '../../../types/workshop';
import Link from 'next/link';

export default function AdminWorkshopPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken, user } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'admin') {
       setError('Access denied. Admin role required.');
       setIsLoading(false);
       return;
    }

    const fetchWorkshops = async () => {
      try {
        const data = await apiFetch<{ items: Workshop[] }>('/workshops?limit=100', {
          token: accessToken || undefined,
        });
        setWorkshops(data.items);
      } catch (err: any) {
        setError(err.message || 'Failed to load workshops');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkshops();
  }, [accessToken, user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/cancel this workshop?')) return;
    
    try {
      await apiFetch(`/workshops/${id}`, {
        method: 'DELETE',
        token: accessToken || undefined,
      });
      setWorkshops(workshops.filter(w => w.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete workshop');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading workshops...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Manage Workshops</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Create and manage your university workshops.</p>
        </div>
        <button 
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-500"
          onClick={() => alert('Create Workshop form would be here or on a new page.')}
        >
          + New Workshop
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Workshop</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Speaker</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {workshops.map((workshop) => (
              <tr key={workshop.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{workshop.title}</div>
                  <div className="text-xs text-zinc-500">{new Date(workshop.start_time).toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">{workshop.speaker}</td>
                <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {workshop.capacity} seats
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    workshop.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {workshop.status}
                  </span>
                </td>
                <td className="space-x-3 px-6 py-4 text-right text-sm font-medium">
                  <Link href={`/admin/workshops/${workshop.id}/pdf`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400">
                    PDF Summary
                  </Link>
                  <button className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">Edit</button>
                  <button 
                    onClick={() => handleDelete(workshop.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
