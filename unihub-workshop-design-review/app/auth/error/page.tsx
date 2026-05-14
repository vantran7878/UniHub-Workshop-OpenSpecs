'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  const getErrorMessage = () => {
    if (errorCode === 'otp_expired') {
      return 'Link xác thực đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực.'
    }
    if (error === 'access_denied') {
      return 'Truy cập bị từ chối. Vui lòng thử lại.'
    }
    return errorDescription || 'Đã xảy ra lỗi trong quá trình xác thực.'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Lỗi Xác thực</CardTitle>
          <CardDescription>{getErrorMessage()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild className="w-full">
            <Link href="/auth/login">Quay lại Đăng nhập</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Về Trang chủ</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
