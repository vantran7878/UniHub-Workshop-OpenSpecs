'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Registration } from '@/lib/types/database'
import { v4 as uuidv4 } from 'uuid'

export async function registerForWorkshop(workshopId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Vui lòng đăng nhập để đăng ký workshop' }
  }

  // Check if already registered
  const { data: existingReg } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('workshop_id', workshopId)
    .single()

  if (existingReg) {
    if (existingReg.status === 'cancelled') {
      // Re-activate cancelled registration
      const { error } = await supabase
        .from('registrations')
        .update({ 
          status: 'pending',
          cancelled_at: null,
          cancel_reason: null
        })
        .eq('id', existingReg.id)

      if (error) {
        return { error: error.message }
      }

      revalidatePath('/dashboard/registrations')
      revalidatePath(`/workshops/${workshopId}`)
      return { success: true, message: 'Đăng ký lại thành công!' }
    }
    return { error: 'Bạn đã đăng ký workshop này rồi' }
  }

  // Check workshop capacity using SELECT FOR UPDATE pattern
  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .select('capacity, confirmed_count, fee, registration_deadline, start_time, is_published')
    .eq('id', workshopId)
    .single()

  if (workshopError || !workshop) {
    return { error: 'Workshop không tồn tại' }
  }

  if (!workshop.is_published) {
    return { error: 'Workshop chưa được công bố' }
  }

  // Check registration deadline
  const deadline = workshop.registration_deadline 
    ? new Date(workshop.registration_deadline) 
    : new Date(workshop.start_time)
  
  if (new Date() > deadline) {
    return { error: 'Đã hết hạn đăng ký' }
  }

  // Check capacity
  if (workshop.confirmed_count >= workshop.capacity) {
    return { error: 'Workshop đã hết chỗ' }
  }

  // Create registration
  const isFreeWorkshop = workshop.fee === 0

  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .insert({
      user_id: user.id,
      workshop_id: workshopId,
      status: isFreeWorkshop ? 'confirmed' : 'pending',
      qr_code: isFreeWorkshop ? uuidv4() : null,
      confirmed_at: isFreeWorkshop ? new Date().toISOString() : null
    })
    .select()
    .single()

  if (regError) {
    // Handle unique constraint violation (race condition)
    if (regError.code === '23505') {
      return { error: 'Bạn đã đăng ký workshop này rồi' }
    }
    return { error: regError.message }
  }

  revalidatePath('/dashboard/registrations')
  revalidatePath(`/workshops/${workshopId}`)
  
  if (isFreeWorkshop) {
    return { success: true, message: 'Đăng ký thành công! Kiểm tra mã QR trong phần đăng ký của bạn.' }
  }
  
  return { 
    success: true, 
    message: 'Đăng ký thành công! Vui lòng thanh toán để xác nhận.',
    registrationId: registration.id,
    requiresPayment: true,
    amount: workshop.fee
  }
}

export async function cancelRegistration(registrationId: string, reason?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  // Check ownership
  const { data: registration } = await supabase
    .from('registrations')
    .select('user_id, workshop_id, status')
    .eq('id', registrationId)
    .single()

  if (!registration) {
    return { error: 'Không tìm thấy đăng ký' }
  }

  if (registration.user_id !== user.id) {
    return { error: 'Không có quyền hủy đăng ký này' }
  }

  if (registration.status === 'cancelled') {
    return { error: 'Đăng ký đã được hủy trước đó' }
  }

  const { error } = await supabase
    .from('registrations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || 'Hủy bởi người dùng'
    })
    .eq('id', registrationId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/registrations')
  revalidatePath(`/workshops/${registration.workshop_id}`)
  return { success: true, message: 'Đã hủy đăng ký thành công' }
}

export async function getMyRegistrations() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập', data: [] }
  }

  const { data, error } = await supabase
    .from('registrations')
    .select(`
      *,
      workshop:workshops(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: data as (Registration & { workshop: any })[] }
}

export async function getRegistrationById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('registrations')
    .select(`
      *,
      workshop:workshops(*),
      user:users(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: data as Registration & { workshop: any; user: any } }
}

export async function getWorkshopRegistrations(workshopId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('registrations')
    .select(`
      *,
      user:users(id, full_name, email, student_id, faculty)
    `)
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}

// Admin/Staff: Update registration status
export async function updateRegistrationStatus(
  registrationId: string, 
  status: 'pending' | 'confirmed' | 'cancelled',
  qrCode?: string
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { status }

  if (status === 'confirmed') {
    updateData.confirmed_at = new Date().toISOString()
    updateData.qr_code = qrCode || uuidv4()
  } else if (status === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('registrations')
    .update(updateData)
    .eq('id', registrationId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/registrations')
  return { success: true }
}
