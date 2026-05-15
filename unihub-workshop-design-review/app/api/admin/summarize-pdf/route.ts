import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import pdfParse from 'pdf-parse'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const workshopId = formData.get('workshopId') as string

    if (!file || !workshopId) {
      return NextResponse.json(
        { success: false, error: 'Missing file or workshopId' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    // Parse PDF
    const pdfData = await pdfParse(pdfBuffer)
    const pdfText = pdfData.text

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF không chứa nội dung text. Vui lòng upload file khác.',
        },
        { status: 400 }
      )
    }

    // Use AI to summarize
    if (!process.env.OPENAI_API_KEY) {
      // Fallback without AI
      const basicSummary = pdfText.substring(0, 500) + '...'
      return NextResponse.json({
        success: true,
        summary: basicSummary,
        message: 'Tóm tắt (Basic - không có AI)',
      })
    }

    // Generate AI summary
    const { text: aiSummary } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Đọc nội dung PDF sau đây về một workshop và tạo một mô tả ngắn gọn, chuyên nghiệp, hấp dẫn bằng tiếng Việt (200-300 từ).

Mô tả này sẽ được dùng làm description của workshop trên hệ thống.

PDF content:
${pdfText.substring(0, 3000)}

Yêu cầu:
- Ngắn gọn, rõ ràng, hấp dẫn
- Bao gồm các điểm chính về nội dung workshop
- Thích hợp cho sinh viên đọc
- Không quá dài

Chỉ trả về nội dung mô tả, không có tiêu đề hay giải thích thêm.`,
      maxTokens: 400,
    })

    return NextResponse.json({
      success: true,
      summary: aiSummary,
      message: 'Tóm tắt thành công',
    })
  } catch (error) {
    console.error('[PDF API Error]', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Lỗi khi xử lý PDF. Vui lòng thử lại.',
      },
      { status: 500 }
    )
  }
}
