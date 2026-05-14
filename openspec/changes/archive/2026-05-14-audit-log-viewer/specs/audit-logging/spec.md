## ADDED Requirements

### Requirement: Admin Audit Log Retrieval
The system SHALL provide an endpoint `GET /api/admin/audit-logs` that allows administrators to retrieve system-wide audit logs.

#### Scenario: Successful log retrieval with filtering
- **WHEN** an admin requests audit logs with filters for `action`, `actor_id`, and `from`/`to` dates
- **THEN** the system SHALL return a paginated list of matching audit log entries
- **AND** each entry SHALL include the actor's name and the event metadata

#### Scenario: Unauthorized access
- **WHEN** a non-admin user attempts to access the audit logs endpoint
- **THEN** the system SHALL return a `403 Forbidden` response

### Requirement: Explicit Capacity Change Tracking
The system SHALL explicitly log a `CAPACITY_CHANGED` event whenever a workshop's capacity is updated.

#### Scenario: Logging capacity change during workshop update
- **WHEN** an admin updates a workshop and changes the `capacity` value
- **THEN** the system SHALL record a `WORKSHOP_UPDATED` event
- **AND** record a separate `CAPACITY_CHANGED` event capturing the `old_capacity` and `new_capacity`
