'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function importStudents(csvData: string) {
  try {
    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return { error: 'CSV phải có ít nhất header và 1 dòng dữ liệu' }
    }

    // Parse CSV header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const emailIndex = header.indexOf('email')
    const nameIndex = header.indexOf('full_name') !== -1 ? header.indexOf('full_name') : header.indexOf('name')

    if (emailIndex === -1 || nameIndex === -1) {
      return { error: 'CSV phải có cột "email" và "full_name" hoặc "name"' }
    }

    // Parse data rows
    const students: Array<{ email: string; full_name: string }> = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const cells = line.split(',').map(c => c.trim())
      const email = cells[emailIndex]
      const fullName = cells[nameIndex]

      if (email && fullName) {
        students.push({ email, full_name: fullName })
      }
    }

    if (students.length === 0) {
      return { error: 'Không có dữ liệu sinh viên hợp lệ trong CSV' }
    }

    // Create users via Supabase Admin
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

    if (!supabaseServiceKey) {
      return { error: 'SUPABASE_SERVICE_KEY chưa được cấu hình' }
    }

    const adminClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const student of students) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: student.email,
          password: Math.random().toString(36).slice(-12), // Random password
          email_confirm: true,
        })

        if (authError) {
          if (authError.message.includes('already exists')) {
            errorCount++
            errors.push(`${student.email}: Email đã tồn tại`)
            continue
          }
          throw authError
        }

        // Create user profile
        const { error: profileError } = await adminClient
          .from('users')
          .insert({
            id: authData.user.id,
            email: student.email,
            full_name: student.full_name,
            role: 'student',
          })

        if (profileError) {
          throw profileError
        }

        successCount++
      } catch (error) {
        errorCount++
        errors.push(`${student.email}: ${String(error).slice(0, 50)}`)
      }
    }

    return {
      success: true,
      successCount,
      errorCount,
      totalCount: students.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }
  } catch (error) {
    console.error('[Import Students Error]', error)
    return {
      error: `Lỗi xử lý CSV: ${String(error).slice(0, 100)}`,
    }
  }
}
