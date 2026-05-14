import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'
import { getRegistrationById } from '@/lib/actions/registrations'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatTime, getStatusText, getStatusColor } from '@/lib/utils'
import { Calendar, Clock, MapPin, ArrowLeft, Download } from 'lucide-react'
import { QRCodeDisplay } from './qr-code-display'

export const metadata = {
  title: 'Chi tiết đăng ký',
}

export default async function RegistrationDetailPage({ 
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

  const workshop = registration.workshop

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container max-w-2xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/dashboard/registrations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại danh sách
            </Link>
          </Button>

          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge className={getStatusColor(registration.status)}>
                  {getStatusText(registration.status)}
                </Badge>
              </div>
              <CardTitle className="text-2xl">{workshop.title}</CardTitle>
              {workshop.speaker && (
                <CardDescription>Diễn giả: {workshop.speaker}</CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* QR Code */}
              {registration.qr_code && registration.status === 'confirmed' && (
                <QRCodeDisplay 
                  qrCode={registration.qr_code} 
                  workshopTitle={workshop.title}
                  userName={user.full_name}
                />
              )}

              {/* Workshop Info */}
              <div className="space-y-3 p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formatDate(workshop.start_time)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {formatTime(workshop.start_time)} - {formatTime(workshop.end_time)}
                    </p>
                  </div>
                </div>

                {workshop.room_name && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{workshop.room_name}</p>
                      {workshop.room_id && (
                        <p className="text-sm text-muted-foreground">Mã phòng: {workshop.room_id}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Registration Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngày đăng ký:</span>
                  <span>{formatDate(registration.registered_at)}</span>
                </div>
                {registration.confirmed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ngày xác nhận:</span>
                    <span>{formatDate(registration.confirmed_at)}</span>
                  </div>
                )}
                {registration.cancelled_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ngày hủy:</span>
                    <span>{formatDate(registration.cancelled_at)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href={`/workshops/${workshop.id}`}>
                    Xem chi tiết workshop
                  </Link>
                </Button>
                {workshop.materials_url && registration.status === 'confirmed' && (
                  <Button variant="outline" asChild>
                    <a href={workshop.materials_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Tải tài liệu workshop
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
