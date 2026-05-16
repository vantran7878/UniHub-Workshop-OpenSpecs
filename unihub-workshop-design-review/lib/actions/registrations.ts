'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Registration } from '@/lib/types/database'
import { v4 as uuidv4 } from 'uuid'
import { generateAndUploadQRCode, getOrCreateQRCodeUrl } from '@/lib/actions/qr-code'
import { createNotification } from '@/lib/actions/notifications'
import { DistributedLock } from '@/lib/redis/DistributedLock'
import RabbitMQProvider from '@/lib/rabbitmq/RabbitMQProvider'
import { sendRegistrationConfirmationEmail } from '@/lib/email/send-email'
import { generateQRCodeBuffer } from '@/lib/utils/qr-buffer'

export async function registerForWorkshop(workshopId: string) {
  console.log('[registerForWorkshop] ====== CALLED with workshopId:', workshopId)
  const resource = `workshop:${workshopId}:registration`
  const lockToken = await DistributedLock.acquire(resource, 5000)

  if (!lockToken) {
    console.log('[registerForWorkshop] ❌ EARLY RETURN: lock failed')
    return { error: 'Hệ thống đang bận xử lý đăng ký cho workshop này. Vui lòng thử lại sau giây lát.' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('[registerForWorkshop] ❌ EARLY RETURN: no user')
      return { error: 'Vui lòng đăng nhập để đăng ký workshop' }
    }

    const { data: existingReg } = await supabase
      .from('registrations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('workshop_id', workshopId)
      .single()

    console.log('[registerForWorkshop] existingReg:', existingReg ? `id=${existingReg.id} status=${existingReg.status}` : 'NULL (new registration)')

    if (existingReg) {
      if (existingReg.status === 'cancelled') {
        console.log('[registerForWorkshop] Re-registering from cancelled state...')
        const { data: workshop } = await supabase
          .from('workshops')
          .select('fee, capacity, confirmed_count, is_published, start_time, registration_deadline')
          .eq('id', workshopId)
          .single()

        if (!workshop || !workshop.is_published) {
          return { error: 'Workshop không khả dụng' }
        }

        const deadline = workshop.registration_deadline
          ? new Date(workshop.registration_deadline)
          : new Date(workshop.start_time)
        if (new Date() > deadline) {
          return { error: 'Đã hết hạn đăng ký' }
        }

        if (workshop.confirmed_count >= workshop.capacity) {
          return { error: 'Workshop đã hết chỗ' }
        }

        const isFreeWorkshop = workshop.fee === 0

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

        console.log('[registerForWorkshop] ❌ EARLY RETURN: re-registration path (no email push here!)')
        if (isFreeWorkshop) {
          return { success: true, message: 'Đăng ký lại thành công! Kiểm tra email để xem mã QR.' }
        }
        return { success: true, message: 'Đăng ký lại thành công! Vui lòng thanh toán để xác nhận.' }
      }
      console.log('[registerForWorkshop] ❌ EARLY RETURN: already registered')
      return { error: 'Bạn đã đăng ký workshop này rồi' }
    }

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

    const deadline = workshop.registration_deadline
      ? new Date(workshop.registration_deadline)
      : new Date(workshop.start_time)

    if (new Date() > deadline) {
      return { error: 'Đã hết hạn đăng ký' }
    }

    if (workshop.confirmed_count >= workshop.capacity) {
      return { error: 'Workshop đã hết chỗ' }
    }

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
      if (regError.code === '23505') {
        return { error: 'Bạn đã đăng ký workshop này rồi' }
      }
      return { error: regError.message }
    }

    revalidatePath('/dashboard/registrations')
    revalidatePath(`/workshops/${workshopId}`)

    console.log('[Registration] isFreeWorkshop:', isFreeWorkshop, '| registration.qr_code:', registration.qr_code)

    if (isFreeWorkshop) {
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

        console.log('[Registration] userData:', userData ? 'OK' : 'NULL', '| workshopData:', workshopData ? 'OK' : 'NULL', '| qr_code:', registration.qr_code || 'NULL')

        if (userData && workshopData && registration.qr_code) {
          console.log('[Registration] Generating QR code URL and buffer...')
          const qrCodeUrl = await getOrCreateQRCodeUrl(registration.id, registration.qr_code)
          console.log('[Registration] qrCodeUrl:', qrCodeUrl || 'NULL')

          const qrBuffer = await generateQRCodeBuffer(registration.qr_code)
          console.log('[Registration] qrBuffer:', qrBuffer ? `${qrBuffer.length} bytes` : 'NULL')

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

          console.log('[Registration] Connecting to RabbitMQ...')
          const rabbit = RabbitMQProvider.getInstance();
          const channel = await rabbit.getChannel();
          console.log('[Registration] RabbitMQ channel obtained')

          const message = {
            type: 'registration_confirmation',
            payload: {
              studentEmail: userData.email,
              studentName: userData.full_name,
              workshopTitle: workshopData.title,
              workshopDate,
              workshopTime,
              roomName: workshopData.room_name || 'TBD',
              qrCodeDataUrl: qrCodeUrl,
              qrCodeBuffer: qrBuffer.toString('base64'),
            }
          };

          await channel.assertExchange('unihub_events', 'direct', { durable: true });
          channel.publish('unihub_events', 'email_job', Buffer.from(JSON.stringify(message)), {
            persistent: true
          });

          console.log('[Registration] ✅ Email job pushed to RabbitMQ for', userData.email);

          await createNotification({
            userId: user.id,
            type: 'registration',
            title: 'Dang ky thanh cong',
            message: `Ban da dang ky thanh cong workshop "${workshopData.title}". Ma QR check-in da duoc gui qua email.`,
            channel: 'app',
            metadata: {
              workshop_id: workshopId,
              registration_id: registration.id,
              workshop_title: workshopData.title,
            }
          })
        } else {
          console.warn('[Registration] ⚠️ Skipped email: missing userData, workshopData, or qr_code')
        }
      } catch (emailError) {
        console.error('[Registration Email Error] ❌ Failed to generate/push email:', emailError)
      }

      return { success: true, message: 'Dang ky thanh cong! Kiem tra email de xem ma QR check-in.' }
    }

    return {
      success: true,
      message: 'Đăng ký thành công! Vui lòng thanh toán để xác nhận.',
      registrationId: registration.id,
      requiresPayment: true,
      amount: workshop.fee
    }
  } finally {
    await DistributedLock.release(resource, lockToken)
  }
}

export async function cancelRegistration(registrationId: string, reason?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

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

  try {
    const { data: workshopData } = await supabase
      .from('workshops')
      .select('title')
      .eq('id', registration.workshop_id)
      .single()

    if (workshopData) {
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
        channel: 'app',
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

export async function updateRegistrationStatus(
  registrationId: string,
  status: 'pending' | 'confirmed' | 'cancelled',
  qrCode?: string
) {
  const supabase = await createClient()

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
        const qrCodeUrl = await getOrCreateQRCodeUrl(registrationId, finalQrCode)

        // Generate QR buffer for inline email attachment
        const qrBuffer = await generateQRCodeBuffer(finalQrCode)

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

        if (qrCodeUrl) {
          await sendRegistrationConfirmationEmail({
            studentEmail: userData.email,
            studentName: userData.full_name,
            workshopTitle: workshopData.title,
            workshopDate,
            workshopTime,
            roomName: workshopData.room_name || 'TBD',
            qrCodeDataUrl: qrCodeUrl,
            qrBuffer,
          })
        }

        await createNotification({
          userId: registration.user_id,
          type: 'registration',
          title: 'Dang ky da duoc xac nhan',
          message: `Dang ky workshop "${workshopData.title}" da duoc xac nhan. Ma QR check-in da duoc gui qua email.`,
          channel: 'app',
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

export async function getAllRegistrations({
  page = 1,
  limit = 10,
  search = '',
  status = '',
}: {
  page?: number
  limit?: number
  search?: string
  status?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('registrations')
    .select(`
      *,
      user:users(full_name, email, student_id),
      workshop:workshops(title)
    `, { count: 'exact' })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`, { foreignTable: 'users' })
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[getAllRegistrations] Error:', error)
    return { error: error.message, data: [], total: 0 }
  }

  return {
    data: data as (Registration & { user: any; workshop: any })[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  }
}