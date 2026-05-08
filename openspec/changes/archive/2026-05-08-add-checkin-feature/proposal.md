## Why

The UniHub Workshop system needs a reliable way to verify student attendance at the event. Relying on manual check-in is inefficient and cannot handle the scale of parallel workshops. A digital check-in system with offline support is critical to ensure that staff can process check-ins quickly even in areas with poor network connectivity.

## What Changes

- **Backend Endpoints**: Implement endpoints for preloading student data, real-time check-in, and batch offline synchronization.
- **Data Integrity**: Ensure atomic updates between check-in records and registration statuses.
- **Concurrency & Idempotency**: Use database constraints and idempotent logic to handle simultaneous check-ins and duplicate sync requests.
- **Offline Protocol**: Support a preload-scan-sync workflow that prevents data loss during network outages.

## Capabilities

### New Capabilities
- `checkin-module`: Provides the backend infrastructure for preloading, online check-in, and offline synchronization, as defined in the check-in specification.

### Modified Capabilities
<!-- No existing capabilities are being modified at the specification level. -->

## Impact

- **Database**: Introduces the `checkins` table and requires updates to the `registrations` table status.
- **API**: Adds new protected endpoints under `/api/checkin/*` restricted to staff.
- **Architecture**: Implements a robust batch sync mechanism with conflict resolution.
