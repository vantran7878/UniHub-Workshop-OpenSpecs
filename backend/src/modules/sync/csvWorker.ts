import fs from "fs";
import crypto from "crypto";
import { parse } from "csv-parse";
import { getPool } from "../../db/pool.js";
import { getRedis } from "../../redis/client.js";

const LOCK_KEY = "lock:csv_import";
const BATCH_SIZE = 500;

export async function runCsvSyncJob() {
  const redis = getRedis();

  // Step 1: Acquire lock
  const lock = await redis.set(LOCK_KEY, "locked", "EX", 300, "NX");
  if (!lock) {
    console.log("CSV Sync: Lock already exists, skipping job.");
    // We should log skipped_lock but without a specific file hash, we can just insert a generic log or skip
    return;
  }

  const csvPath = process.env.CSV_IMPORT_PATH || "./data/students.csv";
  
  let fileHash = "";
  let totalRows = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: any[] = [];
  
  const pool = getPool();

  try {
    // Step 2: Check file
    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found at ${csvPath}`);
    }

    // Step 3: Hash check
    fileHash = await computeFileHash(csvPath);
    const existingLog = await pool.query(
      `SELECT status FROM student_import_logs WHERE file_hash = $1 AND status = 'done'`,
      [fileHash]
    );

    if (existingLog.rows.length > 0) {
      console.log(`CSV Sync: File with hash ${fileHash} already imported. Skipping.`);
      await pool.query(
        `INSERT INTO student_import_logs (file_hash, status, total_rows, inserted, updated, skipped, errors, error_details)
         VALUES ($1, 'skipped', 0, 0, 0, 0, 0, '[]'::jsonb)`,
        [fileHash]
      );
      return;
    }

    // Process file
    const allStudentIds = new Set<string>();
    let currentBatch: any[] = [];

    const processBatch = async (batch: any[]) => {
      if (batch.length === 0) return;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const row of batch) {
          const insertRes = await client.query(
            `INSERT INTO users (student_id, full_name, email, phone, role, is_active)
             VALUES ($1, $2, $3, $4, 'student', true)
             ON CONFLICT (student_id) DO UPDATE SET
               full_name = EXCLUDED.full_name,
               email = EXCLUDED.email,
               phone = EXCLUDED.phone,
               is_active = true,
               updated_at = NOW()
             WHERE users.role = 'student'
             RETURNING xmax`,
            [row.student_id, row.full_name, row.email, row.phone || null]
          );

          if (insertRes.rows.length > 0) {
            const xmax = insertRes.rows[0].xmax;
            if (xmax == 0) inserted++;
            else updated++;
          } else {
            // It was not a student role, so it was skipped
            skipped++;
          }
        }
        await client.query("COMMIT");
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Batch failed", err);
        errors += batch.length;
        errorDetails.push({ error: "Batch insert failed", message: err.message });
      } finally {
        client.release();
      }
    };

    const parser = fs.createReadStream(csvPath).pipe(parse({ columns: true, skip_empty_lines: true }));

    let isFirstRow = true;

    for await (const record of parser) {
      if (isFirstRow) {
        // Step 4: Validate headers
        if (!record.hasOwnProperty("student_id") || !record.hasOwnProperty("full_name") || !record.hasOwnProperty("email")) {
          throw new Error("Missing required columns: student_id, full_name, email");
        }
        isFirstRow = false;
      }

      totalRows++;

      const { student_id, full_name, email, phone } = record;
      if (!student_id || !full_name || !email) {
        errors++;
        errorDetails.push({ line: totalRows, error: "Missing data in required fields" });
        continue;
      }
      
      // Basic email validation
      if (!email.includes("@")) {
        errors++;
        errorDetails.push({ line: totalRows, error: "Invalid email format" });
        continue;
      }

      allStudentIds.add(student_id);
      currentBatch.push({ student_id, full_name, email, phone });

      if (currentBatch.length >= BATCH_SIZE) {
        await processBatch(currentBatch);
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      await processBatch(currentBatch);
    }

    // Step 7: Soft delete missing students
    if (allStudentIds.size > 0) {
      // Need to chunk this if the array is too large, but pg handles large IN clauses reasonably well up to 32k params
      // To be safe and bypass param limits, we can use ANY($1)
      const idsArray = Array.from(allStudentIds);
      await pool.query(
        `UPDATE users
         SET is_active = FALSE, updated_at = NOW()
         WHERE role = 'student'
           AND is_active = TRUE
           AND student_id != ALL($1)`,
        [idsArray]
      );
    }

    // Step 8: Log success
    await pool.query(
      `INSERT INTO student_import_logs (file_hash, status, total_rows, inserted, updated, skipped, errors, error_details)
       VALUES ($1, 'done', $2, $3, $4, $5, $6, $7::jsonb)`,
      [fileHash, totalRows, inserted, updated, skipped, errors, JSON.stringify(errorDetails)]
    );

  } catch (err: any) {
    console.error("CSV Sync failed:", err);
    // Log failure
    try {
      if (!fileHash) fileHash = "unknown";
      await pool.query(
        `INSERT INTO student_import_logs (file_hash, status, total_rows, inserted, updated, skipped, errors, error_details)
         VALUES ($1, 'failed', 0, 0, 0, 0, 0, $2::jsonb)`,
        [fileHash, JSON.stringify([{ error: err.message }])]
      );
    } catch (e) {
      console.error("Could not write failure log:", e);
    }
  } finally {
    await redis.del(LOCK_KEY);
  }
}

function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
