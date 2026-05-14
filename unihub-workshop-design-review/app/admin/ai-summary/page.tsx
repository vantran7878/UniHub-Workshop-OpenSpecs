'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { summarizeWorkshopPDF, updateWorkshopDescription } from '@/lib/actions/workshop-pdf-summary'
import { Loader2, Sparkles, Upload, Save } from 'lucide-react'

export default function AIWorkshopSummaryPage() {
  const supabase = createClient()
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Fetch workshops
  const { data: workshops = [], isLoading: workshopsLoading } = useQuery({
    queryKey: ['workshops'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workshops')
        .select('id, title')
        .order('start_time', { ascending: false })
      return data || []
    },
  })

  const handleProcessPDF = async () => {
    if (!selectedWorkshopId || !pdfFile) {
      alert('Vui lòng chọn workshop và upload file PDF')
      return
    }

    setLoading(true)
    setSummary('')

    try {
      // Read file as buffer
      const arrayBuffer = await pdfFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Summarize PDF
      const result = await summarizeWorkshopPDF(selectedWorkshopId, buffer)

      if (result.success) {
        setSummary(result.summary || '')
      } else {
        setSummary(`Lỗi: ${result.error || result.message}`)
      }
    } catch (error) {
      setSummary(`Lỗi khi xử lý PDF: ${String(error)}`)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSummary = async () => {
    if (!selectedWorkshopId || !summary) {
      alert('Không có nội dung để lưu')
      return
    }

    setSaving(true)

    try {
      const result = await updateWorkshopDescription(selectedWorkshopId, summary)

      if (result.success) {
        alert('Cập nhật mô tả workshop thành công!')
        setSummary('')
        setPdfFile(null)
        setSelectedWorkshopId('')
      } else {
        alert(`Lỗi: ${result.error}`)
      }
    } catch (error) {
      alert(`Lỗi: ${String(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const selectedWorkshop = workshops.find(w => w.id === selectedWorkshopId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Workshop Description</h1>
        <p className="text-muted-foreground mt-1">
          Upload PDF của workshop, AI sẽ tóm tắt và cập nhật mô tả
        </p>
      </div>

      {/* Workshop Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn Workshop</CardTitle>
          <CardDescription>
            Chọn workshop bạn muốn cập nhật mô tả
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedWorkshopId}
            onChange={(e) => {
              setSelectedWorkshopId(e.target.value)
              setSummary('')
              setPdfFile(null)
            }}
            disabled={workshopsLoading}
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
          >
            <option value="">-- Chọn workshop --</option>
            {workshops.map((workshop) => (
              <option key={workshop.id} value={workshop.id}>
                {workshop.title}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* PDF Upload */}
      {selectedWorkshopId && (
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF</CardTitle>
            <CardDescription>
              Tải lên file PDF của workshop "{selectedWorkshop?.title}"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-input"
                disabled={loading}
              />
              <label htmlFor="pdf-input" className="cursor-pointer">
                {pdfFile ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-green-600">{pdfFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-semibold">Click để chọn hoặc kéo thả file PDF</p>
                    <p className="text-sm text-muted-foreground">PDF format, tối đa 10MB</p>
                  </div>
                )}
              </label>
            </div>

            <Button
              onClick={handleProcessPDF}
              disabled={!pdfFile || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý PDF...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Tóm tắt bằng AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Result */}
      {summary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <CardTitle>Mô tả từ AI</CardTitle>
              <Badge variant="secondary">Preview</Badge>
            </div>
            <CardDescription>
              Xem trước nội dung mô tả trước khi lưu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveSummary}
                disabled={saving}
                className="flex-1"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Lưu mô tả
                  </>
                )}
              </Button>
              <Button
                onClick={() => setSummary('')}
                variant="outline"
                disabled={saving}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !summary && (
        <Card>
          <CardHeader>
            <CardTitle>Đang xử lý PDF...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

