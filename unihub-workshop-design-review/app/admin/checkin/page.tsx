"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle, XCircle, QrCode, Search, Users, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import { checkInByQrCode } from "@/lib/actions/checkins"

interface Workshop {
  id: string
  title: string
  start_time: string
  room_name: string | null
  confirmed_count: number
  capacity: number
}

interface CheckinResult {
  success: boolean
  message: string
  user?: {
    full_name: string
    student_id: string | null
  }
}

export default function AdminCheckinPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("")
  const [qrInput, setQrInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null)
  const [recentCheckins, setRecentCheckins] = useState<Array<{
    id: string
    user_name: string
    student_id: string | null
    checked_in_at: string
  }>>([])
  const [checkinCount, setCheckinCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadWorkshops()
  }, [])

  useEffect(() => {
    if (selectedWorkshop) {
      loadCheckinStats()
      inputRef.current?.focus()
    }
  }, [selectedWorkshop])

  async function loadWorkshops() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from("workshops")
      .select("id, title, start_time, room_name, confirmed_count, capacity")
      .gte("start_time", today.toISOString())
      .order("start_time", { ascending: true })
      .limit(20)

    if (data) setWorkshops(data)
  }

  async function loadCheckinStats() {
    const { data: checkins, count } = await supabase
      .from("checkins")
      .select(`
        id,
        checked_in_at,
        registration:registrations!inner(
          workshop_id,
          user:users(full_name, student_id)
        )
      `, { count: "exact" })
      .eq("registration.workshop_id", selectedWorkshop)
      .order("checked_in_at", { ascending: false })
      .limit(10)

    if (checkins) {
      setRecentCheckins(
        checkins.map((c: any) => ({
          id: c.id,
          user_name: c.registration?.user?.full_name || "Unknown",
          student_id: c.registration?.user?.student_id,
          checked_in_at: c.checked_in_at,
        }))
      )
    }
    setCheckinCount(count || 0)
  }

  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault()
    if (!qrInput.trim() || !selectedWorkshop) return

    setLoading(true)
    setCheckinResult(null)

    try {
      const result = await checkInByQrCode(qrInput.trim())

      setCheckinResult({
        success: result.success,
        message: result.message,
        user: result.registration?.user,
      })

      if (result.success) {
        loadCheckinStats()
      }
    } catch (error) {
      setCheckinResult({
        success: false,
        message: "Có lỗi xảy ra khi xử lý check-in",
      })
    }

    setQrInput("")
    setLoading(false)
    inputRef.current?.focus()
  }

  const selectedWorkshopData = workshops.find((w) => w.id === selectedWorkshop)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-in Workshop</h1>
        <p className="text-muted-foreground">Quét mã QR để check-in sinh viên</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chọn Workshop</CardTitle>
              <CardDescription>Chọn workshop để bắt đầu check-in</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn workshop..." />
                </SelectTrigger>
                <SelectContent>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      <div className="flex items-center gap-2">
                        <span>{workshop.title}</span>
                        <span className="text-muted-foreground text-sm">
                          ({formatDate(workshop.start_time)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedWorkshopData && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="font-medium">{selectedWorkshopData.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedWorkshopData.room_name && (
                      <span>Phòng: {selectedWorkshopData.room_name} | </span>
                    )}
                    <span>
                      Đăng ký: {selectedWorkshopData.confirmed_count}/{selectedWorkshopData.capacity}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedWorkshop && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Quét mã QR
                </CardTitle>
                <CardDescription>
                  Nhập hoặc quét mã QR của sinh viên
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckin} className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Nhập mã QR..."
                      className="text-lg h-12"
                      autoFocus
                    />
                    <Button type="submit" size="lg" disabled={loading || !qrInput.trim()}>
                      {loading ? "Đang xử lý..." : "Check-in"}
                    </Button>
                  </div>
                </form>

                {checkinResult && (
                  <div
                    className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                      checkinResult.success
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    {checkinResult.success ? (
                      <CheckCircle className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium">{checkinResult.message}</div>
                      {checkinResult.user && (
                        <div className="text-sm mt-1">
                          {checkinResult.user.full_name}
                          {checkinResult.user.student_id && (
                            <span className="ml-2 font-mono">
                              ({checkinResult.user.student_id})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Thống kê
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{checkinCount}</div>
              <p className="text-muted-foreground">Đã check-in</p>
              {selectedWorkshopData && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Tổng đăng ký: </span>
                  <span className="font-medium">{selectedWorkshopData.confirmed_count}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Check-in gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCheckins.length === 0 ? (
                <p className="text-muted-foreground text-sm">Chưa có check-in nào</p>
              ) : (
                <div className="space-y-3">
                  {recentCheckins.map((checkin) => (
                    <div
                      key={checkin.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <div className="font-medium text-sm">{checkin.user_name}</div>
                        {checkin.student_id && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {checkin.student_id}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(checkin.checked_in_at).toLocaleTimeString("vi-VN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
