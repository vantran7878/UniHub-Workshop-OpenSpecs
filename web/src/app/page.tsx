import Navbar from '@/components/layout/Navbar';
import { Calendar, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="bg-white border-b border-gray-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative">
            <div className="relative z-10 lg:w-1/2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
                Enhance Your Skills with <span className="text-indigo-600">UniHub Workshops</span>
              </h1>
              <p className="mt-6 text-xl text-gray-500 max-w-xl">
                Discover, register, and participate in world-class workshops designed for students. From technical skills to personal development.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href="#workshops" className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10 shadow-lg shadow-indigo-100">
                  Browse Workshops
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center px-8 py-3 border border-indigo-200 text-base font-medium rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 md:py-4 md:text-lg md:px-10">
                  Join Now
                </Link>
              </div>
            </div>
            
            {/* Abstract Background Decoration */}
            <div className="hidden lg:block absolute top-1/2 right-0 -translate-y-1/2 w-1/3 h-full">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
              <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Easy Scheduling</h3>
                <p className="text-gray-600">Track all your upcoming workshops in one place and never miss a session.</p>
              </div>
              <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Expert Speakers</h3>
                <p className="text-gray-600">Learn from industry professionals and university experts across all fields.</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <ArrowRight className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Quick Check-in</h3>
                <p className="text-gray-500">Scan your unique QR code at the door for instant attendance confirmation.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workshop List Placeholder */}
        <section id="workshops" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Featured Workshops</h2>
              <p className="text-gray-500 mt-2">Check out the most popular upcoming events.</p>
            </div>
            <Link href="/workshops" className="text-indigo-600 font-semibold hover:text-indigo-700 flex items-center">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Skeleton / Placeholder for Workshop Cards */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} UniHub Workshop. Built with Passion for Students.</p>
        </div>
      </footer>
    </div>
  );
}
