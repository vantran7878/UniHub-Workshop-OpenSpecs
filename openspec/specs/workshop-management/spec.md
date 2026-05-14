# workshop-management Specification

## Purpose
TBD - created by archiving change create-read-workshop. Update Purpose after archive.
## Requirements
### Requirement: Admin Workshop Creation
The system SHALL provide an endpoint `POST /api/admin/workshops` that allows users with the `admin` role to create new workshops.

#### Scenario: Successful workshop creation
- **WHEN** an admin provides valid `title`, `starts_at`, `ends_at`, `capacity`, and `pricing_type`
- **AND** `ends_at` is greater than `starts_at`
- **AND** `capacity` is greater than 0
- **THEN** the system SHALL create the workshop with `status = draft`
- **AND** set `created_by` to the current admin's ID
- **AND** record a `WORKSHOP_CREATED` audit log
- **AND** return a `201 Created` response with the workshop details

#### Scenario: Validation failure
- **WHEN** any required field is missing
- **OR** `ends_at` is less than or equal to `starts_at`
- **OR** `capacity` is less than or equal to 0
- **THEN** the system SHALL return a `400 Bad Request` response

### Requirement: Admin Workshop Listing
The system SHALL provide an endpoint `GET /api/admin/workshops` that allows admins to view a paginated list of workshops with filtering.

#### Scenario: Listing with filters
- **WHEN** an admin queries workshops with `status`, `pricing_type`, or date range (`from`/`to`)
- **THEN** the system SHALL return a paginated list matching the filters
- **AND** include `registration_count` for each workshop
- **AND** sort by `starts_at DESC` by default

### Requirement: Admin Workshop Details
The system SHALL provide an endpoint `GET /api/admin/workshops/:id` that allows admins to view detailed information about a specific workshop.

#### Scenario: Retrieve workshop detail
- **WHEN** an admin provides a valid workshop ID
- **THEN** the system SHALL return the full workshop object
- **AND** include the `pricing` object (base_price, currency, early_bird_price, early_bird_deadline) if the workshop is `paid`
- **AND** include the total `registration_count`

### Requirement: Admin Workshop Update
The system SHALL provide an endpoint `PUT /api/admin/workshops/:id` that allows admins to update existing workshop information.

#### Scenario: Successful partial update
- **WHEN** an admin provides one or more valid fields (`title`, `description`, `location`, `starts_at`, `ends_at`, `capacity`)
- **AND** the workshop exists and is not `cancelled`
- **AND** the new `capacity` (if provided) is greater than or equal to the current registration count
- **AND** `ends_at` remains greater than `starts_at` after the update
- **THEN** the system SHALL update the workshop record
- **AND** record a `WORKSHOP_UPDATED` audit log
- **AND** return a `200 OK` response with the updated object

#### Scenario: Critical change notification trigger
- **WHEN** an admin updates `starts_at`, `ends_at`, or `location`
- **THEN** the system SHALL set the `needs_notification` flag to `true` on the workshop record

#### Scenario: Update cancelled workshop
- **WHEN** an admin attempts to update a workshop with `status = cancelled`
- **THEN** the system SHALL return a `409 Conflict` response

#### Scenario: Capacity reduction below registrations
- **WHEN** an admin attempts to set `capacity` to a value lower than the current number of registrations
- **THEN** the system SHALL return a `400 Bad Request` response

#### Scenario: Immutable fields restriction
- **WHEN** an admin attempts to update `pricing_type`, `status`, or `created_by`
- **THEN** the system SHALL ignore these fields and proceed with other valid updates

### Requirement: Admin Workshop Cancellation
The system SHALL provide an endpoint `PATCH /api/admin/workshops/:id/cancel` that allows admins to permanently cancel a workshop.

#### Scenario: Successful cancellation
- **WHEN** an admin provides a non-empty `reason`
- **AND** the workshop exists and is not already `cancelled`
- **THEN** the system SHALL set the workshop status to `cancelled`
- **AND** record the `cancelledAt` timestamp and `reason`
- **AND** update all associated registrations to `cancelled` status
- **AND** record a `WORKSHOP_CANCELLED` audit log including the reason and registration count
- **AND** trigger an asynchronous notification job to participants
- **AND** return a `200 OK` response with the cancellation details

#### Scenario: Cancellation of paid workshop with registrations
- **WHEN** a `paid` workshop with existing registrations is cancelled
- **THEN** the system SHALL trigger an asynchronous refund process for all registrations

#### Scenario: Cancellation without reason
- **WHEN** the `reason` field is empty or missing
- **THEN** the system SHALL return a `400 Bad Request` response

#### Scenario: Duplicate cancellation
- **WHEN** an admin attempts to cancel a workshop that is already in `cancelled` status
- **THEN** the system SHALL return a `409 Conflict` response

