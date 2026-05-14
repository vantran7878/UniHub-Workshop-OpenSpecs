"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function NewWorkshopPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClient()

  const [form, setForm] = useState({
    title: "",
    description: "",
    speaker: "",
    speaker_bio: "",
    room_id: "",
    room_name: "",
    capacity: 50,
    start_time: "",
    end_time: "",
    registration_deadline: "",
    fee: 0,
    is_published: false,
    thumbnail_url: "",
    materials_url: "",
    pdf_url: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data: { user } } = await supabase.auth.getUser()
    
    const { error: insertError } = await supabase.from("workshops").insert({
      ...form,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      registration_deadline: form.registration_deadline 
        ? new Date(form.registration_deadline).toISOString() 
        : null,
      created_by: user?.id,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push("/admin/workshops")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/workshops">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tạo Workshop mới</h1>
          <p className="text-muted-foreground">Điền thông tin để tạo workshop</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
            <CardDescription>Thông tin chính của workshop</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tên Workshop *</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nhập tên workshop"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả chi tiết về workshop"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="speaker">Diễn giả</Label>
                <Input
                  id="speaker"
                  value={form.speaker}
                  onChange={(e) => setForm({ ...form, speaker: e.target.value })}
                  placeholder="Tên diễn giả"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speaker_bio">Giới thiệu diễn giả</Label>
                <Input
                  id="speaker_bio"
                  value={form.speaker_bio}
                  onChange={(e) => setForm({ ...form, speaker_bio: e.target.value })}
                  placeholder="Thông tin về diễn giả"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Địa điểm và Thời gian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room_id">Mã phòng</Label>
                <Input
                  id="room_id"
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  placeholder="VD: A101"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room_name">Tên phòng</Label>
                <Input
                  id="room_name"
                  value={form.room_name}
                  onChange={(e) => setForm({ ...form, room_name: e.target.value })}
                  placeholder="VD: Hội trường A"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Thời gian bắt đầu *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Thời gian kết thúc *</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_deadline">Hạn đăng ký</Label>
              <Input
                id="registration_deadline"
                type="datetime-local"
                value={form.registration_deadline}
                onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sức chứa và Chi phí</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Sức chứa tối đa *</Label>
                <Input
                  id="capacity"
                  type="number"
                  required
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee">Phí tham gia (VND)</Label>
                <Input
                  id="fee"
                  type="number"
                  min={0}
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: parseInt(e.target.value) || 0 })}
                  placeholder="0 = Miễn phí"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">URL ảnh thumbnail</Label>
              <Input
                id="thumbnail_url"
                type="url"
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materials_url">URL tài liệu</Label>
              <Input
                id="materials_url"
                type="url"
                value={form.materials_url}
                onChange={(e) => setForm({ ...form, materials_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf_url">URL PDF</Label>
              <Input
                id="pdf_url"
                type="url"
                value={form.pdf_url}
                onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xuất bản</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_published">Công khai workshop</Label>
                <p className="text-sm text-muted-foreground">
                  Workshop sẽ hiển thị cho sinh viên
                </p>
              </div>
              <Switch
                id="is_published"
                checked={form.is_published}
                onCheckedChange={(checked) => setForm({ ...form, is_published: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link href="/admin/workshops">Hủy</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Đang lưu..." : "Lưu Workshop"}
          </Button>
        </div>
      </form>
    </div>
  )
}
