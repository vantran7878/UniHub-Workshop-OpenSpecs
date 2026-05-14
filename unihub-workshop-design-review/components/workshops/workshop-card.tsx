import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, Users } from 'lucide-react'
import { formatDate, formatTime, formatCurrency, getAvailableSeats, isWorkshopFull, getTimeRemaining } from '@/lib/utils'
import type { Workshop } from '@/lib/types/database'

interface WorkshopCardProps {
  workshop: Workshop
  showActions?: boolean
}

export function WorkshopCard({ workshop, showActions = true }: WorkshopCardProps) {
  const availableSeats = getAvailableSeats(workshop)
  const isFull = isWorkshopFull(workshop)
  const timeRemaining = getTimeRemaining(workshop.start_time)
  const isPast = new Date(workshop.start_time) < new Date()

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow overflow-hidden">
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {workshop.thumbnail_url ? (
          <img
            src={workshop.thumbnail_url}
            alt={workshop.title}
            className="w-full h-full object-cover transition-transform hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Calendar className="h-12 w-12 text-primary/40" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2 flex-none">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2 text-balance">{workshop.title}</h3>
          {isFull && !isPast && (
            <Badge variant="destructive" className="shrink-0">Hết chỗ</Badge>
          )}
          {isPast && (
            <Badge variant="secondary" className="shrink-0">Đã kết thúc</Badge>
          )}
        </div>
        {workshop.speaker && (
          <p className="text-sm text-muted-foreground">Diễn giả: {workshop.speaker}</p>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 space-y-3 pt-0">
        {workshop.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {workshop.description}
          </p>
        )}
        
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{formatDate(workshop.start_time)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{formatTime(workshop.start_time)} - {formatTime(workshop.end_time)}</span>
          </div>
          {workshop.room_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{workshop.room_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            <span>{availableSeats}/{workshop.capacity} chỗ trống</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="font-semibold text-primary">
            {workshop.fee > 0 ? formatCurrency(workshop.fee) : 'Miễn phí'}
          </span>
          {!isPast && (
            <span className="text-xs text-muted-foreground">{timeRemaining}</span>
          )}
        </div>
      </CardContent>

      {showActions && (
        <CardFooter className="pt-0">
          <Button asChild className="w-full" variant={isFull || isPast ? 'secondary' : 'default'}>
            <Link href={`/workshops/${workshop.id}`}>
              {isPast ? 'Xem chi tiết' : isFull ? 'Xem thông tin' : 'Đăng ký ngay'}
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
