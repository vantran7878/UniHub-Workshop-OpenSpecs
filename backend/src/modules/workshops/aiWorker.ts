import "dotenv/config";
import fs from "fs/promises";
import pdf from "pdf-parse";
import { getAmqpChannel, consumeJson } from "../../rabbitmq/client.js";
import { getPool } from "../../db/pool.js";
import { QUEUE_AI_SUMMARY } from "./summaryRouter.js";

interface AIEvent {
  workshopId: string;
  filePath: string;
  summaryId: string;
}

async function processAIEvent(event: AIEvent) {
  const pool = getPool();
  
  try {
    // 1. Update status to processing
    await pool.query(`
      UPDATE workshop_summaries 
      SET status = 'processing', processing_started_at = NOW() 
      WHERE id = $1
    `, [event.summaryId]);

    console.log(`[AIWorker] Processing workshop ${event.workshopId}...`);

    // 2. Read PDF and extract text
    const dataBuffer = await fs.readFile(event.filePath);
    const data = await pdf(dataBuffer);
    
    let text = data.text;
    if (!text || text.trim().length === 0) {
      throw new Error("UNREADABLE_PDF: No text content extracted");
    }

    // 3. Clean and truncate text (max 12000 tokens/approx characters for stub)
    text = text.replace(/\s+/g, " ").trim().slice(0, 48000);

    // 4. Call AI Summarization Service (STUBBED)
    const summary = await callAIServiceStub(text);

    // 5. Update status to done
    await pool.query(`
      UPDATE workshop_summaries 
      SET status = 'done', 
          summary = $1, 
          ai_model_used = $2, 
          completed_at = NOW() 
      WHERE id = $3
    `, [summary, process.env.AI_MODEL || "gpt-4o-mini-stub", event.summaryId]);

    console.log(`[AIWorker] Successfully summarized workshop ${event.workshopId}`);
  } catch (err: any) {
    console.error(`[AIWorker] Failed to process workshop ${event.workshopId}:`, err);
    
    await pool.query(`
      UPDATE workshop_summaries 
      SET status = 'failed', error_message = $1 
      WHERE id = $2
    `, [err.message || "Unknown error", event.summaryId]);
  }
}

async function callAIServiceStub(text: string): Promise<string> {
  // Simulate AI latency
  await new Promise(resolve => setTimeout(resolve, 2000));

  // A very basic stub summary
  return `Đây là bản tóm tắt tự động bằng AI cho nội dung workshop. 
  
Chủ đề: Nội dung từ tài liệu PDF đã upload.
Nội dung chính: Tài liệu thảo luận về các vấn đề kỹ thuật và quy trình chuyên môn.
Điểm nổi bật:
- Điểm 1: Nội dung chi tiết trong file.
- Điểm 2: Các kiến thức quan trọng đã được trích xuất.
- Điểm 3: Hướng dẫn thực hành cho sinh viên.

(Lưu ý: Đây là bản tóm tắt mẫu được tạo bởi AI Worker stub).`;
}

async function init() {
  const ch = await getAmqpChannel();
  await ch.assertQueue(QUEUE_AI_SUMMARY, { durable: true });

  console.log(`AI Worker starting, consuming from ${QUEUE_AI_SUMMARY}...`);

  await consumeJson(QUEUE_AI_SUMMARY, async ({ body }) => {
    await processAIEvent(body as AIEvent);
  });
}

init().catch(err => {
  console.error("AI Worker crashed:", err);
  process.exit(1);
});
