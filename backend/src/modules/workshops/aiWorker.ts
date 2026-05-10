import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

import { getAmqpChannel } from "../../rabbitmq/client.js";
import { getPool } from "../../db/pool.js";
import fs from "fs/promises";

const QUEUE_AI_SUMMARY = "ai_summary.generate";
const MAX_TOKENS = 12000;

export async function runAiWorker() {
  const channel = await getAmqpChannel();
  if (!channel) {
    console.warn("AI worker: RabbitMQ not available, skipping...");
    return;
  }

  // Need a DLX setup for retry
  await channel.assertExchange("ai_summary.retry.exchange", "direct", { durable: true });
  await channel.assertQueue("ai_summary.retry", {
    durable: true,
    deadLetterExchange: "",
    deadLetterRoutingKey: QUEUE_AI_SUMMARY,
    messageTtl: 30000 // 30s base backoff
  });

  await channel.assertQueue(QUEUE_AI_SUMMARY, { durable: true });
  channel.prefetch(1);

  console.log(`AI worker: waiting for messages in ${QUEUE_AI_SUMMARY}`);

  channel.consume(QUEUE_AI_SUMMARY, async (msg) => {
    if (!msg) return;

    const payload = JSON.parse(msg.content.toString());
    const { workshopId, filePath, summaryId } = payload;
    
    // Track delivery count for exponential backoff or dead-lettering
    const headers = msg.properties.headers || {};
    const deliveryCount = (headers["x-delivery-count"] || 0) + 1;

    if (deliveryCount > 3) {
      console.error(`AI worker: max retries reached for summaryId=${summaryId}`);
      await failSummary(summaryId, "AI xử lý thất bại sau nhiều lần thử. Vui lòng thử lại sau.");
      channel.reject(msg, false);
      return;
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      // Check if this summary is still the active one for the workshop
      const curRes = await client.query(`SELECT id, status FROM workshop_summaries WHERE workshop_id = $1`, [workshopId]);
      if (curRes.rows.length === 0 || curRes.rows[0].id !== summaryId) {
        // Obsolete event (a newer PDF was uploaded)
        console.log(`AI worker: obsolete event for workshopId=${workshopId}, ignoring`);
        channel.ack(msg);
        return;
      }

      await client.query(`UPDATE workshop_summaries SET status = 'processing', processing_started_at = NOW() WHERE id = $1`, [summaryId]);

      // Read file
      let dataBuffer: Buffer;
      try {
        dataBuffer = await fs.readFile(filePath);
      } catch (err: any) {
        console.error("AI worker: failed to read file", err);
        await failSummary(summaryId, "File không tồn tại hoặc không thể đọc.");
        channel.ack(msg);
        return;
      }

      let text = "";
      try {
        const data = await pdf(dataBuffer);
        text = data.text;
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes('password')) {
          await failSummary(summaryId, "PDF được bảo vệ bằng mật khẩu.");
        } else {
          await failSummary(summaryId, "File PDF bị lỗi, vui lòng upload lại.");
        }
        channel.ack(msg);
        return;
      }

      const cleanText = text.replace(/\s+/g, ' ').trim();
      if (!cleanText) {
        await failSummary(summaryId, "PDF không chứa text có thể đọc. Vui lòng upload PDF dạng text hoặc dùng OCR trước.");
        channel.ack(msg);
        return;
      }

      // Truncate to MAX_TOKENS approx (1 token ~ 4 chars)
      const truncatedText = cleanText.slice(0, MAX_TOKENS * 4);

      // Call AI summarization service
      const aiSummaryResponse = await callSummarizationService(truncatedText);
      
      await client.query(
        `UPDATE workshop_summaries 
         SET status = 'done', summary = $1, ai_model_used = $2, completed_at = NOW() 
         WHERE id = $3`,
        [aiSummaryResponse.summary, aiSummaryResponse.model, summaryId]
      );

      channel.ack(msg);
    } catch (err: any) {
      console.error(`AI worker processing failed (deliveryCount=${deliveryCount}):`, err);
      // NACK to send to retry queue
      // Since standard requeue doesn't add TTL, we publish to retry exchange and ack the original
      try {
        channel.publish("ai_summary.retry.exchange", "", Buffer.from(JSON.stringify(payload)), {
          headers: {
            "x-delivery-count": deliveryCount
          }
        });
        channel.ack(msg);
      } catch (publishErr) {
        channel.nack(msg);
      }
    } finally {
      client.release();
    }
  });
}

async function failSummary(summaryId: string, errorMsg: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE workshop_summaries SET status = 'failed', error_message = $1 WHERE id = $2`,
    [errorMsg, summaryId]
  );
}

// Stub implementation for AI Summarization
async function callSummarizationService(text: string): Promise<{ summary: string; model: string }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulated AI response
  return {
    summary: "### Chủ đề\nNội dung workshop xoay quanh các chủ đề nâng cao về lập trình.\n\n### Nội dung chính\nBàn về các thiết kế hệ thống, microservices, và event-driven architecture. Những vấn đề kỹ thuật cũng như giải pháp phổ biến được đề cập chi tiết.\n\n### Điểm nổi bật\n1. Hiểu sâu về thiết kế hệ thống\n2. Xây dựng hệ thống có khả năng scale tốt\n3. Xử lý message queues hiệu quả",
    model: process.env.AI_MODEL || "gpt-4o-mini-stub"
  };
}
