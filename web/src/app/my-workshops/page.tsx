'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, QrCode, 
  CheckCircle2, XCircle, Loader2, Search,
  ExternalLink, Download
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface Registration {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  qr_code: string | null;
  created_at: string;
  workshop: {
    id: string;
    title: string;
    start_time: string;
    room: string;
    speaker: string;
  };
}

export default function MyWorkshopsPage() {
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<Registration | null>(null);

  useEffect(() => {
    if (user) {
      fetchRegistrations();
    }
  }, [user]);

  const fetchRegistrations = async () => {
    try {
      const response = await api.get('/registrations/my-registrations');
      setRegistrations(response.data);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-gray-500">Loading your workshops...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-32 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please login to view your workshops</h2>
          <Link href="/login" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">My Workshops</h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">Manage your registrations and access your entry passes.</p>
        </div>

        {registrations.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {registrations.map((reg, idx) => (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 hover:shadow-md transition-all group"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      reg.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      reg.status === 'attended' ? 'bg-indigo-100 text-indigo-700' :
                      reg.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {reg.status}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-400 font-medium">
                      Registered on {format(new Date(reg.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">
                    {reg.workshop.title}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center text-sm text-gray-500 font-medium">
                      <Calendar className="h-4 w-4 mr-2 text-indigo-400" />
                      {format(new Date(reg.workshop.start_time), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 font-medium">
                      <MapPin className="h-4 w-4 mr-2 text-indigo-400" />
                      {reg.workshop.room}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-4">
                    <Link 
                      href={`/workshops/${reg.workshop.id}`}
                      className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                    >
                      Workshop Page <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {reg.status === 'confirmed' && reg.qr_code && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 w-full sm:w-48 group-hover:bg-white transition-colors">
                    <div 
                      className="bg-white p-2 rounded-xl shadow-inner cursor-zoom-in mb-3"
                      onClick={() => setSelectedQR(reg)}
                    >
                      <QRCodeSVG value={reg.qr_code} size={100} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">QR ENTRY PASS</p>
                    <button 
                      onClick={() => setSelectedQR(reg)}
                      className="text-xs font-bold text-gray-600 hover:text-indigo-600 flex items-center"
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1" /> View Fullscreen
                    </button>
                  </div>
                )}
                
                {reg.status === 'attended' && (
                  <div className="flex flex-col items-center justify-center p-4 bg-indigo-50 rounded-2xl border border-indigo-100 w-full sm:w-48">
                    <CheckCircle2 className="h-12 w-12 text-indigo-600 mb-2" />
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest text-center">ATTENDANCE CONFIRMED</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl shadow-inner border-2 border-dashed border-gray-200">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No registrations found</h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto font-medium">You haven't registered for any workshops yet. Start exploring now!</p>
            <Link href="/workshops" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              Browse Workshops
            </Link>
          </div>
        )}
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {selectedQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setSelectedQR(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedQR(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
              
              <div className="text-center mb-8">
                <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-2">
                  {selectedQR.workshop.title}
                </h2>
                <p className="text-indigo-600 font-bold">{selectedQR.workshop.speaker}</p>
              </div>

              <div className="bg-indigo-50 p-6 rounded-3xl mb-8 flex justify-center shadow-inner border border-indigo-100">
                <div className="bg-white p-4 rounded-2xl shadow-xl">
                  <QRCodeSVG value={selectedQR.qr_code!} size={240} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-gray-500 font-bold text-sm">
                  <MapPin className="h-4 w-4 text-indigo-500" /> {selectedQR.workshop.room}
                </div>
                <div className="flex items-center justify-center gap-2 text-gray-500 font-bold text-sm">
                  <Calendar className="h-4 w-4 text-indigo-500" /> {format(new Date(selectedQR.workshop.start_time), 'MMM d, h:mm a')}
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-10">
                PRESENT AT DOOR FOR CHECK-IN
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
