# checkin-module Specification

## Purpose
TBD - created by archiving change add-checkin-feature. Update Purpose after archive.
## Requirements
### Requirement: Preload Valid QR Codes
The system SHALL provide an endpoint to fetch all confirmed registrations for a specific workshop. This data MUST include the `qr_code`, student's full name, and student ID to allow for offline validation.

#### Scenario: Successful Preload
- **WHEN** a staff user calls `GET /api/checkin/preload?workshop_id={id}`
- **THEN** the system returns a 200 OK status with a list of all confirmed registration records for that workshop

### Requirement: Real-time Online Check-in
The system SHALL provide an endpoint for real-time check-in. The system MUST verify the QR code's validity, ensure it belongs to the correct workshop, and check that the student hasn't already checked in.

#### Scenario: Successful Online Check-in
- **WHEN** a staff user submits a valid `qr_code` and `workshop_id` to `POST /api/checkin`
- **THEN** the system creates a check-in record, updates the registration status to `attended`, and returns a 200 OK status

#### Scenario: Duplicate Check-in Attempt
- **WHEN** a staff user submits a `qr_code` that has already been checked in
- **THEN** the system returns a 409 Conflict status with the original check-in time

### Requirement: Batch Offline Synchronization
The system SHALL provide an idempotent endpoint to sync check-in records captured offline. The system MUST process these in batches and handle potential conflicts (e.g., if a student was already checked in online).

#### Scenario: Successful Batch Sync
- **WHEN** a staff user submits a batch of check-in records to `POST /api/checkin/sync-offline`
- **THEN** the system processes all valid records, skips duplicates using `ON CONFLICT DO NOTHING`, and returns a summary of successes and conflicts

### Requirement: Atomic Check-in Processing
The system MUST ensure that creating a check-in record and updating the registration status to `attended` happen within a single database transaction.

#### Scenario: Transactional Integrity
- **WHEN** an error occurs while updating the registration status during a check-in
- **THEN** the system rolls back the check-in record creation to maintain data consistency

