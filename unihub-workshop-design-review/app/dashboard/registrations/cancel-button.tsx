'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cancelRegistration } from '@/lib/actions/registrations'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'

interface CancelRegistrationButtonProps {
  registrationId: string
}

export function CancelRegistrationButton({ registrationId }: CancelRegistrationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleCancel = async () => {
    setIsLoading(true)
    try {
      const result = await cancelRegistration(registrationId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message || 'Đã hủy đăng ký')
      setOpen(false)
    } catch (error) {
      toast.error('Có lỗi xảy ra')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <X className="mr-2 h-4 w-4" />
          Hủy
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận hủy đăng ký?</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn hủy đăng ký workshop này? 
            Hành động này không thể hoàn tác và bạn có thể mất chỗ nếu workshop đã đầy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Không, giữ lại</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang hủy...
              </>
            ) : (
              'Xác nhận hủy'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
