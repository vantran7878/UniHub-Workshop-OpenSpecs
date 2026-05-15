'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { RateLimiterService } from '@/lib/redis/RateLimiterService'

export async function signUp(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || 'unknown'
  
  const { allowed, retryAfter } = await RateLimiterService.checkLimit(`auth:signup:${ip}`, 5, 0.00001) // 5 requests per 5.5 mins roughly
  if (!allowed) {
    return { error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${Math.ceil(retryAfter / 1000)} giây.` }
  }

  const supabase = await createClient()
// ... (rest of the function)
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const studentId = formData.get('student_id') as string
  const phone = formData.get('phone') as string
  const faculty = formData.get('faculty') as string

  const { error } = await supabase.auth.signUp({
// ...
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      data: {
        full_name: fullName,
        student_id: studentId,
        phone,
        faculty,
        role: 'student'
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Vui lòng kiểm tra email để xác nhận tài khoản!' }
}

export async function signIn(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || 'unknown'
  
  const { allowed, retryAfter } = await RateLimiterService.checkLimit(`auth:signin:${ip}`, 5, 0.00001)
  if (!allowed) {
    return { error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${Math.ceil(retryAfter / 1000)} giây.` }
  }

  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return null
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  const fullName = formData.get('full_name') as string
  const phone = formData.get('phone') as string
  const faculty = formData.get('faculty') as string
  const notificationChannels = formData.getAll('notification_channels') as string[]

  const { error } = await supabase
    .from('users')
    .update({
      full_name: fullName,
      phone,
      faculty,
      notification_channels: notificationChannels
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/profile')
  return { success: true, message: 'Cập nhật thành công!' }
}
