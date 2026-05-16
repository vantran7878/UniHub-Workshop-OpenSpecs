'use client'

import { useState } from 'react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateRegistrationStatus } from '@/lib/actions/registrations'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Props {
  registrationId: string
  currentStatus: 'pending' | 'confirmed' | 'cancelled'
}

export function RegistrationStatusUpdate({ registrationId, currentStatus }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleStatusUpdate = async (newStatus: 'pending' | 'confirmed' | 'cancelled') => {
    if (newStatus === currentStatus) return
    
    setLoading(true)
    try {
      const result = await updateRegistrationStatus(registrationId, newStatus)
      if (result.success) {
        toast.success(`Đã cập nhật trạng thái thành ${newStatus}`)
        router.refresh()
      } else {
        toast.error(result.error || 'Cập nhật thất bại')
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi cập nhật')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">Xác nhận</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-none">Chờ</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Đã hủy</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getStatusBadge(currentStatus)}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleStatusUpdate('pending')}>
          Đặt là Chờ
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusUpdate('confirmed')}>
          Xác nhận
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusUpdate('cancelled')} className="text-red-600">
          Hủy đăng ký
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
