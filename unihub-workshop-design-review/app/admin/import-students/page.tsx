'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { uploadExternalSyncCSV, triggerSync } from '@/lib/actions/sync-students'
import { Loader2, Upload, CheckCircle, AlertCircle, Download, RefreshCw } from 'lucide-react'

export default function ImportStudentsPage() {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setSuccessMessage('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await uploadExternalSyncCSV(formData)

      if (!res.success) {
        setError(res.error || 'Lỗi không xác định')
      } else {
        setSuccessMessage(`File "${file.name}" đã được tải lên thành công. Hệ thống đang xử lý đồng bộ trong nền...`)
      }
    } catch (err) {
      setError(`Lỗi: ${String(err).slice(0, 100)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSync = async () => {
    setSyncing(true)
    setError('')
    try {
      const res = await triggerSync()
      if (res.success) {
        setSuccessMessage('Đã gửi yêu cầu đồng bộ. Vui lòng kiểm tra lại sau vài phút.')
      } else {
        setError('Không thể kích hoạt đồng bộ.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncing(false)
    }
  }

  const downloadTemplate = () => {
    const template = `email,full_name,student_id,phone,faculty,role
student1@example.com,Nguyễn Văn A,11223344,0123456789,CNTT,student
student2@example.com,Trần Thị B, 22334455, 0987654321, AT, student
student3@example.com,Phạm Minh C, 33445566, 0123456789, AT, student
student4@example.com,Hoàng Thị D, 44556677, 0987654321, CNTT, student`

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
            File phải có cột: email, full_name, student_id, faculty...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {loading ? 'Đang tải lên...' : 'Chọn file CSV để đồng bộ'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                File sẽ được đưa vào hàng đợi xử lý tự động
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

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Hoặc kích hoạt kiểm tra đồng bộ ngay lập tức
            </div>
            <Button
              variant="secondary"
              onClick={handleManualSync}
              disabled={syncing || loading}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Đồng bộ ngay
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Đang tải file lên storage...</span>
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

      {/* Success Alert */}
      {successMessage && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
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
