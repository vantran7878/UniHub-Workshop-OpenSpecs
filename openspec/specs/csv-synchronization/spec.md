# csv-synchronization Specification

## Purpose
TBD - created by archiving change add-csv-synchronization. Update Purpose after archive.
## Requirements
### Requirement: Nightly Batch Execution
The system SHALL run an automated batch synchronization process every night at 2:00 AM. The system MUST use a distributed lock (Redis) to ensure that only one instance of the job runs at a time.

#### Scenario: Successful Scheduled Execution
- **WHEN** the clock reaches 2:00 AM and no other sync job is running
- **THEN** the system acquires a Redis lock and starts processing the legacy CSV file

#### Scenario: Concurrent Job Prevention
- **WHEN** a sync job is triggered while another instance is still holding the Redis lock
- **THEN** the second job MUST terminate immediately and log a 'skipped' status

### Requirement: Data Validation and Streaming
The system SHALL read the CSV file using a streaming approach to minimize memory consumption. The system MUST validate the CSV structure (required headers) and individual row formats (e.g., email validity) before processing.

#### Scenario: Missing Required Headers
- **WHEN** a CSV file is missing the `student_id`, `full_name`, or `email` columns
- **THEN** the system MUST stop processing and record a 'failed' status in the import logs

#### Scenario: Invalid Row Data
- **WHEN** a specific row in the CSV has an invalid email format or empty student ID
- **THEN** the system SHALL skip that specific row, increment the error count, and continue with the next row

### Requirement: Idempotent Upsert and Soft Delete
The system SHALL use an idempotent UPSERT strategy for students found in the CSV. Any student currently in the database with the 'student' role who is NOT present in the latest CSV MUST be marked as inactive (`is_active = FALSE`).

#### Scenario: New Student Ingestion
- **WHEN** a student ID in the CSV does not exist in the database
- **THEN** the system creates a new user record with the 'student' role and `is_active = TRUE`

#### Scenario: Soft Deletion of Inactive Students
- **WHEN** the sync job completes processing all rows in the CSV
- **THEN** the system MUST update all database records with `role = 'student'` that were not seen in the current file to `is_active = FALSE`

### Requirement: Audit Logging and Alerting
The system SHALL record the results of every synchronization attempt in a dedicated log table. If the job fails due to system errors (e.g., file not found, DB connection failure), the system MUST alert administrators.

#### Scenario: Successful Log Entry
- **WHEN** a synchronization job finishes
- **THEN** the system creates a record in `student_import_logs` containing the file hash, total rows processed, counts for inserts/updates/errors, and completion timestamp

#### Scenario: File Not Found Alert
- **WHEN** the sync job starts but the CSV file is missing from the configured path
- **THEN** the system logs a 'failed' status and sends an error-level log entry or alert to the system administrators

