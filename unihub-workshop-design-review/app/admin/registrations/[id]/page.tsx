import { getRegistrationById } from '@/lib/actions/registrations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Calendar, User, Mail, School, CreditCard, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { notFound } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export const metadata = {
  title: 'Chi tiết Đăng ký | Admin',
}

interface PageProps {
  params: {
    id: string
  }
}

export default async function RegistrationDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const { data: registration, error } = await getRegistrationById(resolvedParams.id)

  if (error || !registration) {
    notFound()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 border-none px-3 py-1">Xác nhận</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-none px-3 py-1">Chờ thanh toán</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-none px-3 py-1">Đã hủy</Badge>
      default:
        return <Badge variant="outline" className="px-3 py-1">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/registrations">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chi tiết Đăng ký</h1>
          <p className="text-muted-foreground text-sm">
            Mã đăng ký: {registration.id}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Thông tin Sinh viên
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Họ và tên:</span>
              <span className="col-span-2 font-medium">{registration.user?.full_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Email:</span>
              <span className="col-span-2 font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" /> {registration.user?.email}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">MSSV:</span>
              <span className="col-span-2 font-medium">{registration.user?.student_id || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Khoa/Viện:</span>
              <span className="col-span-2 font-medium flex items-center gap-1">
                <School className="h-3 w-3" /> {registration.user?.faculty || 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Workshop Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Thông tin Workshop
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Tên Workshop:</span>
              <span className="col-span-2 font-medium">{registration.workshop?.title}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Thời gian:</span>
              <span className="col-span-2 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> 
                {format(new Date(registration.workshop?.start_time), 'HH:mm dd/MM/yyyy', { locale: vi })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Địa điểm:</span>
              <span className="col-span-2 font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {registration.workshop?.room_name || 'TBD'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground text-sm">Phí đăng ký:</span>
              <span className="col-span-2 font-medium text-primary">
                {registration.workshop?.fee > 0 ? formatCurrency(registration.workshop.fee) : 'Miễn phí'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Registration Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Trạng thái Đăng ký
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Trạng thái hiện tại</p>
                <div className="flex items-center gap-3">
                  {getStatusBadge(registration.status)}
                  {registration.confirmed_at && (
                    <span className="text-xs text-muted-foreground">
                      Xác nhận lúc: {format(new Date(registration.confirmed_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/admin/workshops/${registration.workshop_id}/registrations`}>
                    Xem danh sách workshop
                  </Link>
                </Button>
              </div>
            </div>

            {registration.status === 'cancelled' && registration.cancel_reason && (
              <div className="p-4 border border-red-100 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-800">Lý do hủy:</p>
                <p className="text-sm text-red-700 mt-1">{registration.cancel_reason}</p>
                <p className="text-xs text-red-600 mt-2">
                  Hủy lúc: {format(new Date(registration.cancelled_at!), 'HH:mm dd/MM/yyyy', { locale: vi })}
                </p>
              </div>
            )}
            
            {registration.qr_code && (
              <div className="p-4 border border-green-100 bg-green-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Mã QR Check-in đã được tạo</p>
                  <p className="text-xs text-green-700 mt-1">Sử dụng để quét khi vào workshop</p>
                </div>
                <Badge className="bg-green-600 text-white border-none">{registration.qr_code}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
