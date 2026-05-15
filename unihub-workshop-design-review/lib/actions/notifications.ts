'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type NotificationType = 'registration' | 'reminder' | 'checkin' | 'cancellation' | 'system'
export type NotificationChannel = 'in_app' | 'email' | 'push'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  channel?: NotificationChannel
  metadata?: Record<string, any>
}

export async function createNotification(params: CreateNotificationParams) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      channel: params.channel || 'in_app',
      is_read: false,
      metadata: params.metadata || {},
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[Notification Error]', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function getMyNotifications() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Chua dang nhap', data: [] }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Chua dang nhap' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function getUnreadNotificationCount() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { count: 0 }
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    return { count: 0 }
  }

  return { count: count || 0 }
}
