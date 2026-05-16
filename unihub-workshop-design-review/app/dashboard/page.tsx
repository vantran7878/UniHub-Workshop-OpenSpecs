import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'
import { getMyRegistrations } from '@/lib/actions/registrations'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatTime, getStatusText, getStatusColor } from '@/lib/utils'
import { Calendar, Clock, QrCode, ArrowRight, BookOpen } from 'lucide-react'

export const metadata = {
  title: 'Dashboard',
  description: 'Quản lý đăng ký workshop của bạn',
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Redirect admin/staff to their dashboards
  if (user.role === 'admin') {
    redirect('/admin')
  }
  if (user.role === 'staff') {
    redirect('/')
  }

  const { data: registrations } = await getMyRegistrations()
  
  const upcomingRegistrations = registrations.filter(
    r => r.status === 'confirmed' && new Date(r.workshop.start_time) > new Date()
  )
  
  const pendingRegistrations = registrations.filter(r => r.status === 'pending')

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Xin chào, {user.full_name}!</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý các workshop đã đăng ký của bạn
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Workshop sắp tới</CardDescription>
                <CardTitle className="text-3xl">{upcomingRegistrations.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Chờ thanh toán</CardDescription>
                <CardTitle className="text-3xl">{pendingRegistrations.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tổng đăng ký</CardDescription>
                <CardTitle className="text-3xl">{registrations.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Pending Payments Alert */}
          {pendingRegistrations.length > 0 && (
            <Card className="mb-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="text-lg text-yellow-800 dark:text-yellow-200">
                  Bạn có {pendingRegistrations.length} đăng ký chờ thanh toán
                </CardTitle>
                <CardDescription className="text-yellow-700 dark:text-yellow-300">
                  Vui lòng hoàn tất thanh toán để xác nhận đăng ký
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/dashboard/registrations?status=pending">
                    Xem và thanh toán
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Workshops */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Workshop sắp tới</h2>
              <Button variant="ghost" asChild>
                <Link href="/dashboard/registrations">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {upcomingRegistrations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Bạn chưa đăng ký workshop nào sắp diễn ra
                  </p>
                  <Button asChild>
                    <Link href="/workshops">Khám phá workshop</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingRegistrations.slice(0, 3).map((registration) => (
                  <Card key={registration.id}>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{registration.workshop.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(registration.workshop.start_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(registration.workshop.start_time)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(registration.status)}>
                            {getStatusText(registration.status)}
                          </Badge>
                          {registration.qr_code && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/registrations/${registration.id}`}>
                                <QrCode className="mr-2 h-4 w-4" />
                                Mã QR
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Khám phá Workshop</CardTitle>
                <CardDescription>
                  Tìm kiếm và đăng ký các workshop mới
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/workshops">
                    Xem danh sách
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hồ sơ cá nhân</CardTitle>
                <CardDescription>
                  Cập nhật thông tin và cài đặt thông báo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/profile">
                    Chỉnh sửa hồ sơ
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
