'use server'

import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
// import pdfParse from 'pdf-parse'
import { PDFParse } from 'pdf-parse';
import { stringify } from 'querystring';


export async function summarizeWorkshopPDF(workshopId: string, pdfBuffer: Buffer) {
  try {
    // Parse PDF
    const pdfData = await new PDFParse(pdfBuffer)
    const pdfText = await pdfData.getText().then(res => res.text);

    // OR, if getText() returns the object directly:
    // const result = await pdfData.getText();
    // const pdfText = result.text; // Use the text property here

    if (!pdfText || pdfText.length === 0) {
      return {
        success: false,
        error: 'PDF không chứa nội dung text. Vui lòng upload file khác.',
      }
    }

    // Use AI to summarize PDF
    if (!process.env.OPENAI_API_KEY) {
      // Fallback: Basic summary without AI
      const basicSummary = pdfText.substring(0, 500) + '...'
      return {
        success: true,
        summary: basicSummary,
        message: 'Tóm tắt (Basic - không có AI)',
      }
    }

    // Generate AI summary
    const { text: aiSummary } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Đọc nội dung PDF sau đây về một workshop và tạo một mô tả ngắn gọn, chuyên nghiệp, hấp dẫn bằng tiếng Việt (200-300 từ).

                Mô tả này sẽ được dùng làm description của workshop trên hệ thống.

                PDF content:
                ${pdfText}

                Yêu cầu:
                - Ngắn gọn, rõ ràng, hấp dẫn
                - Bao gồm các điểm chính về nội dung workshop
                - Thích hợp cho sinh viên đọc
                - Không quá dài

                Chỉ trả về nội dung mô tả, không có tiêu đề hay giải thích thêm.`,
      maxOutputTokens: 200,
    })

    return {
      success: true,
      summary: aiSummary,
      message: 'Tóm tắt thành công',
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
