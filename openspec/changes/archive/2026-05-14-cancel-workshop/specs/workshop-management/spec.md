## ADDED Requirements

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
