## Why

Workshops may need to be cancelled due to various reasons (instructor illness, low enrollment, etc.). The system needs a formal way to handle cancellations, including notifying participants and triggering refunds for paid sessions.

## What Changes

- **Cancellation API**: Implement `PATCH /api/admin/workshops/:id/cancel` for administrators.
- **State Management**:
  - Update workshop status to `cancelled`.
  - Mark all existing registrations for the workshop as `cancelled` (non-destructive).
- **Asynchronous Integrations**:
  - Trigger email notifications to all registered participants with the cancellation reason.
  - Initiate automated refund processes for paid workshops with existing registrations.
- **Audit Logging**: Record `WORKSHOP_CANCELLED` events with the provided reason and registration count at the time of cancellation.

## Capabilities

### Modified Capabilities
- `workshop-management`: Add workshop cancellation requirements and post-cancellation state rules.

## Impact

- **API**: New endpoint `/api/admin/workshops/:id/cancel`.
- **Database**: Add `cancelledAt` (DateTime) and `cancelledReason` (String) fields to the `Workshop` model.
- **Background Jobs**: Integration with notification and refund services (fire-and-forget).
- **Audit**: New audit event `WORKSHOP_CANCELLED`.

## Non-goals

- Re-opening a cancelled workshop (cancellation is permanent in this scope).
- Handling complex refund partialities (full refund triggered for all registrations).
