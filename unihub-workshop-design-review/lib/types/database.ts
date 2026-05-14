// Database types for UniHub Workshop System

export type UserRole = 'student' | 'staff' | 'admin'
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled'
export type PaymentStatus = 'pending' | 'success' | 'failed'
export type CheckinMethod = 'qr_scan' | 'manual'
export type NotificationType = 'registration_confirmed' | 'payment_reminder' | 'workshop_reminder' | 'workshop_cancelled' | 'workshop_updated'
export type NotificationChannel = 'email' | 'push' | 'sms'

export interface User {
  id: string
  student_id: string | null
  full_name: string
  email: string
  phone: string | null
  faculty: string | null
  role: UserRole
  notification_channels: NotificationChannel[]
  created_at: string
  updated_at: string
}

export interface Workshop {
  id: string
  title: string
  description: string | null
  speaker: string | null
  speaker_bio: string | null
  room_id: string | null
  room_name: string | null
  capacity: number
  confirmed_count: number
  start_time: string
  end_time: string
  registration_deadline: string | null
  fee: number
  is_published: boolean
  thumbnail_url: string | null
  materials_url: string | null
  pdf_url: string | null
  ai_summary: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Registration {
  id: string
  user_id: string
  workshop_id: string
  status: RegistrationStatus
  qr_code: string | null
  registered_at: string
  confirmed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
  // Joined fields
  workshop?: Workshop
  user?: User
}

export interface Payment {
  id: string
  registration_id: string
  amount: number
  status: PaymentStatus
  idempotency_key: string
  gateway_transaction_id: string | null
  gateway_response: Record<string, unknown> | null
  paid_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  registration?: Registration
}

export interface Checkin {
  id: string
  registration_id: string
  checked_in_by: string | null
  method: CheckinMethod
  checked_in_at: string
  device_id: string | null
  is_offline_sync: boolean
  synced_at: string | null
  created_at: string
  // Joined fields
  registration?: Registration
  staff?: User
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  channel: NotificationChannel
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown> | null
  sent_at: string | null
  created_at: string
}

export interface WorkshopSummary {
  id: string
  workshop_id: string
  summary_text: string
  key_points: string[] | null
  generated_at: string
  model_version: string | null
  created_at: string
}

export interface StudentImportLog {
  id: string
  file_name: string
  file_hash: string
  total_records: number
  success_count: number
  error_count: number
  error_details: Record<string, unknown> | null
  imported_by: string | null
  imported_at: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Workshop with registration info for student view
export interface WorkshopWithRegistration extends Workshop {
  registration?: Registration | null
  available_seats: number
  is_registered: boolean
  is_full: boolean
}

// Statistics types
export interface WorkshopStatistics {
  total_registrations: number
  confirmed_registrations: number
  pending_registrations: number
  cancelled_registrations: number
  total_checkins: number
  attendance_rate: number
  revenue: number
}

export interface DashboardStatistics {
  total_workshops: number
  upcoming_workshops: number
  total_students: number
  total_registrations: number
  total_revenue: number
}
