import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getCurrentUser } from '@/lib/actions/auth'
import { getWorkshopById } from '@/lib/actions/workshops'
import { RegisterButton } from './register-button'
import { 
  formatDate, 
  formatTime, 
  formatCurrency, 
  getAvailableSeats, 
  isWorkshopFull,
  isRegistrationClosed,
  getTimeRemaining 
} from '@/lib/utils'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  User, 
  ArrowLeft,
  FileText,
  Download
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: workshop } = await getWorkshopById(id)
  
  if (!workshop) {
    return { title: 'Workshop không tồn tại' }
  }
  
  return {
    title: workshop.title,
    description: workshop.description || `Workshop: ${workshop.title}`,
  }
}

export default async function WorkshopDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const { data: workshop, error } = await getWorkshopById(id)

  if (error || !workshop) {
    notFound()
  }

  // Check if user is already registered
  let existingRegistration = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('registrations')
      .select('id, status, qr_code')
      .eq('user_id', user.id)
      .eq('workshop_id', id)
      .single()
    existingRegistration = data
  }

  const availableSeats = getAvailableSeats(workshop)
  const isFull = isWorkshopFull(workshop)
  const isClosed = isRegistrationClosed(workshop)
  const isPast = new Date(workshop.start_time) < new Date()
  const timeRemaining = getTimeRemaining(workshop.start_time)

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/workshops">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại danh sách
            </Link>
          </Button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {workshop.thumbnail_url && (
                <div className="aspect-video w-full overflow-hidden rounded-lg">
                  <img
                    src={workshop.thumbnail_url}
                    alt={workshop.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <div className="flex items-start gap-4 flex-wrap mb-4">
                  <h1 className="text-3xl font-bold flex-1">{workshop.title}</h1>
                  {isPast && <Badge variant="secondary">Đã kết thúc</Badge>}
                  {!isPast && isFull && <Badge variant="destructive">Hết chỗ</Badge>}
                  {!isPast && isClosed && !isFull && <Badge variant="outline">Hết hạn đăng ký</Badge>}
                </div>

                {workshop.speaker && (
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <User className="h-5 w-5" />
                    <span className="font-medium">Diễn giả: {workshop.speaker}</span>
                  </div>
                )}
              </div>

              <Separator />

              {workshop.description && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Mô tả</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {workshop.description}
                  </p>
                </div>
              )}

              {workshop.speaker_bio && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Về diễn giả</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {workshop.speaker_bio}
                  </p>
                </div>
              )}

              {workshop.ai_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Tóm tắt nội dung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{workshop.ai_summary}</p>
                  </CardContent>
                </Card>
              )}

              {workshop.materials_url && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Tài liệu</h2>
                  <Button variant="outline" asChild>
                    <a href={workshop.materials_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Tải tài liệu
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin workshop</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{formatDate(workshop.start_time)}</p>
                      <p className="text-sm text-muted-foreground">{timeRemaining}</p>
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

                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{availableSeats}/{workshop.capacity} chỗ trống</p>
                      <p className="text-sm text-muted-foreground">
                        Đã đăng ký: {workshop.confirmed_count} người
                      </p>
                    </div>
                  </div>

                  {workshop.registration_deadline && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Hạn đăng ký: {formatDate(workshop.registration_deadline)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Phí tham gia</span>
                    <span className="text-2xl text-primary">
                      {workshop.fee > 0 ? formatCurrency(workshop.fee) : 'Miễn phí'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!user ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Vui lòng đăng nhập để đăng ký workshop này.
                      </p>
                      <Button asChild className="w-full">
                        <Link href={`/auth/login?redirect=/workshops/${id}`}>
                          Đăng nhập để đăng ký
                        </Link>
                      </Button>
                    </div>
                  ) : existingRegistration ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium">
                          Trạng thái: {' '}
                          <Badge variant={
                            existingRegistration.status === 'confirmed' ? 'default' :
                            existingRegistration.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {existingRegistration.status === 'confirmed' ? 'Đã xác nhận' :
                             existingRegistration.status === 'pending' ? 'Chờ xử lý' : 'Đã hủy'}
                          </Badge>
                        </p>
                      </div>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/dashboard/registrations">
                          Xem đăng ký của tôi
                        </Link>
                      </Button>
                    </div>
                  ) : isPast ? (
                    <p className="text-sm text-muted-foreground">
                      Workshop này đã kết thúc.
                    </p>
                  ) : isClosed ? (
                    <p className="text-sm text-muted-foreground">
                      Đã hết hạn đăng ký cho workshop này.
                    </p>
                  ) : isFull ? (
                    <p className="text-sm text-muted-foreground">
                      Workshop này đã hết chỗ.
                    </p>
                  ) : (
                    <RegisterButton 
                      workshopId={id} 
                      fee={workshop.fee} 
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
