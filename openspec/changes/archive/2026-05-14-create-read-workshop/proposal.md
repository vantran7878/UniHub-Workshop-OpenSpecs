## Why

To support the core functionality of workshop management, administrators need the ability to create new workshops and retrieve workshop information (list and details). This establishes the foundational lifecycle for workshops on the platform.

## What Changes

- Implement `POST /api/admin/workshops` for creating workshops with validation, default status, and audit logging.
- Implement `GET /api/admin/workshops` for listing workshops with filtering, pagination, and registration counts.
- Implement `GET /api/admin/workshops/:id` for retrieving detailed workshop information, including pricing (if applicable).
- Integrate audit logging for workshop creation events.

## Capabilities

### New Capabilities
- `workshop-management`: Capability for administrative workshop creation and retrieval operations.

### Modified Capabilities
<!-- None -->

## Impact

- **API**: New endpoints under `/api/admin/workshops`.
- **Database**: Interactions with `workshops`, `workshop_pricing`, and `registrations` tables.
- **Security**: Access restricted to users with the `admin` role.

## Non-goals

- Updating or cancelling workshops (handled in a separate change).
- Managing workshop pricing details (handled in a separate change).
- Public-facing workshop discovery (handled in a separate change).
