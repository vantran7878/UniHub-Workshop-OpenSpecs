'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function checkInByQrCode(qrCode: string, deviceId?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  // Find registration by QR code
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .select(`
      *,
      workshop:workshops(id, title, start_time, end_time),
      user:users(id, full_name, student_id, email)
    `)
    .eq('qr_code', qrCode)
    .single()

  if (regError || !registration) {
    return { error: 'Mã QR không hợp lệ' }
  }

  if (registration.status !== 'confirmed') {
    return { error: 'Đăng ký chưa được xác nhận' }
  }

  // Check if already checked in
  const { data: existingCheckin } = await supabase
    .from('checkins')
    .select('id')
    .eq('registration_id', registration.id)
    .single()

  if (existingCheckin) {
    return { 
      error: 'Sinh viên này đã check-in trước đó',
      alreadyCheckedIn: true,
      registration
    }
  }

  // Create check-in record
  const { error: checkinError } = await supabase
    .from('checkins')
    .insert({
      registration_id: registration.id,
      checked_in_by: user.id,
      method: 'qr_scan',
      device_id: deviceId,
      is_offline_sync: false
    })

  if (checkinError) {
    // Handle unique constraint (race condition)
    if (checkinError.code === '23505') {
      return { error: 'Sinh viên này đã check-in' }
    }
    return { error: checkinError.message }
  }

  revalidatePath(`/admin/workshops/${registration.workshop_id}/checkins`)
  
  return { 
    success: true, 
    message: 'Check-in thành công!',
    registration
  }
}

export async function manualCheckIn(registrationId: string, deviceId?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  // Verify registration
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .select('*, workshop:workshops(id, title)')
    .eq('id', registrationId)
    .single()

  if (regError || !registration) {
    return { error: 'Không tìm thấy đăng ký' }
  }

  if (registration.status !== 'confirmed') {
    return { error: 'Đăng ký chưa được xác nhận' }
  }

  // Check if already checked in
  const { data: existingCheckin } = await supabase
    .from('checkins')
    .select('id')
    .eq('registration_id', registrationId)
    .single()

  if (existingCheckin) {
    return { error: 'Sinh viên này đã check-in trước đó' }
  }

  // Create check-in record
  const { error: checkinError } = await supabase
    .from('checkins')
    .insert({
      registration_id: registrationId,
      checked_in_by: user.id,
      method: 'manual',
      device_id: deviceId,
      is_offline_sync: false
    })

  if (checkinError) {
    if (checkinError.code === '23505') {
      return { error: 'Sinh viên này đã check-in' }
    }
    return { error: checkinError.message }
  }

  revalidatePath(`/admin/workshops/${registration.workshop_id}/checkins`)
  
  return { success: true, message: 'Check-in thành công!' }
}

// Sync offline check-ins from mobile app
export async function syncOfflineCheckins(checkins: Array<{
  registration_id: string
  checked_in_at: string
  device_id: string
}>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const checkin of checkins) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('checkins')
      .select('id')
      .eq('registration_id', checkin.registration_id)
      .single()

    if (existing) {
      results.failed++
      results.errors.push(`${checkin.registration_id}: Đã check-in trước đó`)
      continue
    }

    const { error } = await supabase
      .from('checkins')
      .insert({
        registration_id: checkin.registration_id,
        checked_in_by: user.id,
        method: 'qr_scan',
        checked_in_at: checkin.checked_in_at,
        device_id: checkin.device_id,
        is_offline_sync: true,
        synced_at: new Date().toISOString()
      })

    if (error) {
      results.failed++
      results.errors.push(`${checkin.registration_id}: ${error.message}`)
    } else {
      results.success++
    }
  }

  return { 
    success: true, 
    message: `Đồng bộ hoàn tất: ${results.success} thành công, ${results.failed} thất bại`,
    results 
  }
}

export async function getWorkshopCheckins(workshopId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('checkins')
    .select(`
      *,
      registration:registrations(
        *,
        user:users(id, full_name, student_id, email, faculty)
      ),
      staff:users!checkins_checked_in_by_fkey(id, full_name)
    `)
    .eq('registration.workshop_id', workshopId)
    .order('checked_in_at', { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}

// Get valid QR codes for a workshop (for offline preload)
export async function getValidQrCodesForWorkshop(workshopId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('registrations')
    .select('qr_code, user:users(full_name, student_id)')
    .eq('workshop_id', workshopId)
    .eq('status', 'confirmed')
    .not('qr_code', 'is', null)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}
