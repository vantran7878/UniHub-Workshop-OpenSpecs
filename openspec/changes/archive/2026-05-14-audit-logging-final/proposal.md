## Why

Ensuring system accountability and transparency is critical for workshop management. This proposal defines a standardized audit logging framework to record administrative actions and provide a centralized viewer for tracking modifications, pricing updates, and capacity changes.

## What Changes

- **Standardized Audit Service**: Finalize the `auditLog` service to support specific event types and metadata structures across the workshop module.
- **Audit Viewer API**: Implement `GET /api/admin/audit-logs` with support for filtering by `entity_type`, `entity_id`, `event_type`, and `admin_id`.
- **Explicit Event Tracking**: Ensure all sensitive actions (Create, Update, Cancel, Publish, Pricing, Capacity) are logged with detailed metadata (old vs new values, actor, IP).
- **Append-only Constraint**: Enforce that audit logs are immutable and cannot be modified or deleted through the API.

## Capabilities

### New Capabilities
- `audit-logging`: Capability for system-wide administrative action tracking and log retrieval for administrative review.

## Impact

- **API**: Standardized endpoint `/api/admin/audit-logs` with specific query parameters and response structure.
- **Controllers**: Integration of audit logging into all workshop-related administrative endpoints.
- **Security**: Ensures a complete trail of administrative actions for compliance and troubleshooting.

## Non-goals

- Real-time audit alerts (e.g., instant notifications on specific logs).
- Implementation of audit log archiving or automated cleanup policies.
