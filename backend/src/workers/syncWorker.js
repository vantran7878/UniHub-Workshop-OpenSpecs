const fs = require('fs');
const crypto = require('crypto');
const { parse } = require('csv-parse');
const cron = require('node-cron');
const db = require('../config/db');
const { acquireLock, releaseLock } = require('../config/redis');

const BATCH_SIZE = 500;
const CSV_PATH = process.env.CSV_IMPORT_PATH || 'data/students.csv';
const LOCK_KEY = 'lock:csv_import';

/**
 * Calculate MD5 hash of a file.
 */
function calculateMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Main Synchronization Function.
 */
async function runSync() {
  console.log('Starting CSV Synchronization Job...');

  // 1. Acquire Lock
  const locked = await acquireLock(LOCK_KEY);
  if (!locked) {
    console.log('Job skipped: Another instance is running.');
    return;
  }

  const log = {
    file_hash: null,
    total_rows: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    error_details: [],
    status: 'pending'
  };

  try {
    // 2. Check File
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV file not found at ${CSV_PATH}`);
    }

    // 3. Hash Check
    log.file_hash = await calculateMD5(CSV_PATH);
    const lastImport = await db.query(
      "SELECT id FROM student_import_logs WHERE file_hash = $1 AND status = 'success'",
      [log.file_hash]
    );

    if (lastImport.rows.length > 0) {
      log.status = 'skipped';
      console.log('File already imported. Skipping.');
      return;
    }

    // 4. Processing Pipeline
    const parser = fs.createReadStream(CSV_PATH).pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));

    let batch = [];
    const processedIds = new Set();

    for await (const row of parser) {
      log.total_rows++;
      
      // Validation
      if (!row.student_id || !row.email || !row.email.includes('@')) {
        log.errors++;
        log.error_details.push({ row: log.total_rows, error: 'Invalid data' });
        continue;
      }

      batch.push(row);
      processedIds.add(row.student_id);

      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch, log);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await processBatch(batch, log);
    }

    // 5. Soft Delete Inactive
    const allProcessedIds = Array.from(processedIds);
    await db.query(
      `UPDATE users 
       SET is_active = FALSE, updated_at = NOW() 
       WHERE role = 'student' AND student_id != ALL($1) AND is_active = TRUE`,
      [allProcessedIds]
    );

    log.status = 'success';
    console.log('Synchronization complete.');

  } catch (err) {
    log.status = 'failed';
    log.error_details.push({ global: err.message });
    console.error('Synchronization failed:', err);
  } finally {
    // 6. Finalize Log & Release Lock
    await db.query(
      `INSERT INTO student_import_logs (file_hash, total_rows, inserted, updated, errors, error_details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [log.file_hash, log.total_rows, log.inserted, log.updated, log.errors, JSON.stringify(log.error_details), log.status]
    );
    await releaseLock(LOCK_KEY);
  }
}

/**
 * Process a batch of rows with UPSERT.
 */
async function processBatch(batch, log) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const row of batch) {
      const result = await client.query(
        `INSERT INTO users (student_id, full_name, email, phone, role, is_active)
         VALUES ($1, $2, $3, $4, 'student', TRUE)
         ON CONFLICT (student_id) 
         DO UPDATE SET 
           full_name = EXCLUDED.full_name, 
           email = EXCLUDED.email, 
           phone = EXCLUDED.phone,
           is_active = TRUE,
           updated_at = NOW()
         WHERE users.role = 'student'
         RETURNING (xmax = 0) AS is_insert`,
        [row.student_id, row.full_name, row.email, row.phone]
      );

      if (result.rows.length > 0) {
        if (result.rows[0].is_insert) log.inserted++;
        else log.updated++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  console.log('CSV Sync Worker started. Scheduling job for 2:00 AM.');
  
  // Schedule: 0 2 * * * (At 02:00 every day)
  cron.schedule('0 2 * * *', () => {
    console.log('Cron Trigger: Starting nightly sync...');
    runSync().catch(console.error);
  });

  // Optional: Run immediately if --now flag is passed
  if (process.argv.includes('--now')) {
    runSync().catch(console.error);
  }
}

module.exports = { runSync };
