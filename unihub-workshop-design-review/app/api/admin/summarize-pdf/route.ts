import { NextRequest, NextResponse } from 'next/server'
import RabbitMQProvider from '@/lib/rabbitmq/RabbitMQProvider'

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

    // In a real scenario, we would upload the file to S3/Supabase Storage first
    // and send the URL to RabbitMQ. For this demo, we'll assume the file is small
    // and pass the content or just the fact that it needs processing.
    // Assuming the file is already uploaded to 'workshop-materials' bucket in a real app.
    
    const rabbit = RabbitMQProvider.getInstance();
    const channel = await rabbit.getChannel();

    const message = {
      workshopId,
      fileName: file.name,
      fileType: file.type,
      timestamp: new Date().toISOString()
    };

    await channel.assertExchange('unihub_events', 'direct', { durable: true });
    channel.publish('unihub_events', 'ai_job', Buffer.from(JSON.stringify(message)), {
      persistent: true
    });

    return NextResponse.json({
      success: true,
      message: 'Tác vụ tóm tắt PDF đã được đưa vào hàng đợi xử lý.',
    })
  } catch (error) {
    console.error('[PDF API Error]', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Lỗi khi đưa tác vụ vào hàng đợi. Vui lòng thử lại.',
      },
      { status: 500 }
    )
  }
}
