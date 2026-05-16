import { getAllRegistrations } from '@/lib/actions/registrations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination'
import { Search, Mail, User as UserIcon, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import Link from 'next/link'
import { RegistrationsFilter } from '@/components/admin/registrations-filter'
import { RegistrationStatusUpdate } from '@/components/admin/registration-status-update'

export const metadata = {
  title: 'Quản lý Đăng ký | Admin',
  description: 'Quản lý danh sách đăng ký workshop',
}

interface PageProps {
  searchParams: {
    page?: string
    search?: string
    status?: string
  }
}

export default async function AdminRegistrationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const page = Number(resolvedSearchParams.page) || 1
  const search = resolvedSearchParams.search || ''
  const status = resolvedSearchParams.status || 'all'
  const limit = 10

  const { data: registrations, total, totalPages } = await getAllRegistrations({
    page,
    limit,
    search,
    status
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">Xác nhận</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-none">Chờ</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Đã hủy</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Quản lý Đăng ký</h1>
        <p className="text-muted-foreground">
          Xem và quản lý tất cả các lượt đăng ký workshop trong hệ thống.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách đăng ký</CardTitle>
          <CardDescription>
            Tổng cộng {total} lượt đăng ký
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <form action="/admin/registrations" method="GET">
                <Input
                  name="search"
                  placeholder="Tìm theo tên, email, MSSV..."
                  defaultValue={search}
                  className="pl-9"
                />
                {status !== 'all' && <input type="hidden" name="status" value={status} />}
              </form>
            </div>
            <RegistrationsFilter currentStatus={status} />
          </div>

          {/* Table */}
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sinh viên</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Không tìm thấy đăng ký nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{reg.user?.full_name || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {reg.user?.email}
                          </span>
                          {reg.user?.student_id && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> {reg.user?.student_id}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 max-w-[250px]">
                          <span className="font-medium truncate text-foreground" title={reg.workshop?.title}>
                            {reg.workshop?.title}
                          </span>
                          <Link 
                            href={`/admin/workshops/${reg.workshop_id}/registrations`}
                            className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                          >
                            Xem tất cả đăng ký workshop này <ExternalLink className="h-2 w-2" />
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">
                            {format(new Date(reg.created_at), 'dd/MM/yyyy', { locale: vi })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(reg.created_at), 'HH:mm', { locale: vi })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RegistrationStatusUpdate registrationId={reg.id} currentStatus={reg.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link 
                          href={`/admin/registrations/${reg.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Chi tiết
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href={`/admin/registrations?page=${page - 1}${search ? `&search=${search}` : ''}${status !== 'all' ? `&status=${status}` : ''}`}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      return p >= page - 1 && p <= page + 1;
                    })
                    .map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink 
                          href={`/admin/registrations?page=${p}${search ? `&search=${search}` : ''}${status !== 'all' ? `&status=${status}` : ''}`}
                          isActive={p === page}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                  <PaginationItem>
                    <PaginationNext 
                      href={`/admin/registrations?page=${page + 1}${search ? `&search=${search}` : ''}${status !== 'all' ? `&status=${status}` : ''}`}
                      aria-disabled={page >= totalPages}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
