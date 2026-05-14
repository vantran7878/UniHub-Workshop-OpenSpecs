'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Workshop } from '@/lib/types/database'

export async function getWorkshops(options?: {
  published?: boolean
  upcoming?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('workshops')
    .select('*', { count: 'exact' })
    .order('start_time', { ascending: true })

  if (options?.published !== undefined) {
    query = query.eq('is_published', options.published)
  }

  if (options?.upcoming) {
    query = query.gte('start_time', new Date().toISOString())
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error, count } = await query

  if (error) {
    return { error: error.message, data: [], count: 0 }
  }

  return { data: data as Workshop[], count: count || 0 }
}

export async function getWorkshopById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: data as Workshop }
}

export async function createWorkshop(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Chưa đăng nhập' }
  }

  const workshopData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    speaker: formData.get('speaker') as string,
    speaker_bio: formData.get('speaker_bio') as string,
    room_id: formData.get('room_id') as string,
    room_name: formData.get('room_name') as string,
    capacity: parseInt(formData.get('capacity') as string),
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    registration_deadline: formData.get('registration_deadline') as string || null,
    fee: parseFloat(formData.get('fee') as string) || 0,
    is_published: formData.get('is_published') === 'true',
    thumbnail_url: formData.get('thumbnail_url') as string || null,
    materials_url: formData.get('materials_url') as string || null,
    pdf_url: formData.get('pdf_url') as string || null,
    created_by: user.id
  }

  const { data, error } = await supabase
    .from('workshops')
    .insert(workshopData)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/workshops')
  revalidatePath('/workshops')
  return { success: true, data }
}

export async function updateWorkshop(id: string, formData: FormData) {
  const supabase = await createClient()

  const workshopData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    speaker: formData.get('speaker') as string,
    speaker_bio: formData.get('speaker_bio') as string,
    room_id: formData.get('room_id') as string,
    room_name: formData.get('room_name') as string,
    capacity: parseInt(formData.get('capacity') as string),
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    registration_deadline: formData.get('registration_deadline') as string || null,
    fee: parseFloat(formData.get('fee') as string) || 0,
    is_published: formData.get('is_published') === 'true',
    thumbnail_url: formData.get('thumbnail_url') as string || null,
    materials_url: formData.get('materials_url') as string || null,
    pdf_url: formData.get('pdf_url') as string || null
  }

  const { error } = await supabase
    .from('workshops')
    .update(workshopData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/workshops')
  revalidatePath(`/workshops/${id}`)
  revalidatePath('/workshops')
  return { success: true }
}

export async function deleteWorkshop(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workshops')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/workshops')
  revalidatePath('/workshops')
  return { success: true }
}

export async function toggleWorkshopPublished(id: string, isPublished: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workshops')
    .update({ is_published: isPublished })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/workshops')
  revalidatePath('/workshops')
  return { success: true }
}
