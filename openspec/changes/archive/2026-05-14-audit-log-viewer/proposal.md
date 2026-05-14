## Why

Administrators need to track critical actions within the system for accountability, troubleshooting, and compliance. Providing a centralized interface to view and filter audit logs ensures visibility into workshop modifications, cancellations, and pricing updates.

## What Changes

- **Audit Log API**: Implement `GET /api/admin/audit-logs` for administrators.
- **Filtering & Pagination**: Add support for filtering by event type, date range, actor, and resource ID.
- **Specific Event Logging**: Implement explicit `CAPACITY_CHANGED` logging in the workshop update flow.

## Capabilities

### New Capabilities
- `audit-logging`: Capability for retrieving and filtering system-wide audit logs for administrative review.

## Impact

- **API**: New endpoint `/api/admin/audit-logs`.
- **Workshop Controller**: Add explicit logging for capacity changes during updates.
- **Database**: Retrieval from the `audit_logs` table.

## Non-goals

- Real-time audit log streaming (e.g., via WebSockets).
- Ability to modify or delete audit logs (the data must remain append-only).
