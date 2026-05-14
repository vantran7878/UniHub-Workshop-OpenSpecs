import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calendar, Users, ClipboardList, TrendingUp, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Quản lý hệ thống UniHub',
}

async function getDashboardStats() {
  const supabase = await createClient()

  // Get workshop counts
  const { count: totalWorkshops } = await supabase
    .from('workshops')
    .select('*', { count: 'exact', head: true })

  const { count: upcomingWorkshops } = await supabase
    .from('workshops')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', new Date().toISOString())
    .eq('is_published', true)

  // Get user counts
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })

  const { count: studentCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  // Get registration counts
  const { count: totalRegistrations } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })

  const { count: confirmedRegistrations } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')

  // Get total revenue from successful payments
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'success')

  const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

  // Get recent workshops
  const { data: recentWorkshops } = await supabase
    .from('workshops')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  // Get recent registrations
  const { data: recentRegistrations } = await supabase
    .from('registrations')
    .select(`
      *,
      user:users(full_name, email),
      workshop:workshops(title)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    totalWorkshops: totalWorkshops || 0,
    upcomingWorkshops: upcomingWorkshops || 0,
    totalUsers: totalUsers || 0,
    studentCount: studentCount || 0,
    totalRegistrations: totalRegistrations || 0,
    confirmedRegistrations: confirmedRegistrations || 0,
    totalRevenue,
    recentWorkshops: recentWorkshops || [],
    recentRegistrations: recentRegistrations || [],
  }
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tổng quan</h1>
        <p className="text-muted-foreground mt-1">
          Quản lý và theo dõi hoạt động của hệ thống
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng Workshop
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkshops}</div>
            <p className="text-xs text-muted-foreground">
              {stats.upcomingWorkshops} sắp diễn ra
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Người dùng
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.studentCount} sinh viên
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Đăng ký
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.confirmedRegistrations} đã xác nhận
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Doanh thu
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Từ thanh toán thành công
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Workshops */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Workshop gần đây</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/workshops">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <CardDescription>
              Các workshop mới được tạo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentWorkshops.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Chưa có workshop nào
              </p>
            ) : (
              <div className="space-y-4">
                {stats.recentWorkshops.map((workshop: any) => (
                  <div key={workshop.id} className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <Link 
                        href={`/admin/workshops/${workshop.id}`}
                        className="font-medium hover:text-primary transition-colors line-clamp-1"
                      >
                        {workshop.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {workshop.confirmed_count}/{workshop.capacity} đăng ký
                      </p>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${
                      workshop.is_published ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Đăng ký gần đây</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/registrations">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <CardDescription>
              Các đăng ký workshop mới nhất
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Chưa có đăng ký nào
              </p>
            ) : (
              <div className="space-y-4">
                {stats.recentRegistrations.map((reg: any) => (
                  <div key={reg.id} className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium line-clamp-1">
                        {reg.user?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {reg.workshop?.title}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reg.status === 'confirmed' 
                        ? 'bg-green-100 text-green-800' 
                        : reg.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {reg.status === 'confirmed' ? 'Xác nhận' : 
                       reg.status === 'pending' ? 'Chờ' : 'Hủy'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hành động nhanh</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild>
            <Link href="/admin/workshops/new">
              Tạo Workshop mới
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/checkins">
              Quản lý Check-in
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/import">
              Import sinh viên
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
