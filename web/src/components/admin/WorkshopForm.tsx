'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, X, Calendar, Clock, MapPin, Users, DollarSign, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';

interface WorkshopFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function WorkshopForm({ initialData, isEditing }: WorkshopFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    speaker: initialData?.speaker || '',
    room: initialData?.room || '',
    capacity: initialData?.capacity || 50,
    start_time: initialData?.start_time ? format(new Date(initialData.start_time), "yyyy-MM-dd'T'HH:mm") : '',
    end_time: initialData?.end_time ? format(new Date(initialData.end_time), "yyyy-MM-dd'T'HH:mm") : '',
    registration_open_at: initialData?.registration_open_at ? format(new Date(initialData.registration_open_at), "yyyy-MM-dd'T'HH:mm") : '',
    registration_close_at: initialData?.registration_close_at ? format(new Date(initialData.registration_close_at), "yyyy-MM-dd'T'HH:mm") : '',
    is_paid: initialData?.is_paid || false,
    price: initialData?.price || 0,
    status: initialData?.status || 'active',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        await api.put(`/workshops/${initialData.id}`, formData);
        toast.success('Workshop updated');
      } else {
        await api.post('/workshops', formData);
        toast.success('Workshop created');
      }
      router.push('/admin');
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseInt(value) : value 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Basic Info */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2 text-indigo-600">
            <AlignLeft className="h-5 w-5" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Basic Information</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Workshop Title</label>
              <input
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Advanced React Patterns"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Speaker Name</label>
              <input
                name="speaker"
                required
                value={formData.speaker}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Dr. Jane Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={5}
                required
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                placeholder="Detailed information about the workshop..."
              />
            </div>
          </div>
        </div>

        {/* Venue & Capacity */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <MapPin className="h-5 w-5" />
              <h3 className="font-bold uppercase tracking-widest text-sm">Venue & Capacity</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Room / Location</label>
                <input
                  name="room"
                  required
                  value={formData.room}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Lab 402"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Max Capacity</label>
                <input
                  name="capacity"
                  type="number"
                  required
                  min="1"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <DollarSign className="h-5 w-5" />
              <h3 className="font-bold uppercase tracking-widest text-sm">Pricing</h3>
            </div>
            
            <div className="flex items-center gap-6">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  name="is_paid"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 transition-all"
                />
                <span className="ml-3 font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Is Paid Workshop?</span>
              </label>
              
              {formData.is_paid && (
                <div className="flex-1 animate-in fade-in slide-in-from-left-2">
                  <input
                    name="price"
                    type="number"
                    required
                    value={formData.price}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Price in VND"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2 text-indigo-600">
            <Clock className="h-5 w-5" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Schedule</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
              <input
                name="start_time"
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
              <input
                name="end_time"
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Registration Window */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2 text-indigo-600">
            <Calendar className="h-5 w-5" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Registration Window</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Open At</label>
              <input
                name="registration_open_at"
                type="datetime-local"
                required
                value={formData.registration_open_at}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Close At</label>
              <input
                name="registration_close_at"
                type="datetime-local"
                required
                value={formData.registration_close_at}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-12">
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="px-8 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center"
        >
          <X className="h-5 w-5 mr-2" /> Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          {isEditing ? 'Update Workshop' : 'Create Workshop'}
        </button>
      </div>
    </form>
  );
}
