'use server'

import { createClient } from '@/lib/supabase/server'
import { PDFParse } from 'pdf-parse'
import { generateText } from 'ai'
import { aiModel } from '@/lib/ai'

export async function summarizeWorkshopPDF(workshopId: string, pdfFile: File) {
  try {
    // 1. Read file content
    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2. Parse PDF using the new PDFParse v2 API
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text

    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Không thể đọc được nội dung từ file PDF này.' }
    }

    // 3. Generate AI Summary
    const { text: aiSummary } = await generateText({
      model: aiModel,
      prompt: `Đọc nội dung PDF sau đây về một workshop và tạo một mô tả ngắn gọn, chuyên nghiệp (200-300 từ) bằng tiếng Việt.
      
      PDF Content:
      ${text.substring(0, 5000)}
      
      Chỉ trả về nội dung mô tả.`,
      maxOutputTokens: 500,
    })

    return {
      success: true,
      summary: aiSummary,
    }
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
      .update({
        description: description,
        ai_summary: description // Update both fields for compatibility
      })
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
