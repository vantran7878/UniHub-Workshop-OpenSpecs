## ADDED Requirements

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
