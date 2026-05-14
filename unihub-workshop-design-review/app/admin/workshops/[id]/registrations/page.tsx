"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Search, Download, CheckCircle, XCircle, Clock } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"

interface RegistrationWithUser {
  id: string
  status: string
  qr_code: string | null
  registered_at: string
  confirmed_at: string | null
  user: {
    id: string
    full_name: string
    email: string
    student_id: string | null
    faculty: string | null
  }
  checkins: { id: string; checked_in_at: string }[]
}

export default function WorkshopRegistrationsPage() {
  const params = useParams()
  const workshopId = params.id as string
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([])
  const [workshop, setWorkshop] = useState<{ title: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [workshopId])

  async function loadData() {
    setLoading(true)
    
    const [workshopRes, registrationsRes] = await Promise.all([
      supabase.from("workshops").select("title").eq("id", workshopId).single(),
      supabase
        .from("registrations")
        .select(`
          id,
          status,
          qr_code,
          registered_at,
          confirmed_at,
          user:users(id, full_name, email, student_id, faculty),
          checkins(id, checked_in_at)
        `)
        .eq("workshop_id", workshopId)
        .order("registered_at", { ascending: false }),
    ])

    if (workshopRes.data) setWorkshop(workshopRes.data)
    if (registrationsRes.data) {
      setRegistrations(registrationsRes.data as unknown as RegistrationWithUser[])
    }
    setLoading(false)
  }

  const filteredRegistrations = registrations.filter(
    (r) =>
      r.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.user?.student_id?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: registrations.length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    pending: registrations.filter((r) => r.status === "pending").length,
    checkedIn: registrations.filter((r) => r.checkins?.length > 0).length,
  }

  function exportCSV() {
    const headers = ["MSSV", "Họ tên", "Email", "Khoa", "Trạng thái", "Ngày đăng ký", "Check-in"]
    const rows = filteredRegistrations.map((r) => [
      r.user?.student_id || "",
      r.user?.full_name || "",
      r.user?.email || "",
      r.user?.faculty || "",
      r.status,
      r.registered_at ? new Date(r.registered_at).toLocaleDateString("vi-VN") : "",
      r.checkins?.length > 0 ? "Có" : "Không",
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `registrations-${workshopId}.csv`
    link.click()
  }

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Đã xác nhận</Badge>
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Chờ xử lý</Badge>
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Đã hủy</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/workshops">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Danh sách đăng ký</h1>
          <p className="text-muted-foreground">{workshop?.title}</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Xuất CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Tổng đăng ký</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">Đã xác nhận</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Chờ xử lý</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.checkedIn}</div>
            <p className="text-xs text-muted-foreground">Đã check-in</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, email, MSSV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có đăng ký nào
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MSSV</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Khoa</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                  <TableHead>Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-mono">
                      {reg.user?.student_id || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {reg.user?.full_name}
                    </TableCell>
                    <TableCell>{reg.user?.email}</TableCell>
                    <TableCell>{reg.user?.faculty || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={reg.status} />
                    </TableCell>
                    <TableCell>
                      {formatDate(reg.registered_at)}
                    </TableCell>
                    <TableCell>
                      {reg.checkins?.length > 0 ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          {formatDate(reg.checkins[0].checked_in_at)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
