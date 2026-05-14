import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'
import { getMyRegistrations } from '@/lib/actions/registrations'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatTime, formatCurrency, getStatusText, getStatusColor } from '@/lib/utils'
import { Calendar, Clock, MapPin, QrCode, CreditCard, X } from 'lucide-react'
import { CancelRegistrationButton } from './cancel-button'

export const metadata = {
  title: 'Đăng ký của tôi',
  description: 'Quản lý các workshop đã đăng ký',
}

export default async function RegistrationsPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const { data: registrations } = await getMyRegistrations()

  const confirmedRegistrations = registrations.filter(r => r.status === 'confirmed')
  const pendingRegistrations = registrations.filter(r => r.status === 'pending')
  const cancelledRegistrations = registrations.filter(r => r.status === 'cancelled')

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Đăng ký của tôi</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý tất cả các workshop bạn đã đăng ký
            </p>
          </div>

          <Tabs defaultValue="confirmed" className="space-y-6">
            <TabsList>
              <TabsTrigger value="confirmed">
                Đã xác nhận ({confirmedRegistrations.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Chờ thanh toán ({pendingRegistrations.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Đã hủy ({cancelledRegistrations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="confirmed" className="space-y-4">
              {confirmedRegistrations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Chưa có đăng ký nào được xác nhận
                  </CardContent>
                </Card>
              ) : (
                confirmedRegistrations.map((registration) => (
                  <RegistrationCard 
                    key={registration.id} 
                    registration={registration} 
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              {pendingRegistrations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Không có đăng ký nào chờ thanh toán
                  </CardContent>
                </Card>
              ) : (
                pendingRegistrations.map((registration) => (
                  <RegistrationCard 
                    key={registration.id} 
                    registration={registration}
                    showPayment 
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-4">
              {cancelledRegistrations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Không có đăng ký nào đã hủy
                  </CardContent>
                </Card>
              ) : (
                cancelledRegistrations.map((registration) => (
                  <RegistrationCard 
                    key={registration.id} 
                    registration={registration} 
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function RegistrationCard({ 
  registration, 
  showPayment = false 
}: { 
  registration: any
  showPayment?: boolean 
}) {
  const workshop = registration.workshop
  const isPast = new Date(workshop.start_time) < new Date()

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link 
                  href={`/workshops/${workshop.id}`}
                  className="font-semibold text-lg hover:text-primary transition-colors"
                >
                  {workshop.title}
                </Link>
                {workshop.speaker && (
                  <p className="text-sm text-muted-foreground">
                    Diễn giả: {workshop.speaker}
                  </p>
                )}
              </div>
              <Badge className={getStatusColor(registration.status)}>
                {getStatusText(registration.status)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(workshop.start_time)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTime(workshop.start_time)} - {formatTime(workshop.end_time)}
              </span>
              {workshop.room_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {workshop.room_name}
                </span>
              )}
            </div>

            {registration.cancel_reason && (
              <p className="text-sm text-muted-foreground">
                Lý do hủy: {registration.cancel_reason}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {registration.qr_code && registration.status === 'confirmed' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/registrations/${registration.id}`}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Xem mã QR
                </Link>
              </Button>
            )}

            {showPayment && registration.status === 'pending' && (
              <Button size="sm" asChild>
                <Link href={`/dashboard/registrations/${registration.id}/payment`}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Thanh toán {formatCurrency(workshop.fee)}
                </Link>
              </Button>
            )}

            {registration.status !== 'cancelled' && !isPast && (
              <CancelRegistrationButton registrationId={registration.id} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
