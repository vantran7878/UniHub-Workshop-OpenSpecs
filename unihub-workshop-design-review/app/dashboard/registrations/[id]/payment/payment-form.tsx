'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { processPayment } from '@/lib/actions/payments'
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils'
import { toast } from 'sonner'
import { CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface PaymentFormProps {
  registrationId: string
  userId: string
  workshopId: string
  workshopTitle: string
  amount: number
}

export function PaymentForm({ 
  registrationId, 
  userId, 
  workshopId, 
  workshopTitle, 
  amount 
}: PaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handlePayment = async () => {
    setIsLoading(true)
    setStatus('processing')
    
    const idempotencyKey = generateIdempotencyKey(userId, workshopId)
    
    try {
      const result = await processPayment(registrationId, amount, idempotencyKey)
      
      if (result.error) {
        setStatus('error')
        setMessage(result.error)
        toast.error(result.error)
        return
      }

      if (result.pending) {
        setStatus('processing')
        setMessage(result.message || 'Đang xử lý thanh toán...')
        toast.info(result.message)
        return
      }

      if (result.success) {
        setStatus('success')
        setMessage(result.message || 'Thanh toán thành công!')
        toast.success(result.message)
        
        // Redirect after success
        setTimeout(() => {
          window.location.href = `/dashboard/registrations/${registrationId}`
        }, 2000)
      }
    } catch (error) {
      setStatus('error')
      setMessage('Có lỗi xảy ra. Vui lòng thử lại.')
      toast.error('Có lỗi xảy ra')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'success') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Thanh toán thành công!</h2>
          <p className="text-muted-foreground mb-4">{message}</p>
          <p className="text-sm text-muted-foreground">
            Đang chuyển hướng đến trang đăng ký...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thanh toán</CardTitle>
        <CardDescription>
          Hoàn tất thanh toán để xác nhận đăng ký workshop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-muted">
          <p className="font-medium">{workshopTitle}</p>
          <p className="text-2xl font-bold text-primary mt-2">
            {formatCurrency(amount)}
          </p>
        </div>

        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Phương thức thanh toán:</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-16 flex-col" disabled>
              <CreditCard className="h-6 w-6 mb-1" />
              <span className="text-xs">Thẻ ngân hàng</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col border-primary" disabled>
              <span className="text-lg font-bold mb-1">VNPAY</span>
              <span className="text-xs">QR Code</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col" disabled>
              <span className="text-lg font-bold mb-1 text-pink-500">MoMo</span>
              <span className="text-xs">Ví điện tử</span>
            </Button>
          </div>
          <p className="text-xs">* Demo: Thanh toán sẽ được xử lý tự động</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handlePayment} 
          disabled={isLoading} 
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Thanh toán {formatCurrency(amount)}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
