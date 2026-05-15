'use server'

import { createClient } from '@/lib/supabase/server'

export async function summarizeWorkshopPDF(workshopId: string, pdfFile: File) {
  try {
    const formData = new FormData()
    formData.append('file', pdfFile)
    formData.append('workshopId', workshopId)

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/summarize-pdf`, {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Lỗi khi xử lý PDF',
      }
    }

    return result
  } catch (error) {
    console.error('[PDF Summary Error]', error)
    return {
      success: false,
      error: String(error),
      message: 'Lỗi khi tóm tắt PDF. Vui lòng thử lại.',
    }
  }
}

export async function updateWorkshopDescription(workshopId: string, description: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('workshops')
      .update({ description })
      .eq('id', workshopId)

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      message: 'Cập nhật mô tả workshop thành công',
    }
  } catch (error) {
    console.error('[Update Workshop Error]', error)
    return {
      success: false,
      error: String(error),
    }
  }
}
