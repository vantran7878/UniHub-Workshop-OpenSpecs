'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Calendar, MapPin, Users, Clock, Info, 
  CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  CreditCard, QrCode, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

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
  registration_open_at: string;
  registration_close_at: string;
}

interface Registration {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  qr_code: string | null;
}

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [summary, setSummary] = useState<{ summary: string, status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, user]);

  const fetchData = async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        api.get(`/workshops/${id}`),
        api.get(`/workshops/${id}/summary`).catch(() => null)
      ]);
      
      setWorkshop(wRes.data);
      if (sRes) setSummary(sRes.data);

      if (user) {
        const rRes = await api.get('/registrations/my-registrations').catch(() => ({ data: [] }));
        const myReg = rRes.data.find((r: any) => r.workshop_id === id);
        if (myReg) setRegistration(myReg);
      }
    } catch (error) {
      toast.error('Failed to load workshop details');
      router.push('/workshops');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      toast.error('Please login to register');
      return router.push('/login');
    }

    setRegistering(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await api.post('/registrations/register', 
        { workshop_id: id },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      
      setRegistration(response.data);
      toast.success(workshop?.is_paid ? 'Registration pending payment' : 'Registration successful!');
      
      if (workshop?.is_paid) {
        // In a real app, redirect to payment gateway
        toast('Redirecting to payment gateway (Simulated)...', { icon: '💳' });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancel = async () => {
    if (!registration) return;
    
    if (!confirm('Are you sure you want to cancel your registration?')) return;

    try {
      await api.post(`/registrations/${registration.id}/cancel`);
      setRegistration({ ...registration, status: 'cancelled' });
      toast.success('Registration cancelled');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Cancellation failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 text-indigo-600">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!workshop) return null;

  const isRegistrationOpen = new Date() >= new Date(workshop.registration_open_at) && 
                             new Date() <= new Date(workshop.registration_close_at);
  
  const canRegister = isRegistrationOpen && 
                      workshop.status === 'active' && 
                      workshop.seats_available > 0 && 
                      (!registration || registration.status === 'cancelled');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <Link href="/workshops" className="inline-flex items-center text-gray-500 hover:text-indigo-600 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workshops
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
            >
              <div className="flex flex-wrap gap-2 mb-6">
                <span className={`px-4 py-1 rounded-full text-sm font-bold shadow-sm ${
                  workshop.is_paid ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                }`}>
                  {workshop.is_paid ? `Premium: ${parseInt(workshop.price).toLocaleString()} VND` : 'Free Workshop'}
                </span>
                {workshop.status === 'cancelled' && (
                  <span className="px-4 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 shadow-sm">
                    Cancelled
                  </span>
                )}
              </div>

              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{workshop.title}</h1>
              <p className="text-xl text-gray-500 font-medium mb-8 flex items-center">
                <Users className="h-6 w-6 mr-2 text-indigo-500" /> 
                Presented by <span className="text-gray-900 ml-1">{workshop.speaker}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="flex items-start">
                  <Calendar className="h-6 w-6 text-indigo-600 mt-1 mr-4" />
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Date & Time</p>
                    <p className="text-lg font-bold text-gray-900">{format(new Date(workshop.start_time), 'EEEE, MMMM d')}</p>
                    <p className="text-gray-600 font-medium">
                      {format(new Date(workshop.start_time), 'h:mm a')} - {format(new Date(workshop.end_time), 'h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-6 w-6 text-indigo-600 mt-1 mr-4" />
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Location</p>
                    <p className="text-lg font-bold text-gray-900">{workshop.room}</p>
                    <p className="text-gray-600 font-medium underline cursor-pointer hover:text-indigo-600 transition-colors italic">View map</p>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">About this Workshop</h3>
                <div className="prose prose-indigo max-w-none text-gray-600 leading-relaxed text-lg">
                  {workshop.description}
                </div>
              </div>
            </motion.div>

            {/* AI Summary Section */}
            {summary && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="h-24 w-24" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center mb-6">
                    <Sparkles className="h-6 w-6 mr-2 text-indigo-200" />
                    <h3 className="text-2xl font-bold">AI Intelligence Summary</h3>
                  </div>
                  {summary.status === 'done' ? (
                    <p className="text-lg leading-relaxed text-indigo-50 font-medium">
                      {summary.summary}
                    </p>
                  ) : (
                    <div className="flex items-center text-indigo-200">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processing AI summary...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar / Actions */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 sticky top-24"
            >
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Availability</p>
                  <p className="text-indigo-600 font-extrabold text-xl">{workshop.seats_available} / {workshop.capacity}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-1000 ${
                      workshop.seats_available / workshop.capacity < 0.2 ? 'bg-red-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${(workshop.seats_available / workshop.capacity) * 100}%` }}
                  ></div>
                </div>
              </div>

              {registration && registration.status !== 'cancelled' ? (
                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl flex items-start ${
                    registration.status === 'confirmed' ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'
                  }`}>
                    {registration.status === 'confirmed' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 mt-1" />
                    ) : (
                      <Clock className="h-6 w-6 text-amber-600 mr-3 mt-1" />
                    )}
                    <div>
                      <p className={`font-bold text-lg ${
                        registration.status === 'confirmed' ? 'text-green-800' : 'text-amber-800'
                      }`}>
                        {registration.status === 'confirmed' ? 'You\'re Registered!' : 'Payment Pending'}
                      </p>
                      <p className="text-sm opacity-80">
                        {registration.status === 'confirmed' 
                          ? 'Your spot is secured. See you there!' 
                          : 'Please complete your payment to confirm.'}
                      </p>
                    </div>
                  </div>

                  {registration.status === 'confirmed' && (
                    <Link 
                      href="/my-workshops"
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all text-lg"
                    >
                      <QrCode className="h-6 w-6 mr-2" /> View My QR Code
                    </Link>
                  )}

                  <button
                    onClick={handleCancel}
                    className="w-full text-red-500 font-bold py-2 hover:bg-red-50 rounded-xl transition-colors text-sm"
                  >
                    Cancel Registration
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    disabled={!canRegister || registering}
                    onClick={handleRegister}
                    className={`w-full py-4 rounded-xl font-extrabold text-xl flex items-center justify-center transition-all shadow-xl shadow-indigo-50 ${
                      canRegister 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {registering ? (
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    ) : (
                      <>
                        {workshop.is_paid ? <CreditCard className="h-6 w-6 mr-2" /> : <CheckCircle2 className="h-6 w-6 mr-2" />}
                        {workshop.is_paid ? 'Register & Pay' : 'Register Now'}
                      </>
                    )}
                  </button>

                  {!isRegistrationOpen && workshop.status === 'active' && (
                    <p className="text-center text-amber-600 font-bold flex items-center justify-center text-sm p-3 bg-amber-50 rounded-xl">
                      <Clock className="h-4 w-4 mr-2" />
                      {new Date() < new Date(workshop.registration_open_at) 
                        ? `Opens ${format(new Date(workshop.registration_open_at), 'MMM d, h:mm a')}`
                        : 'Registration closed'}
                    </p>
                  )}

                  {workshop.seats_available === 0 && (
                    <p className="text-center text-red-600 font-bold bg-red-50 p-3 rounded-xl flex items-center justify-center text-sm">
                      <AlertCircle className="h-4 w-4 mr-2" /> No spots available
                    </p>
                  )}
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-gray-100 space-y-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Confirmations are sent via email. For paid workshops, your spot is held for 30 minutes until payment is confirmed.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
