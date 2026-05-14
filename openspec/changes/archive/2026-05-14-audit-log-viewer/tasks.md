## 1. Explicit Logging

- [x] 1.1 Update `PUT /api/admin/workshops/:id` to explicitly log `CAPACITY_CHANGED` when the capacity is modified.

## 2. API Implementation

- [x] 2.1 Define `AuditLogQuerySchema` using Zod for filtering and pagination parameters.
- [x] 2.2 Implement `GET /api/admin/audit-logs` endpoint.
- [x] 2.3 Implement the filtering logic for `action`, `actor_id`, `resource_id`, and date ranges.
- [x] 2.4 Implement the pagination logic and response enrichment (join with User for names).

## 3. Integration & Testing

- [x] 3.1 Verify that non-admin users cannot access the audit logs API.
- [x] 3.2 Verify that updating workshop capacity triggers both `WORKSHOP_UPDATED` and `CAPACITY_CHANGED` events.
- [x] 3.3 Verify that filtering by query parameters returns the correctly filtered subset of logs.
- [x] 3.4 Verify that actor names are correctly included in the API response.
