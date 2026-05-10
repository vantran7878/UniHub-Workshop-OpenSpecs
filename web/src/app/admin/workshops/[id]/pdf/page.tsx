'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { apiFetch } from '../../../../lib/api';

export default function AdminPdfUploadPage() {
  const { id } = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiFetch(`/workshops/${id}/pdf`, {
        method: 'POST',
        body: formData,
        token: accessToken || undefined,
      });
      setMessage({ type: 'success', text: 'PDF uploaded successfully! AI is now generating a summary.' });
      setTimeout(() => router.push('/admin/workshops'), 2000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <button 
          onClick={() => router.back()}
          className="mb-4 text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Upload Workshop PDF</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Upload a PDF brochure or materials. Our AI will automatically generate a summary for the students.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-12 dark:border-zinc-800">
          <svg className="mb-4 h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
          />
          <p className="mt-2 text-xs text-zinc-500">Only PDF files up to 50MB</p>
        </div>

        {message && (
          <div className={`rounded-lg p-4 text-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-500 disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Start AI Processing'}
        </button>
      </form>
    </div>
  );
}
