"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Workshop } from "@/lib/types/database"

export default function AdminWorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const supabase = createClient()

  useEffect(() => {
    loadWorkshops()
  }, [])

  async function loadWorkshops() {
    setLoading(true)
    const { data, error } = await supabase
      .from("workshops")
      .select("*")
      .order("start_time", { ascending: false })

    if (!error && data) {
      setWorkshops(data)
    }
    setLoading(false)
  }

  const filteredWorkshops = workshops.filter(
    (w) =>
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      w.speaker?.toLowerCase().includes(search.toLowerCase())
  )

  async function deleteWorkshop(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa workshop này?")) return

    const { error } = await supabase.from("workshops").delete().eq("id", id)
    if (!error) {
      setWorkshops(workshops.filter((w) => w.id !== id))
    }
  }

  async function togglePublish(workshop: Workshop) {
    const { error } = await supabase
      .from("workshops")
      .update({ is_published: !workshop.is_published })
      .eq("id", workshop.id)

    if (!error) {
      setWorkshops(
        workshops.map((w) =>
          w.id === workshop.id ? { ...w, is_published: !w.is_published } : w
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản lý Workshop</h1>
          <p className="text-muted-foreground">Tạo và quản lý các workshop</p>
        </div>
        <Button asChild>
          <Link href="/admin/workshops/new">
            <Plus className="mr-2 h-4 w-4" />
            Tạo Workshop
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm workshop..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : filteredWorkshops.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có workshop nào
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Diễn giả</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>Đăng ký</TableHead>
                  <TableHead>Phí</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkshops.map((workshop) => (
                  <TableRow key={workshop.id}>
                    <TableCell>
                      <div className="font-medium">{workshop.title}</div>
                    </TableCell>
                    <TableCell>{workshop.speaker || "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(workshop.start_time)}
                      </div>
                    </TableCell>
                    <TableCell>{workshop.room_name || workshop.room_id || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {workshop.confirmed_count}/{workshop.capacity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {workshop.fee > 0 ? formatCurrency(workshop.fee) : "Miễn phí"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={workshop.is_published ? "default" : "secondary"}>
                        {workshop.is_published ? "Đã đăng" : "Nháp"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/workshops/${workshop.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Xem
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/workshops/${workshop.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePublish(workshop)}>
                            {workshop.is_published ? "Ẩn workshop" : "Đăng workshop"}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/workshops/${workshop.id}/registrations`}>
                              <Users className="mr-2 h-4 w-4" />
                              Xem đăng ký
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteWorkshop(workshop.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
