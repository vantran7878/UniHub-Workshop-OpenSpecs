import Navbar from '@/components/layout/Navbar';
import WorkshopForm from '@/components/admin/WorkshopForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewWorkshopPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/admin" className="inline-flex items-center text-gray-500 hover:text-indigo-600 mb-8 transition-colors font-medium">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Link>
        
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Create New Workshop</h1>
          <p className="text-gray-500 mt-2 text-lg">Enter the details for the upcoming session.</p>
        </div>

        <WorkshopForm />
      </div>
    </div>
  );
}
