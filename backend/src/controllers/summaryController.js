const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const { getChannel } = require('../config/rabbitmq');

/**
 * Handle PDF upload for workshop summary.
 */
async function uploadPDF(req, res) {
  const { id: workshopId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ code: 'MISSING_FILE' });
  }

  try {
    // 1. Verify workshop exists
    const workshop = await db.query('SELECT id FROM workshops WHERE id = $1', [workshopId]);
    if (workshop.rows.length === 0) {
      return res.status(404).json({ code: 'WORKSHOP_NOT_FOUND' });
    }

    // 2. UPSERT into workshop_summaries
    const pdfPath = file.path;
    const upsertResult = await db.query(
      `INSERT INTO workshop_summaries (workshop_id, pdf_file_path, status, summary, error_message, updated_at)
       VALUES ($1, $2, 'pending', NULL, NULL, NOW())
       ON CONFLICT (workshop_id) DO UPDATE SET
         pdf_file_path = EXCLUDED.pdf_file_path,
         status = 'pending',
         summary = NULL,
         error_message = NULL,
         updated_at = NOW()
       RETURNING id`,
      [workshopId, pdfPath]
    );

    const summaryId = upsertResult.rows[0].id;

    // 3. Publish to RabbitMQ
    const channel = getChannel();
    if (channel) {
      const event = {
        workshopId,
        filePath: pdfPath,
        summaryId
      };
      channel.sendToQueue('ai_summary.generate', Buffer.from(JSON.stringify(event)), { persistent: true });
    }

    res.status(202).json({
      summaryId,
      status: 'pending'
    });
  } catch (err) {
    console.error('Upload PDF error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/**
 * Get workshop summary status and content.
 */
async function getSummary(req, res) {
  const { id: workshopId } = req.params;

  try {
    const result = await db.query(
      `SELECT status, summary, error_message, ai_model_used, completed_at
       FROM workshop_summaries WHERE workshop_id = $1`,
      [workshopId]
    );

    const summary = result.rows[0];
    if (!summary) {
      return res.status(404).json({ code: 'SUMMARY_NOT_FOUND' });
    }

    res.json(summary);
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

module.exports = {
  uploadPDF,
  getSummary
};
