'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { importStudents } from '@/lib/actions/import-students'
import { Loader2, Upload, CheckCircle, AlertCircle, Download } from 'lucide-react'

export default function ImportStudentsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const text = await file.text()
      const res = await importStudents(text)

      if ('error' in res) {
        setError(res.error)
      } else {
        setResult(res)
      }
    } catch (err) {
      setError(`Lỗi: ${String(err).slice(0, 100)}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = `email,full_name
student1@example.com,Nguyễn Văn A
student2@example.com,Trần Thị B
student3@example.com,Phạm Minh C
student4@example.com,Hoàng Thị D`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Sinh viên</h1>
        <p className="text-muted-foreground mt-1">
          Nhập danh sách sinh viên từ file CSV
        </p>
      </div>

      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle>Tải template</CardTitle>
          <CardDescription>
            Tải file CSV mẫu để biết cách định dạng đúng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Tải template CSV
          </Button>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload file CSV</CardTitle>
          <CardDescription>
            File phải có cột: email, full_name
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {loading ? 'Đang xử lý...' : 'Chọn file CSV'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                hoặc kéo thả file vào đây
              </span>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Đang nhập sinh viên...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Result */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle>Nhập thành công</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Tổng cộng</div>
                <div className="text-2xl font-bold">{result.totalCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Thành công</div>
                <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Lỗi</div>
                <div className="text-2xl font-bold text-red-600">{result.errorCount}</div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Chi tiết lỗi:</div>
                <div className="bg-muted p-3 rounded text-sm space-y-1">
                  {result.errors.map((err: string, i: number) => (
                    <div key={i} className="text-muted-foreground">{err}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Hướng dẫn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Tải file template CSV từ trên</p>
          <p>2. Điền thông tin sinh viên (email, full_name)</p>
          <p>3. Lưu file dưới dạng CSV</p>
          <p>4. Upload file lên hệ thống</p>
          <p className="text-muted-foreground mt-4">
            ℹ️ Mỗi sinh viên sẽ nhận được password ngẫu nhiên và có thể thay đổi sau khi đăng nhập lần đầu
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
