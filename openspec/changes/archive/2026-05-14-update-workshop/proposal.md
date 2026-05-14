## Why

Administrators need the ability to update existing workshop details (title, location, capacity, etc.) to handle schedule changes or corrections. Currently, workshops are immutable after creation.

## What Changes

- **Update API**: Implement `PUT /api/admin/workshops/:id` for partial updates of workshop fields.
- **Validation**:
  - Prevent reducing capacity below the current registration count.
  - Enforce `ends_at > starts_at`.
  - Restrict immutable fields (`status`, `created_by`, `pricing_type`).
- **Notification Trigger**: Implement a mechanism to track if critical fields (time, location) change, requiring participant notification.
- **Audit Logging**: Record `WORKSHOP_UPDATED` events with old and new values.

## Capabilities

### Modified Capabilities
- `workshop-management`: Add workshop update requirements and validation rules.

## Impact

- **API**: New endpoint `/api/admin/workshops/:id`.
- **Database**: Add `needs_notification` boolean flag to the `Workshop` model.
- **Audit**: New audit event `WORKSHOP_UPDATED`.

## Non-goals

- Updating pricing details (handled by the pricing setup endpoint).
- Cancelling workshops (handled by a separate cancellation endpoint).
