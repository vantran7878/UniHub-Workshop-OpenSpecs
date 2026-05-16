import { BaseWorker } from '../BaseWorker';
import { supabaseServiceRole } from '@/lib/supabase/service-role';
import { PDFParse } from 'pdf-parse';
import { generateText } from 'ai';
import { aiModel } from '@/lib/ai';

export class AIWorker extends BaseWorker {
  protected queueName = 'ai_summary_queue';
  protected exchangeName = 'unihub_events';
  protected routingKey = 'ai_job';

  protected async process(data: any): Promise<void> {
    const { workshopId, fileName } = data;

    console.log(`[AIWorker] Processing AI Summary for workshop ${workshopId}: ${fileName}`);

    try {
      // 1. Download PDF from Supabase Storage (bucket: 'workshop-materials')
      const { data: fileData, error: downloadError } = await supabaseServiceRole
        .storage
        .from('workshop-materials')
        .download(`${workshopId}/${fileName}`);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // 2. Parse PDF using the new PDFParse v2 API
      const arrayBuffer = await fileData.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      const pdfText = result.text;

      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('PDF content is empty');
      }

      // 3. Generate AI Summary
      const { text: aiSummary } = await generateText({
        model: aiModel,
        prompt: `Đọc nội dung PDF sau đây về một workshop và tạo một mô tả ngắn gọn, chuyên nghiệp (200-300 từ) bằng tiếng Việt.
        
        PDF Content:
        ${pdfText.substring(0, 5000)}
        
        Chỉ trả về nội dung mô tả.`,
        maxOutputTokens: 500,
      });

      // 4. Update Database
      const { error: updateError } = await supabaseServiceRole
        .from('workshops')
        .update({
          description: aiSummary,
          ai_summary: aiSummary // Update both fields
        })
        .eq('id', workshopId);

      if (updateError) {
        throw new Error(`Failed to update DB: ${updateError.message}`);
      }

      console.log(`[AIWorker] Successfully updated summary for workshop ${workshopId}`);
    } catch (error) {
      console.error(`[AIWorker Error] ${workshopId}:`, error);
      throw error; // This will trigger nack in BaseWorker
    }
  }
}
