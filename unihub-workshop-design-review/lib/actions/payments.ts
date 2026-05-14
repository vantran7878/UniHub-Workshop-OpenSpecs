'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'

export async function processPayment(
  registrationId: string,
  amount: number,
  idempotencyKey: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  // Check idempotency - if payment with this key exists, return existing result
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (existingPayment) {
    if (existingPayment.status === 'success') {
      return { success: true, message: 'Thanh toán đã được xử lý trước đó', payment: existingPayment }
    } else if (existingPayment.status === 'pending') {
      return { pending: true, message: 'Thanh toán đang được xử lý' }
    }
    // If failed, allow retry with new idempotency key
  }

  // Verify registration exists and belongs to user
  const { data: registration } = await supabase
    .from('registrations')
    .select('*, workshop:workshops(fee)')
    .eq('id', registrationId)
    .eq('user_id', user.id)
    .single()

  if (!registration) {
    return { error: 'Không tìm thấy đăng ký' }
  }

  if (registration.status === 'confirmed') {
    return { error: 'Đăng ký đã được xác nhận' }
  }

  if (registration.status === 'cancelled') {
    return { error: 'Đăng ký đã bị hủy' }
  }

  // Create pending payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      registration_id: registrationId,
      amount,
      status: 'pending',
      idempotency_key: idempotencyKey
    })
    .select()
    .single()

  if (paymentError) {
    // Unique constraint violation - payment already exists
    if (paymentError.code === '23505') {
      return { error: 'Yêu cầu thanh toán trùng lặp' }
    }
    return { error: paymentError.message }
  }

  // Simulate payment gateway call
  // In production, this would call actual payment gateway (VNPay, Momo, etc.)
  try {
    const gatewayResult = await simulatePaymentGateway(amount)

    if (gatewayResult.success) {
      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: 'success',
          gateway_transaction_id: gatewayResult.transactionId,
          gateway_response: gatewayResult,
          paid_at: new Date().toISOString()
        })
        .eq('id', payment.id)

      // Update registration status and generate QR code
      const qrCode = uuidv4()
      await supabase
        .from('registrations')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          qr_code: qrCode
        })
        .eq('id', registrationId)

      revalidatePath('/dashboard/registrations')
      return { 
        success: true, 
        message: 'Thanh toán thành công!',
        qrCode 
      }
    } else {
      // Update payment as failed
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          gateway_response: gatewayResult
        })
        .eq('id', payment.id)

      return { error: gatewayResult.error || 'Thanh toán thất bại' }
    }
  } catch (error) {
    // Payment timeout - keep as pending for reconciliation
    // Worker will reconcile later
    return { 
      pending: true, 
      message: 'Đăng ký ghi nhận, thanh toán đang xử lý. Vui lòng kiểm tra lại sau.' 
    }
  }
}

// Simulate payment gateway (replace with actual gateway integration)
async function simulatePaymentGateway(amount: number): Promise<{
  success: boolean
  transactionId?: string
  error?: string
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Simulate 95% success rate
  const isSuccess = Math.random() > 0.05
  
  if (isSuccess) {
    return {
      success: true,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }
  
  return {
    success: false,
    error: 'Giao dịch bị từ chối bởi ngân hàng'
  }
}

export async function getPaymentHistory() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập', data: [] }
  }

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      registration:registrations(
        *,
        workshop:workshops(title)
      )
    `)
    .eq('registration.user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data }
}
