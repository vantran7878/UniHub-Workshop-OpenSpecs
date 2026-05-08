'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import api from '@/lib/api';
import { Calendar, MapPin, Users, Search, Filter, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface Workshop {
  id: string;
  title: string;
  description: string;
  speaker: string;
  room: string;
  capacity: number;
  seats_available: number;
  start_time: string;
  end_time: string;
  is_paid: boolean;
  price: string;
  status: 'active' | 'cancelled' | 'completed';
}

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const fetchWorkshops = async () => {
    try {
      const response = await api.get('/workshops?status=active');
      setWorkshops(response.data);
    } catch (error) {
      console.error('Failed to fetch workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkshops = workshops.filter(w => 
    w.title.toLowerCase().includes(search.toLowerCase()) || 
    w.speaker.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Explore Workshops</h1>
            <p className="text-gray-500 mt-1">Discover new skills and knowledge from our expert-led sessions.</p>
          </div>
          
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title or speaker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="h-12 w-12 animate-spin mb-4" />
            <p>Loading available workshops...</p>
          </div>
        ) : filteredWorkshops.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredWorkshops.map((workshop, idx) => (
              <motion.div
                key={workshop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      workshop.is_paid ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {workshop.is_paid ? `Paid: ${parseInt(workshop.price).toLocaleString()} VND` : 'Free'}
                    </span>
                    <div className="flex items-center text-xs text-gray-500">
                      <Users className="h-3 w-3 mr-1" />
                      {workshop.seats_available} / {workshop.capacity} left
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {workshop.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                    {workshop.description}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
                      {format(new Date(workshop.start_time), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-indigo-500" />
                      {workshop.room}
                    </div>
                  </div>
                </div>
                
                <Link 
                  href={`/workshops/${workshop.id}`}
                  className="bg-gray-50 p-4 flex items-center justify-center text-indigo-600 font-semibold hover:bg-indigo-600 hover:text-white transition-all group-hover:bg-indigo-50"
                >
                  View Details <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 text-lg italic">No workshops found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
