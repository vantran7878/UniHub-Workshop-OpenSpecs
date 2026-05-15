'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Registration } from '@/lib/types/database'
import { v4 as uuidv4 } from 'uuid'
import { generateAndUploadQRCode } from '@/lib/actions/qr-code'
import { createNotification } from '@/lib/actions/notifications'
import { DistributedLock } from '@/lib/redis/DistributedLock'
import RabbitMQProvider from '@/lib/rabbitmq/RabbitMQProvider'

export async function registerForWorkshop(workshopId: string) {
  const resource = `workshop:${workshopId}:registration`
  const lockToken = await DistributedLock.acquire(resource, 5000)

  if (!lockToken) {
    return { error: 'Hệ thống đang bận xử lý đăng ký cho workshop này. Vui lòng thử lại sau giây lát.' }
  }

  try {
    const supabase = await createClient()
// ...
    const { data: { user } } = await supabase.auth.getUser()
// ...
    if (!user) {
      return { error: 'Vui lòng đăng nhập để đăng ký workshop' }
    }

    // Check if already registered
// ...
    const { data: existingReg } = await supabase
// ...
      .from('registrations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('workshop_id', workshopId)
      .single()

    if (existingReg) {
// ...
      if (existingReg.status === 'cancelled') {
        // Check workshop info for re-registration
        const { data: workshop } = await supabase
          .from('workshops')
          .select('fee, capacity, confirmed_count, is_published, start_time, registration_deadline')
          .eq('id', workshopId)
          .single()

        if (!workshop || !workshop.is_published) {
          return { error: 'Workshop không khả dụng' }
        }

        // Check deadline
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

        const isFreeWorkshop = workshop.fee === 0
        
        // Re-activate cancelled registration
        const { error } = await supabase
          .from('registrations')
          .update({ 
            status: isFreeWorkshop ? 'confirmed' : 'pending',
            cancelled_at: null,
            cancel_reason: null,
            qr_code: isFreeWorkshop ? uuidv4() : null,
            confirmed_at: isFreeWorkshop ? new Date().toISOString() : null
          })
          .eq('id', existingReg.id)

        if (error) {
          return { error: error.message }
        }

        revalidatePath('/dashboard/registrations')
        revalidatePath(`/workshops/${workshopId}`)
        
        if (isFreeWorkshop) {
          return { success: true, message: 'Đăng ký lại thành công! Kiểm tra email để xem mã QR.' }
        }
        return { success: true, message: 'Đăng ký lại thành công! Vui lòng thanh toán để xác nhận.' }
      }
      return { error: 'Bạn đã đăng ký workshop này rồi' }
    }

    // Check workshop capacity
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
// ...

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
    // Send confirmation email with QR code
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', user.id)
        .single()

      const { data: workshopData } = await supabase
        .from('workshops')
        .select('title, start_time, room_name')
        .eq('id', workshopId)
        .single()

      if (userData && workshopData && registration.qr_code) {
        // Generate and upload QR code to Supabase Storage
        const qrResult = await generateAndUploadQRCode(registration.id, registration.qr_code)
        
        const startTime = new Date(workshopData.start_time)
        const workshopDate = startTime.toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const workshopTime = startTime.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        })

        // Send email with QR code URL via RabbitMQ
        if (qrResult.url) {
          const rabbit = RabbitMQProvider.getInstance();
          const channel = await rabbit.getChannel();
          
          const message = {
            type: 'registration_confirmation',
            payload: {
              studentEmail: userData.email,
              studentName: userData.full_name,
              workshopTitle: workshopData.title,
              workshopDate,
              workshopTime,
              roomName: workshopData.room_name || 'TBD',
              qrCodeDataUrl: qrResult.url
            }
          };

          await channel.assertExchange('unihub_events', 'direct', { durable: true });
          channel.publish('unihub_events', 'email_job', Buffer.from(JSON.stringify(message)), {
            persistent: true
          });

          console.log('[Registration] Email job pushed to RabbitMQ');
        }

        // Create notification
        await createNotification({
          userId: user.id,
          type: 'registration',
          title: 'Dang ky thanh cong',
          message: `Ban da dang ky thanh cong workshop "${workshopData.title}". Ma QR check-in da duoc gui qua email.`,
          channel: 'in_app',
          metadata: {
            workshop_id: workshopId,
            registration_id: registration.id,
            workshop_title: workshopData.title,
          }
        })
      }
    } catch (emailError) {
      console.error('[Registration Email Error]', emailError)
      // Don't fail registration if email fails
    }

    return { success: true, message: 'Dang ky thanh cong! Kiem tra email de xem ma QR check-in.' }
  } finally {
    await DistributedLock.release(resource, lockToken)
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

  // Create cancellation notification
  try {
    const { data: workshopData } = await supabase
      .from('workshops')
      .select('title')
      .eq('id', registration.workshop_id)
      .single()

      if (workshopData) {
        // Push cancellation email job to RabbitMQ
        try {
          const rabbit = RabbitMQProvider.getInstance();
          const channel = await rabbit.getChannel();
          
          const message = {
            type: 'cancellation_confirmation',
            payload: {
              studentEmail: user.email,
              workshopTitle: workshopData.title,
              cancelReason: reason || 'Hủy bởi người dùng'
            }
          };

          await channel.assertExchange('unihub_events', 'direct', { durable: true });
          channel.publish('unihub_events', 'email_job', Buffer.from(JSON.stringify(message)), {
            persistent: true
          });
          console.log('[Cancellation] Email job pushed to RabbitMQ');
        } catch (rabbitErr) {
          console.error('[RabbitMQ Push Error] Cancellation:', rabbitErr);
        }

        await createNotification({
        userId: user.id,
        type: 'cancellation',
        title: 'Da huy dang ky',
        message: `Ban da huy dang ky workshop "${workshopData.title}".`,
        channel: 'in_app',
        metadata: {
          workshop_id: registration.workshop_id,
          registration_id: registrationId,
          workshop_title: workshopData.title,
        }
      })
    }
  } catch (notifError) {
    console.error('[Cancellation Notification Error]', notifError)
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

  // Fetch registration data for email
  const { data: registration } = await supabase
    .from('registrations')
    .select('user_id, workshop_id, qr_code')
    .eq('id', registrationId)
    .single()

  if (!registration) {
    return { error: 'Khong tim thay dang ky' }
  }

  const updateData: Record<string, unknown> = { status }
  const finalQrCode = qrCode || registration.qr_code || uuidv4()

  if (status === 'confirmed') {
    updateData.confirmed_at = new Date().toISOString()
    updateData.qr_code = finalQrCode
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

  // Send email when confirmed
  if (status === 'confirmed') {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', registration.user_id)
        .single()

      const { data: workshopData } = await supabase
        .from('workshops')
        .select('title, start_time, room_name')
        .eq('id', registration.workshop_id)
        .single()

      if (userData && workshopData) {
        // Generate and upload QR code to Supabase Storage
        const qrResult = await generateAndUploadQRCode(registrationId, finalQrCode)

        const startTime = new Date(workshopData.start_time)
        const workshopDate = startTime.toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const workshopTime = startTime.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        })

        // Send email with QR code URL
        if (qrResult.url) {
          await sendRegistrationConfirmationEmail({
            studentEmail: userData.email,
            studentName: userData.full_name,
            workshopTitle: workshopData.title,
            workshopDate,
            workshopTime,
            roomName: workshopData.room_name || 'TBD',
            qrCodeDataUrl: qrResult.url
          })
        }

        // Create notification
        await createNotification({
          userId: registration.user_id,
          type: 'registration',
          title: 'Dang ky da duoc xac nhan',
          message: `Dang ky workshop "${workshopData.title}" da duoc xac nhan. Ma QR check-in da duoc gui qua email.`,
          channel: 'in_app',
          metadata: {
            workshop_id: registration.workshop_id,
            registration_id: registrationId,
            workshop_title: workshopData.title,
          }
        })
      }
    } catch (emailError) {
      console.error('[Admin Confirmation Email Error]', emailError)
    }
  }

  revalidatePath('/admin/registrations')
  revalidatePath('/admin/workshops')
  return { success: true }
}
