'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Plus, Edit, Trash2, FileUp, BarChart3, 
  Users, Calendar, Clock, Loader2, MoreVertical,
  CheckCircle2, XCircle, AlertCircle, FileText
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface Workshop {
  id: string;
  title: string;
  speaker: string;
  capacity: number;
  seats_available: number;
  start_time: string;
  status: 'active' | 'cancelled' | 'completed';
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, registrations: 0, checkins: 0 });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const response = await api.get('/workshops');
      setWorkshops(response.data);
      // In a real app, fetch stats from a dedicated endpoint
      setStats({
        total: response.data.length,
        registrations: 450, // Mocked
        checkins: 380 // Mocked
      });
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workshop?')) return;
    try {
      await api.delete(`/workshops/${id}`);
      setWorkshops(workshops.filter(w => w.id !== id));
      toast.success('Workshop deleted');
    } catch (error) {
      toast.error('Failed to delete workshop');
    }
  };

  const handleFileUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      toast.loading('Uploading PDF...', { id: 'upload' });
      await api.post(`/workshops/${id}/pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('PDF uploaded and AI processing started!', { id: 'upload' });
    } catch (error) {
      toast.error('Upload failed', { id: 'upload' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-32 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-500 font-medium mt-1">Manage workshops and monitor attendance performance.</p>
          </div>
          <Link 
            href="/admin/workshops/new"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-105"
          >
            <Plus className="h-5 w-5 mr-2" /> New Workshop
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: 'Total Workshops', value: stats.total, icon: Calendar, color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Registrations', value: stats.registrations, icon: Users, color: 'bg-indigo-50 text-indigo-600' },
            { label: 'Total Attendees', value: stats.checkins, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center"
            >
              <div className={`w-12 h-12 rounded-2xl ${stat.color} flex items-center justify-center mr-4 shadow-sm`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-extrabold text-gray-900">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Workshop Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-xl font-extrabold text-gray-900">Manage Workshops</h2>
            <div className="flex gap-2">
              <span className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div> Active
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30 text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">
                  <th className="px-8 py-4">Workshop</th>
                  <th className="px-8 py-4">Speaker</th>
                  <th className="px-8 py-4">Stats</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {workshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="font-extrabold text-gray-900">{workshop.title}</div>
                      <div className="text-xs text-gray-400 font-medium flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" /> {format(new Date(workshop.start_time), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-gray-600 font-bold">{workshop.speaker}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-indigo-400" />
                        <span className="font-extrabold text-indigo-600">
                          {workshop.capacity - workshop.seats_available} / {workshop.capacity}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                        workshop.status === 'active' ? 'bg-green-100 text-green-700' :
                        workshop.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {workshop.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <Link 
                          href={`/admin/workshops/${workshop.id}/edit`}
                          className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </Link>
                        <label className="p-2 text-gray-400 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 rounded-lg transition-all cursor-pointer" title="Upload PDF">
                          <FileUp className="h-5 w-5" />
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(workshop.id, e)}
                          />
                        </label>
                        <button 
                          onClick={() => handleDelete(workshop.id)}
                          className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
