'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { PaymentCircuitBreaker } from '@/lib/payments/PaymentCircuitBreaker'
import RabbitMQProvider from '@/lib/rabbitmq/RabbitMQProvider'

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

  // Check idempotency
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
  }

  // Verify registration
  const { data: registration } = await supabase
    .from('registrations')
    .select('*, workshop:workshops(fee)')
    .eq('id', registrationId)
    .eq('user_id', user.id)
    .single()

  if (!registration) {
    return { error: 'Không tìm thấy đăng ký' }
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
    return { error: paymentError.message }
  }

  // Wrap gateway call with Circuit Breaker
  const breaker = PaymentCircuitBreaker.getBreaker(simulatePaymentGateway);
  
  try {
    const gatewayResult = await breaker.fire(amount);

    if (gatewayResult.success) {
      await supabase
        .from('payments')
        .update({
          status: 'success',
          gateway_transaction_id: gatewayResult.transactionId,
          gateway_response: gatewayResult,
          paid_at: new Date().toISOString()
        })
        .eq('id', payment.id)

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
      return { success: true, message: 'Thanh toán thành công!', qrCode }
    } else {
      await supabase
        .from('payments')
        .update({ status: 'failed', gateway_response: gatewayResult })
        .eq('id', payment.id)

      return { error: gatewayResult.error || 'Thanh toán thất bại' }
    }
  } catch (error: any) {
    if (error.name === 'CircuitBreakerOpenException' || error.message?.includes('open')) {
      console.warn(`[Payment] Circuit Breaker active for ${registrationId}`);
      
      await supabase
        .from('registrations')
        .update({ status: 'deferred_payment' })
        .eq('id', registrationId);

      // Push reminder job to RabbitMQ
      try {
        const rabbit = RabbitMQProvider.getInstance();
        const channel = await rabbit.getChannel();
        const message = {
          type: 'payment_reminder',
          payload: {
            registrationId,
            studentEmail: user.email,
            amount,
            workshopTitle: registration.workshop.title
          }
        };
        await channel.assertExchange('unihub_events', 'direct', { durable: true });
        channel.publish('unihub_events', 'email_job', Buffer.from(JSON.stringify(message)), {
          persistent: true
        });
      } catch (rabbitErr) {
        console.error('[RabbitMQ] Failed to push deferred payment reminder:', rabbitErr);
      }

      return { 
        deferred: true, 
        message: 'Hệ thống thanh toán đang bảo trì. Đăng ký của bạn đã được ghi nhận, vui lòng quay lại thanh toán sau.' 
      }
    }

    return { 
      pending: true, 
      message: 'Kết nối cổng thanh toán gián đoạn. Chúng tôi sẽ tự động đối soát sau.' 
    }
  }
}

async function simulatePaymentGateway(amount: number): Promise<{
  success: boolean
  transactionId?: string
  error?: string
}> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  const isSuccess = Math.random() > 0.05
  if (isSuccess) {
    return {
      success: true,
      transactionId: `TXN_${Date.now()}`
    }
  }
  return {
    success: false,
    error: 'Giao dịch bị từ chối'
  }
}

export async function getPaymentHistory() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Chưa đăng nhập', data: [] }

  const { data, error } = await supabase
    .from('payments')
    .select('*, registration:registrations(*, workshop:workshops(title))')
    .eq('registration.user_id', user.id)
    .order('created_at', { ascending: false })

  return { data: data || [], error: error?.message }
}
