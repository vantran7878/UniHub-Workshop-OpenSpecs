## 1. Database and Infrastructure

- [x] 1.1 Create migration for `student_import_logs` table (columns: `id`, `file_hash`, `total_rows`, `inserted`, `updated`, `skipped`, `errors`, `error_details`, `status`, `imported_at`)
- [x] 1.2 Add `is_active` boolean column to the `users` table with a default value of `TRUE`
- [x] 1.3 Configure Redis client and implement the `acquireLock` and `releaseLock` utility functions

## 2. CSV Pipeline Implementation

- [x] 2.1 Set up the streaming CSV parser using `csv-parse` and implement the header validation phase
- [x] 2.2 Implement the MD5 hashing utility to detect changes in the legacy CSV file
- [x] 2.3 Implement the row-level validation logic (email format, student_id presence) and error counting

## 3. Synchronization Logic

- [x] 3.1 Implement the batch UPSERT logic (500 rows/batch) using `ON CONFLICT (student_id) DO UPDATE`
- [x] 3.2 Add the role protection guard to ensure only users with `role = 'student'` are modified
- [x] 3.3 Implement the post-processing phase to mark missing students as `is_active = FALSE`

## 4. Automation and Monitoring

- [x] 4.1 Create the standalone `syncWorker.js` entry point and configure the 2:00 AM cron schedule
- [x] 4.2 Implement comprehensive logging for each phase of the synchronization (lock, hash, parse, upsert, cleanup)
- [x] 4.3 Verify that the job correctly handles the 'skipped' state when a file hash matches the previous run
- [x] 4.4 Verify that a malformed CSV correctly triggers a 'failed' status and stops execution before modifying data
