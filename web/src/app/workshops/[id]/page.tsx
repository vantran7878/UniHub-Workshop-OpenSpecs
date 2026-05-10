'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { Workshop } from '../../../types/workshop';

interface WorkshopSummary {
  status: 'pending' | 'processing' | 'done' | 'failed';
  summary?: string;
  error_message?: string;
}

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [summary, setSummary] = useState<WorkshopSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<{ qr_code: string } | null>(null);

  const fetchWorkshop = useCallback(async () => {
    try {
      const data = await apiFetch<Workshop>(`/workshops/${id}`, {
        token: accessToken || undefined,
      });
      setWorkshop(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load workshop');
    } finally {
      setIsLoading(false);
    }
  }, [id, accessToken]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiFetch<WorkshopSummary>(`/workshops/${id}/summary`, {
        token: accessToken || undefined,
      });
      setSummary(data);
    } catch (err) {
      // Summary not found is not a critical error
      setSummary(null);
    }
  }, [id, accessToken]);

  useEffect(() => {
    fetchWorkshop();
    fetchSummary();
  }, [fetchWorkshop, fetchSummary]);

  const handleRegister = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // For paid workshops, we'd need an idempotency key. 
      // Generating a random one for demonstration purposes.
      const headers: any = {};
      if (workshop?.is_paid) {
        headers['Idempotency-Key'] = crypto.randomUUID();
      }

      const result = await apiFetch<{ qr_code: string; already_registered?: boolean }>('/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({ workshop_id: id }),
        token: accessToken || undefined,
      });

      setRegistrationSuccess({ qr_code: result.qr_code });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"></div>
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"></div>
      </div>
    );
  }

  if (!workshop) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button 
            onClick={() => router.back()}
            className="mb-4 flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            ← Back to workshops
          </button>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {workshop.title}
          </h1>
        </div>
        <div className={`rounded-full px-4 py-1 text-sm font-bold ${
          workshop.is_paid 
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
        }`}>
          {workshop.is_paid ? `Paid • ${workshop.price.toLocaleString()} VND` : 'Free Workshop'}
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">About this workshop</h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {workshop.description}
            </p>
          </section>

          {summary && summary.status === 'done' && (
            <section className="rounded-2xl bg-blue-50 p-8 dark:bg-blue-900/10">
              <h2 className="flex items-center text-xl font-bold text-blue-900 dark:text-blue-400">
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Summary
              </h2>
              <div className="mt-4 prose prose-blue dark:prose-invert max-w-none text-blue-800 dark:text-blue-300">
                {summary.summary}
              </div>
            </section>
          )}

          {summary && summary.status === 'processing' && (
            <section className="rounded-2xl border border-dashed border-blue-200 p-8 text-center dark:border-blue-800">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 animate-pulse">
                AI is generating a summary for this workshop...
              </p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <div className="sticky top-8 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Workshop Details</h3>
            
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Speaker</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{workshop.speaker}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date & Time</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                  {new Date(workshop.start_time).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Location</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{workshop.room}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Availability</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                  {workshop.seats_available} / {workshop.capacity} seats left
                </dd>
              </div>
            </dl>

            <div className="pt-4">
              {registrationSuccess ? (
                <div className="text-center space-y-4">
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium">
                    Registration successful!
                  </div>
                  {registrationSuccess.qr_code && (
                    <div className="flex flex-col items-center gap-2">
                       <div className="p-4 bg-white rounded-lg border-2 border-zinc-100">
                         {/* Simple placeholder for QR code visualization */}
                         <div className="w-32 h-32 bg-zinc-900 flex items-center justify-center text-white text-[10px] text-center p-2 break-all">
                           {registrationSuccess.qr_code}
                         </div>
                       </div>
                       <p className="text-[10px] text-zinc-500 uppercase tracking-widest">QR Code for Check-in</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || workshop.seats_available === 0 || workshop.status !== 'active'}
                    className="w-full rounded-xl bg-blue-600 px-4 py-4 text-center text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
                  >
                    {isRegistering ? 'Processing...' : workshop.seats_available === 0 ? 'Fully Booked' : 'Register Now'}
                  </button>
                  {error && (
                    <p className="mt-3 text-center text-xs font-medium text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
