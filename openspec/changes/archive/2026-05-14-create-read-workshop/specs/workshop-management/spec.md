## ADDED Requirements

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
- **AND** include pricing information if the workshop is `paid`
- **AND** include the total `registration_count`
