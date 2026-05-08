const fs = require('fs');
const pdf = require('pdf-parse');
const db = require('../config/db');
const { connectRabbitMQ } = require('../config/rabbitmq');

async function startWorker() {
  const { channel } = await connectRabbitMQ();
  
  console.log('AI Worker waiting for messages...');
  
  channel.consume('ai_summary.generate', async (msg) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    const { workshopId, filePath, summaryId } = data;

    console.log(`Processing summary for workshop: ${workshopId}`);

    try {
      // 1. Update status to 'processing'
      await db.query(
        "UPDATE workshop_summaries SET status = 'processing', processing_started_at = NOW() WHERE id = $1",
        [summaryId]
      );

      // 2. Extract text from PDF
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found on disk');
      }

      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text.trim();

      if (!text) {
        throw new Error('No text content extracted from PDF');
      }

      // 3. Mock AI Summarization
      // In a real implementation, we would call OpenAI/Grok here
      console.log('Calling AI API...');
      const summary = `Tóm tắt nội dung cho workshop ${workshopId}:\n\n` + 
                      `Chủ đề: Nội dung chuyên sâu về workshop.\n` + 
                      `Nội dung chính: ${text.substring(0, 200)}...\n` +
                      `Điểm nổi bật:\n- Phân tích chi tiết.\n- Giải pháp thực tế.`;

      // 4. Update status to 'done'
      await db.query(
        `UPDATE workshop_summaries 
         SET status = 'done', 
             summary = $1, 
             ai_model_used = $2, 
             completed_at = NOW() 
         WHERE id = $3`,
        [summary, process.env.AI_MODEL || 'mock-gpt-4o', summaryId]
      );

      channel.ack(msg);
      console.log(`Successfully generated summary for ${workshopId}`);
    } catch (err) {
      console.error(`Error processing ${workshopId}:`, err);
      
      await db.query(
        "UPDATE workshop_summaries SET status = 'failed', error_message = $1 WHERE id = $2",
        [err.message, summaryId]
      );

      // NACK if it's a transient error, but for now we'll just ACK and mark failed
      channel.ack(msg);
    }
  }, { noAck: false });
}

if (require.main === module) {
  startWorker().catch(err => {
    console.error('AI Worker failed to start:', err);
    process.exit(1);
  });
}

module.exports = { startWorker };
