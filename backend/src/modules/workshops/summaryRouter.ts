import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../../db/pool.js";
import { requireRole, type AuthedRequest } from "../../middleware/auth.js";
import { publishJson } from "../../rabbitmq/client.js";

const uploadDir = process.env.PDF_UPLOAD_DIR || "uploads/pdf";

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const workshopId = req.params.id;
    const finalDir = path.join(uploadDir, workshopId);
    await fs.mkdir(finalDir, { recursive: true });
    cb(null, finalDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("File phải có định dạng PDF"));
    }
    cb(null, true);
  },
});

export const QUEUE_AI_SUMMARY = "ai_summary.generate";

export function summaryRouter() {
  const router = Router({ mergeParams: true });

  // 10.1 Upload PDF and enqueue AI summary
  router.post(
    "/pdf",
    requireRole("admin"),
    (req, res, next) => {
      upload.single("pdf")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ code: "FILE_TOO_LARGE", message: "File vượt kích thước tối đa (50MB)" });
          }
          return res.status(400).json({ code: "UPLOAD_ERROR", message: err.message });
        } else if (err) {
          return res.status(400).json({ code: "INVALID_FILE", message: err.message });
        }
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      const workshopId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ code: "MISSING_FILE", message: "Vui lòng upload file PDF" });
      }

      const pool = getPool();
      try {
        // Check if workshop exists and is not cancelled
        const workshopRes = await pool.query(
          "SELECT status FROM workshops WHERE id = $1",
          [workshopId]
        );

        if (workshopRes.rowCount === 0) {
          await fs.unlink(file.path);
          return res.status(404).json({ code: "WORKSHOP_NOT_FOUND" });
        }

        if (workshopRes.rows[0].status === "cancelled") {
          await fs.unlink(file.path);
          return res.status(409).json({ code: "WORKSHOP_CANCELLED", message: "Workshop đã hủy, không thể upload PDF" });
        }

        // UPSERT workshop_summaries
        const upsertRes = await pool.query(`
          INSERT INTO workshop_summaries (workshop_id, pdf_file_path, status, updated_at)
          VALUES ($1, $2, 'pending', NOW())
          ON CONFLICT (workshop_id) DO UPDATE SET
            pdf_file_path = EXCLUDED.pdf_file_path,
            status = 'pending',
            summary = NULL,
            error_message = NULL,
            processing_started_at = NULL,
            completed_at = NULL,
            updated_at = NOW()
          RETURNING id
        `, [workshopId, file.path]);

        const summaryId = upsertRes.rows[0].id;

        // Publish to RabbitMQ
        await publishJson(QUEUE_AI_SUMMARY, {
          workshopId,
          filePath: file.path,
          summaryId
        });

        return res.status(202).json({
          summary_id: summaryId,
          status: "pending"
        });
      } catch (err) {
        console.error("Error processing PDF upload:", err);
        if (file) await fs.unlink(file.path).catch(() => {});
        return res.status(500).json({ code: "INTERNAL_ERROR" });
      }
    }
  );

  // 10.2 Get summary
  router.get(
    "/summary",
    async (req, res) => {
      const workshopId = req.params.id;
      const pool = getPool();
      
      try {
        const result = await pool.query(`
          SELECT status, summary, ai_model_used, completed_at, error_message
          FROM workshop_summaries
          WHERE workshop_id = $1
        `, [workshopId]);

        if (result.rowCount === 0) {
          return res.json({ status: "not_available" });
        }

        return res.json(result.rows[0]);
      } catch (err) {
        console.error("Error fetching summary:", err);
        return res.status(500).json({ code: "INTERNAL_ERROR" });
      }
    }
  );

  return router;
}
