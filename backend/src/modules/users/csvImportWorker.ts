import "dotenv/config";
import fs from "fs";
import { parse } from "csv-parse";
import crypto from "crypto";
import { getPool } from "../../db/pool.js";
import { getRedis } from "../../redis/client.js";

const CSV_IMPORT_PATH = process.env.CSV_IMPORT_PATH || "data/students.csv";
const BATCH_SIZE = 500;
const LOCK_KEY = "lock:csv_import";
const LOCK_TTL = 300; // 5 minutes

interface CSVRow {
  student_id: string;
  full_name: string;
  email: string;
  phone?: string;
}

async function computeMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("data", data => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function runImport() {
  const pool = getPool();
  const redis = getRedis();

  // 1. Acquire distributed lock
  const lockAcquired = await redis.set(LOCK_KEY, Date.now().toString(), "EX", LOCK_TTL, "NX");
  if (!lockAcquired) {
    console.log("[CSVWorker] Another import is already running. Skipping.");
    return;
  }

  try {
    // 2. Check if file exists
    if (!fs.existsSync(CSV_IMPORT_PATH)) {
      console.error(`[CSVWorker] File not found at ${CSV_IMPORT_PATH}`);
      return;
    }

    // 3. Compute hash and check if already imported
    const fileHash = await computeMD5(CSV_IMPORT_PATH);
    const existingLog = await pool.query(
      "SELECT id FROM student_import_logs WHERE file_hash = $1",
      [fileHash]
    );

    if (existingLog.rowCount! > 0) {
      console.log("[CSVWorker] File already imported (hash match). Skipping.");
      return;
    }

    console.log("[CSVWorker] Starting import...");

    const stats = {
      total_rows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      error_details: [] as any[]
    };

    const csvIds: string[] = [];
    let batch: CSVRow[] = [];

    const parser = fs.createReadStream(CSV_IMPORT_PATH).pipe(
      parse({ columns: true, skip_empty_lines: true, trim: true })
    );

    for await (const row of parser) {
      stats.total_rows++;
      
      // Validate row
      if (!row.student_id || !row.full_name || !row.email) {
        stats.errors++;
        stats.error_details.push({ row: stats.total_rows, error: "MISSING_REQUIRED_FIELDS" });
        continue;
      }

      if (!/^\S+@\S+\.\S+$/.test(row.email)) {
        stats.errors++;
        stats.error_details.push({ row: stats.total_rows, error: "INVALID_EMAIL" });
        continue;
      }

      batch.push(row);
      csvIds.push(row.student_id);

      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch, stats);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await processBatch(batch, stats);
    }

    // 7. Soft delete students not in CSV
    const deactivateRes = await pool.query(`
      UPDATE users 
      SET is_active = FALSE, updated_at = NOW()
      WHERE role = 'student' 
        AND is_active = TRUE 
        AND student_id != ALL($1)
    `, [csvIds]);
    
    stats.skipped = deactivateRes.rowCount || 0;

    // 8. Log results
    await pool.query(`
      INSERT INTO student_import_logs 
      (file_hash, total_rows, inserted, updated, skipped, errors, status, error_details, imported_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'success', $7, NOW())
    `, [
      fileHash, 
      stats.total_rows, 
      stats.inserted, 
      stats.updated, 
      stats.skipped, 
      stats.errors, 
      JSON.stringify(stats.error_details.slice(0, 100)) // Limit error details size
    ]);

    console.log(`[CSVWorker] Import finished: ${stats.total_rows} total, ${stats.inserted} inserted, ${stats.updated} updated, ${stats.skipped} deactivated, ${stats.errors} errors.`);

  } catch (err) {
    console.error("[CSVWorker] Import failed:", err);
  } finally {
    await redis.del(LOCK_KEY);
  }
}

async function processBatch(batch: CSVRow[], stats: any) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    for (const row of batch) {
      const res = await client.query(`
        INSERT INTO users (student_id, full_name, email, phone, role, is_active)
        VALUES ($1, $2, $3, $4, 'student', TRUE)
        ON CONFLICT (student_id) 
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          is_active = TRUE,
          updated_at = NOW()
        WHERE users.role = 'student'
        RETURNING (xmin = 0) as is_new
      `, [row.student_id, row.full_name, row.email, row.phone || null]);

      if (res.rowCount! > 0) {
        if (res.rows[0].is_new) stats.inserted++;
        else stats.updated++;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CSVWorker] Batch failed:", err);
    stats.errors += batch.length;
    stats.error_details.push({ batch: stats.total_rows, error: "BATCH_FAILED" });
  } finally {
    client.release();
  }
}

runImport().catch(err => {
  console.error("[CSVWorker] Fatal error:", err);
  process.exit(1);
});
