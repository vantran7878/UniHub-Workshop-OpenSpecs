'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { Workshop } from '../../types/workshop';
import Link from 'next/link';

export default function WorkshopListPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        const data = await apiFetch<{ items: Workshop[] }>('/workshops', {
          token: accessToken || undefined,
        });
        setWorkshops(data.items);
      } catch (err: any) {
        console.error('Fetch workshops error:', err);
        setError(err.message || 'Failed to load workshops');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkshops();
  }, [accessToken]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"></div>
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"></div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center px-4">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Oops! Something went wrong</h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Upcoming Workshops
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Discover and register for the latest skills workshops.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {workshops.map((workshop) => (
          <Link
            key={workshop.id}
            href={`/workshops/${workshop.id}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:border-blue-500 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-400"
          >
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  workshop.is_paid 
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  {workshop.is_paid ? 'Paid' : 'Free'}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(workshop.start_time).toLocaleDateString()}
                </span>
              </div>
              
              <h3 className="mt-4 text-xl font-bold text-zinc-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {workshop.title}
              </h3>
              
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {workshop.description}
              </p>
              
              <div className="mt-6 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
                   <svg className="h-full w-full text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {workshop.speaker}
                </span>
              </div>

              <div className="mt-auto pt-6">
                <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400">
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {workshop.room}
                  </div>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    View Details →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {!isLoading && workshops.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">No upcoming workshops found at the moment.</p>
          <Link href="/" className="mt-4 text-blue-600 hover:underline">Go back home</Link>
        </div>
      )}
    </div>
  );
}
