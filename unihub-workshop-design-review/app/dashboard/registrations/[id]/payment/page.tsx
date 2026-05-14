import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'
import { getRegistrationById } from '@/lib/actions/registrations'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PaymentForm } from './payment-form'

export const metadata = {
  title: 'Thanh toán',
}

export default async function PaymentPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const { data: registration, error } = await getRegistrationById(id)

  if (error || !registration) {
    notFound()
  }

  // Verify ownership
  if (registration.user_id !== user.id) {
    notFound()
  }

  // Check if payment is needed
  if (registration.status === 'confirmed') {
    redirect(`/dashboard/registrations/${id}`)
  }

  if (registration.status === 'cancelled') {
    redirect('/dashboard/registrations')
  }

  const workshop = registration.workshop

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container max-w-md">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/dashboard/registrations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>

          <PaymentForm
            registrationId={id}
            userId={user.id}
            workshopId={workshop.id}
            workshopTitle={workshop.title}
            amount={workshop.fee}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}
