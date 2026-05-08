## 1. Database and Infrastructure

- [x] 1.1 Create migration for `workshop_summaries` table (columns: `id`, `workshop_id`, `pdf_file_path`, `status`, `summary`, `error_message`, `ai_model_used`, `processing_started_at`, `completed_at`)
- [x] 1.2 Initialize RabbitMQ connection and create the `ai_summary.generate` queue
- [x] 1.3 Configure environment variables for AI API keys and PDF storage paths

## 2. API Endpoints

- [x] 2.1 Implement `POST /api/workshops/:id/pdf` with `multer` for file upload and validation
- [x] 2.2 Implement UPSERT logic for `workshop_summaries` and event publishing to RabbitMQ
- [x] 2.3 Implement `GET /api/workshops/:id/summary` for polling status and fetching content

## 3. AI Worker Implementation

- [x] 3.1 Create the AI Worker service (Node.js) that consumes from `ai_summary.generate`
- [x] 3.2 Implement PDF text extraction using `pdf-parse` with memory-safe streaming
- [x] 3.3 Implement the AI summarization service wrapper with exponential backoff retries
- [x] 3.4 Implement state updates (processing, done, failed) back to PostgreSQL

## 4. Verification and UI Polling

- [x] 4.1 Verify that admin upload returns 202 and creates a pending record
- [x] 4.2 Verify the AI worker correctly processes a 10-page PDF and updates status to 'done'
- [x] 4.3 Verify that students can view the summary but cannot trigger a re-upload
- [x] 4.4 Verify re-upload behavior: old summary is cleared and status resets to 'pending'
