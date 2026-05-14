'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { generateAISummary } from '@/lib/actions/ai-summary'
import { Loader2, Sparkles } from 'lucide-react'

export default function AISummaryPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [stats, setStats] = useState<any>(null)

  const handleGenerateSummary = async () => {
    setLoading(true)
    setSummary('')
    setStats(null)
    
    try {
      const result = await generateAISummary(period)
      setSummary(result.summary || '')
      setStats(result.stats)
    } catch (error) {
      setSummary('Lỗi khi tạo tóm tắt. Vui lòng thử lại.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Summary</h1>
        <p className="text-muted-foreground mt-1">
          Tóm tắt thông tin hệ thống bằng AI
        </p>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn kỳ thống kê</CardTitle>
          <CardDescription>
            Chọn khoảng thời gian để tạo tóm tắt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['week', 'month', 'all'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                onClick={() => setPeriod(p)}
                disabled={loading}
              >
                {p === 'week' ? 'Tuần này' : p === 'month' ? 'Tháng này' : 'Toàn bộ'}
              </Button>
            ))}
          </div>

          <Button 
            onClick={handleGenerateSummary}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo tóm tắt...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Tạo tóm tắt AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tổng Workshops</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkshops}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tổng Đăng ký</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.confirmedRegistrations} xác nhận
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Check-in</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCheckIns}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.attendanceRate}% tham dự
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Doanh thu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.totalRevenue / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalRevenue.toLocaleString()} VND
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tổng Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <CardTitle>AI Tóm tắt</CardTitle>
              <Badge variant="secondary">Powered by AI</Badge>
            </div>
            <CardDescription>
              Phân tích chi tiết từ AI dựa trên dữ liệu hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {summary}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !summary && (
        <Card>
          <CardHeader>
            <CardTitle>Đang tạo tóm tắt...</CardTitle>
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
