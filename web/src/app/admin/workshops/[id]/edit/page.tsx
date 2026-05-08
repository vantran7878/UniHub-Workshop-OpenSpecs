'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import WorkshopForm from '@/components/admin/WorkshopForm';
import api from '@/lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EditWorkshopPage() {
  const { id } = useParams();
  const router = useRouter();
  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchWorkshop();
    }
  }, [id]);

  const fetchWorkshop = async () => {
    try {
      const response = await api.get(`/workshops/${id}`);
      setWorkshop(response.data);
    } catch (error) {
      toast.error('Failed to load workshop');
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/admin" className="inline-flex items-center text-gray-500 hover:text-indigo-600 mb-8 transition-colors font-medium">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Link>
        
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Edit Workshop</h1>
          <p className="text-gray-500 mt-2 text-lg">Update session details and settings.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>
        ) : (
          <WorkshopForm initialData={workshop} isEditing />
        )}
      </div>
    </div>
  );
}
