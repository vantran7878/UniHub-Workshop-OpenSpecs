## 1. API Refinement

- [ ] 1.1 Update `GET /api/admin/audit-logs` query parameter handling to support `entity_type`, `entity_id`, `event_type`, and `admin_id`.
- [ ] 1.2 Transform the API response structure to match the user's request precisely (using field names like `event_type`, `entity_type`, `ip_address`).

## 2. Event Logging Integration

- [ ] 2.1 Ensure `WORKSHOP_CREATED` is logged with required metadata in the workshop creation handler.
- [ ] 2.2 Ensure `WORKSHOP_UPDATED` and `CAPACITY_CHANGED` are logged correctly in the workshop update handler.
- [ ] 2.3 Ensure `WORKSHOP_CANCELLED` is logged with the reason and registration count in the cancellation handler.
- [ ] 2.4 Ensure `PRICING_UPDATED` is logged in the workshop pricing update handler.
- [ ] 2.5 Verify that the `auditLog` service correctly captures and sanitizes metadata.

## 3. Integration & Testing

- [ ] 3.1 Verify that filtering by `entity_type`, `entity_id`, and `event_type` works as expected in the retrieval API.
- [ ] 3.2 Verify that the `metadata` field in the API response correctly reflects the changes (old vs new values).
- [ ] 3.3 Confirm that no endpoints allow for the modification or deletion of existing audit logs.
- [ ] 3.4 Verify that access to the audit log viewer is strictly limited to users with the `admin` role.
