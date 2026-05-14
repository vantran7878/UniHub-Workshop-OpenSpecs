'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { registerForWorkshop } from '@/lib/actions/registrations'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface RegisterButtonProps {
  workshopId: string
  fee: number
}

export function RegisterButton({ workshopId, fee }: RegisterButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async () => {
    setIsLoading(true)
    try {
      const result = await registerForWorkshop(workshopId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.success) {
        toast.success(result.message)
        
        // If requires payment, redirect to payment page
        if (result.requiresPayment && result.registrationId) {
          window.location.href = `/dashboard/registrations/${result.registrationId}/payment`
        } else {
          // Free workshop - redirect to registrations
          window.location.href = '/dashboard/registrations'
        }
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleRegister} 
      disabled={isLoading} 
      className="w-full"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang xử lý...
        </>
      ) : fee > 0 ? (
        `Đăng ký - ${formatCurrency(fee)}`
      ) : (
        'Đăng ký miễn phí'
      )}
    </Button>
  )
}
