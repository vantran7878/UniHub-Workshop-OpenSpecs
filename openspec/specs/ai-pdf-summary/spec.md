# ai-pdf-summary Specification

## Purpose
TBD - created by archiving change add-ai-pdf-summary. Update Purpose after archive.
## Requirements
### Requirement: Admin PDF Upload
The system SHALL provide an endpoint for admins to upload a PDF document for a specific workshop. The system MUST validate the file type and size before accepting it.

#### Scenario: Successful Upload
- **WHEN** an admin uploads a valid PDF file (under 50MB) to `/api/workshops/:id/pdf`
- **THEN** the system returns a 202 Accepted status, saves the file, and triggers background processing

#### Scenario: Invalid File Type
- **WHEN** an admin uploads a non-PDF file
- **THEN** the system returns a 400 Bad Request status with an appropriate error message

### Requirement: Asynchronous AI Processing
The system SHALL process uploaded PDFs asynchronously using an AI worker. The worker MUST extract text from the PDF, clean it, and call an AI service to generate a summary.

#### Scenario: Processing Progression
- **WHEN** a PDF is successfully uploaded
- **THEN** the system creates a summary record with 'pending' status and publishes an event to the processing queue

#### Scenario: AI Processing Failure
- **WHEN** the AI service fails to process the PDF after multiple retries
- **THEN** the system updates the summary status to 'failed' and logs the error

### Requirement: Summary Retrieval
The system SHALL provide an endpoint to retrieve the AI-generated summary for a workshop. All authenticated roles (student, staff, admin) SHALL have access to this summary.

#### Scenario: Retrieval of Completed Summary
- **WHEN** a user requests the summary for a workshop where processing is 'done'
- **THEN** the system returns a 200 OK status with the summary text and metadata

#### Scenario: Polling Pending Summary
- **WHEN** a user requests the summary while it is still 'pending' or 'processing'
- **THEN** the system returns a 200 OK status with the current status indicator

### Requirement: Idempotent Re-upload
The system SHALL allow admins to re-upload a PDF for the same workshop. This action MUST reset the current summary status and trigger a new processing cycle.

#### Scenario: Re-upload Updates Summary
- **WHEN** an admin uploads a new PDF for a workshop that already has a summary
- **THEN** the system overwrites the previous record's status to 'pending', clears the old summary, and triggers a new processing event

