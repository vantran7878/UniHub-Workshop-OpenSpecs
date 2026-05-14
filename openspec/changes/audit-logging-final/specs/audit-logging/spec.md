## ADDED Requirements

### Requirement: Admin Audit Log Retrieval
The system SHALL provide an endpoint `GET /api/admin/audit-logs` that allows administrators to retrieve system-wide audit logs with specific filters.

#### Scenario: Successful log retrieval with required filters
- **WHEN** an admin requests audit logs with filters for `entity_type`, `entity_id`, `event_type`, and `admin_id`
- **THEN** the system SHALL return a paginated list of audit log entries matching the criteria
- **AND** the response SHALL follow the requested structure including `id`, `event_type`, `entity_type`, `entity_id`, `metadata`, `ip_address`, and `created_at`

#### Scenario: Unauthorized access to audit logs
- **WHEN** a non-admin user attempts to access the `GET /api/admin/audit-logs` endpoint
- **THEN** the system SHALL return a `403 Forbidden` response

### Requirement: Explicit Tracking of Sensitive Workshop Events
The system SHALL log explicit audit events for critical workshop modifications.

#### Scenario: Logging workshop creation
- **WHEN** an admin creates a new workshop
- **THEN** the system SHALL record a `WORKSHOP_CREATED` event with `workshop_id`, `title`, and actor details

#### Scenario: Logging capacity change
- **WHEN** an admin updates a workshop and modifies the `capacity`
- **THEN** the system SHALL record a separate `CAPACITY_CHANGED` event containing `old_capacity` and `new_capacity`

#### Scenario: Logging pricing updates
- **WHEN** an admin updates the pricing of a workshop
- **THEN** the system SHALL record a `PRICING_UPDATED` event with the `old_value` and `new_value` of the pricing details
