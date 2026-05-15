import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to Vietnamese locale
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  })
}

// Format time
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format date and time together
export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} - ${formatTime(date)}`
}

// Format currency to VND
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
}

// Generate idempotency key
export function generateIdempotencyKey(userId: string, workshopId: string): string {
  const timestamp = Date.now()
  return `${userId}-${workshopId}-${timestamp}`
}

// Check if workshop is full
export function isWorkshopFull(workshop: { capacity: number; confirmed_count: number }): boolean {
  return workshop.confirmed_count >= workshop.capacity
}

// Get available seats
export function getAvailableSeats(workshop: { capacity: number; confirmed_count: number }): number {
  return Math.max(0, workshop.capacity - workshop.confirmed_count)
}

// Check if registration deadline has passed
export function isRegistrationClosed(workshop: { registration_deadline: string | null; start_time: string }): boolean {
  const deadline = workshop.registration_deadline 
    ? new Date(workshop.registration_deadline) 
    : new Date(workshop.start_time)
  return new Date() > deadline
}

// Get status badge color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'pending':
    case 'deferred_payment':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'cancelled':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

// Get status text in Vietnamese
export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    cancelled: 'Đã hủy',
    deferred_payment: 'Chờ thanh toán (Hệ thống bảo trì)',
    success: 'Thành công',
    failed: 'Thất bại'
  }
  return statusMap[status] || status
}

// Get role text in Vietnamese
export function getRoleText(role: string): string {
  const roleMap: Record<string, string> = {
    student: 'Sinh viên',
    staff: 'Nhân viên',
    admin: 'Quản trị viên'
  }
  return roleMap[role] || role
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Calculate time remaining
export function getTimeRemaining(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  
  if (diff < 0) return 'Đã diễn ra'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (days > 0) return `Còn ${days} ngày`
  if (hours > 0) return `Còn ${hours} giờ`
  return 'Sắp diễn ra'
}
