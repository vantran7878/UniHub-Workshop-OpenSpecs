'use server'

import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function generateAISummary(period: 'week' | 'month' | 'all' = 'month') {
  try {
    const supabase = await createClient()
    const now = new Date()

    // Calculate date range
    let startDate = new Date(0)
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Fetch data
    const [
      { data: workshops },
      { data: registrations },
      { data: payments },
      { data: checkins },
      { count: totalUsers },
    ] = await Promise.all([
      supabase
        .from('workshops')
        .select('id, title, start_time, end_time, speaker, capacity, confirmed_count, fee')
        .gte('created_at', startDate.toISOString()),
      supabase
        .from('registrations')
        .select('id, status, created_at')
        .gte('created_at', startDate.toISOString()),
      supabase
        .from('payments')
        .select('id, amount, status')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString()),
      supabase
        .from('checkins')
        .select('id')
        .gte('created_at', startDate.toISOString()),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
    ])

    // Calculate statistics
    const totalWorkshops = workshops?.length || 0
    const totalRegistrations = registrations?.length || 0
    const confirmedRegistrations = registrations?.filter(r => r.status === 'confirmed').length || 0
    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    const totalCheckIns = checkins?.length || 0
    const attendanceRate = totalRegistrations > 0 ? ((totalCheckIns / totalRegistrations) * 100).toFixed(1) : 0

    // Prepare data for AI
    const dataContext = `
      Workshop Statistics (Last ${period}):
      - Total Workshops: ${totalWorkshops}
      - Total Registrations: ${totalRegistrations}
      - Confirmed Registrations: ${confirmedRegistrations}
      - Check-ins: ${totalCheckIns}
      - Attendance Rate: ${attendanceRate}%
      - Total Revenue: ${totalRevenue} VND
      - Total Users: ${totalUsers}
      
      Recent Workshops:
      ${workshops?.slice(0, 5).map(w => `- ${w.title} (${w.speaker}) - Capacity: ${w.confirmed_count}/${w.capacity}, Fee: ${w.fee} VND`).join('\n')}
    `

    // Use AI to generate summary (fallback to basic summary if no API key)
    if (!process.env.OPENAI_API_KEY) {
      // Basic summary without AI
      return {
        summary: `
📊 **Tóm tắt hệ thống (${period === 'week' ? 'tuần này' : period === 'month' ? 'tháng này' : 'toàn bộ'})**

📈 Thống kê:
- Tổng workshops: ${totalWorkshops}
- Tổng đăng ký: ${totalRegistrations}
- Đã xác nhận: ${confirmedRegistrations}
- Check-in: ${totalCheckIns}
- Tỷ lệ tham dự: ${attendanceRate}%
- Doanh thu: ${totalRevenue.toLocaleString()} VND
- Tổng users: ${totalUsers}

🎯 Những workshop hàng đầu:
${workshops?.slice(0, 3).map(w => `- ${w.title} (${w.speaker}): ${w.confirmed_count}/${w.capacity} học viên`).join('\n')}
        `,
        stats: {
          totalWorkshops,
          totalRegistrations,
          confirmedRegistrations,
          totalCheckIns,
          attendanceRate: parseFloat(attendanceRate as string),
          totalRevenue,
          totalUsers,
        }
      }
    }

    // Generate AI summary
    const { text: aiSummary } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Analyze this workshop system data and provide a concise, insightful summary in Vietnamese with actionable insights:

${dataContext}

Please provide:
1. Overall performance assessment
2. Key achievements
3. Areas for improvement
4. Recommendations for next steps

Keep it brief, professional, and focused on business insights.`,
      maxOutputTokens: 500,
    })

    return {
      summary: aiSummary,
      stats: {
        totalWorkshops,
        totalRegistrations,
        confirmedRegistrations,
        totalCheckIns,
        attendanceRate: parseFloat(attendanceRate as string),
        totalRevenue,
        totalUsers,
      }
    }
  } catch (error) {
    console.error('[AI Summary Error]', error)
    return {
      summary: 'Lỗi khi tạo tóm tắt. Vui lòng thử lại.',
      error: String(error),
    }
  }
}
