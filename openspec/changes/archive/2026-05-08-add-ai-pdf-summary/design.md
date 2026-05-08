## Context

Summarizing workshop materials is a CPU-intensive and time-consuming process that involves third-party AI APIs. To maintain responsiveness, this must be handled outside the main request-response cycle using an asynchronous, event-driven architecture.

## Goals / Non-Goals

**Goals:**
- Decouple PDF upload from AI processing.
- Provide a reliable status tracking mechanism for long-running AI tasks.
- Support re-uploads with full cache invalidation for the workshop summary.

**Non-Goals:**
- Implementing a custom LLM (will use external APIs).
- Handling non-PDF document types (DOCX, PPTX).

## Decisions

### Decision 1: Queueing System - RabbitMQ
- **Rationale**: RabbitMQ provides reliable message persistence and supports the worker pattern needed to scale the AI processing independently of the API gateway.
- **Alternatives**: Redis Pub/Sub was considered but rejected due to lack of durable message acknowledgement (ACK) which is critical for long-running tasks.

### Decision 2: Text Extraction - `pdf-parse`
- **Rationale**: A lightweight Node.js library that handles text extraction efficiently without requiring heavy external dependencies like Poppler.
- **Alternatives**: Cloud-based OCR services were considered but rejected for initial implementation due to cost and complexity; `pdf-parse` is sufficient for text-based PDFs.

### Decision 3: Storage Strategy - Local Disk with DB Metadata
- **Rationale**: Uploaded PDFs will be stored in a structured directory on the server (`/uploads/pdf/{workshopId}/{uuid}.pdf`), with the file path and processing metadata stored in PostgreSQL.
- **Alternatives**: S3/Cloud Storage was considered but local storage is preferred for initial development and lower latency access by the AI worker.

## Risks / Trade-offs

- **[Risk]**: Large PDFs consuming too much memory during extraction → **[Mitigation]**: Implement streaming for file reads and enforce a 50MB size limit.
- **[Risk]**: AI API rate limits or downtime → **[Mitigation]**: Implement exponential backoff retries and use a processing queue with ACK/NACK logic.
- **[Risk]**: Prompt injection from PDF content → **[Mitigation]**: Use a fixed system prompt for summarization and sanitize extracted text (truncate tokens, remove control characters).
