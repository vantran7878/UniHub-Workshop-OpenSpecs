## Why

The UniHub Workshop system depends on an accurate and up-to-date list of eligible students from the university's legacy management system. Manually maintaining this data is error-prone and inefficient. Automating a nightly synchronization process from the legacy CSV export ensures that student profiles are always current, registration eligibility is enforced, and administrative overhead is minimized.

## What Changes

- **Batch Synchronization Worker**: Implement a standalone Node.js process designed to run as a nightly cron job (2:00 AM).
- **Concurrency & Safety**: Integrated Redis distributed locking to prevent duplicate job execution and MD5 hashing to avoid re-processing identical files.
- **Data Pipeline**: implemented a streaming CSV parser that processes data in batches (500 rows/batch) to maintain a low memory footprint.
- **Lifecycle Management**: Logic to upsert active students and mark students missing from the latest CSV as `is_active = FALSE` (soft delete).
- **Audit Logging**: A new `student_import_logs` table to track the history, performance, and error details of every synchronization attempt.
- **Role Protection**: Explicit safeguards to ensure CSV data only modifies users with the `student` role, preventing accidental overwrites of `admin` or `staff` accounts.

## Capabilities

### New Capabilities
- `csv-synchronization`: Core infrastructure for automated nightly student data ingestion, validation, and database synchronization.

### Modified Capabilities
<!-- No existing capabilities are being modified at the specification level. -->

## Impact

- **Infrastructure**: Requires Redis for job locking and a scheduled task runner (e.g., system cron or a dedicated job scheduler).
- **Database**: Adds the `student_import_logs` table and updates the `users` table schema to support activation status.
- **File System**: Requires read-only access to a configured server directory for CSV ingestion.
