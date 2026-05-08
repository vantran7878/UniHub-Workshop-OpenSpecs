## Context

The check-in module must handle high-volume registration verification, often in network-constrained environments. The system relies on a staff-only mobile app that interacts with the backend to ensure students are correctly admitted to workshops.

## Goals / Non-Goals

**Goals:**
- Provide reliable endpoints for staff to perform check-ins.
- Ensure 100% data consistency between check-ins and registration status.
- Support batch synchronization of offline data with conflict resolution.

**Non-Goals:**
- Implementation of the mobile app (Flutter) itself.
- Real-time notification of check-in to students (handled by the notification module).

## Decisions

### Decision 1: Database Schema - Checkins Table
- **Rationale**: A dedicated `checkins` table allows for auditing, including `device_id` and precise `checkin_time`, without cluttering the `registrations` table.
- **Alternatives**: Adding a `checkin_time` column directly to `registrations` was considered but rejected because it wouldn't support auditing multiple attempts or device information as effectively.

### Decision 2: Sync Mechanism - Idempotent Batch Processing
- **Rationale**: Using `INSERT ... ON CONFLICT (registration_id) DO NOTHING` in the sync endpoint ensures that network retries or multiple device syncs don't create duplicate records.
- **Alternatives**: A strictly sequential sync was rejected because it is less resilient to network failures.

### Decision 3: Atomic Status Updates
- **Rationale**: Wrapping the `INSERT INTO checkins` and `UPDATE registrations SET status='attended'` in a database transaction is non-negotiable to prevent a student being "checked in" but still marked as "confirmed" (or vice versa).

## Risks / Trade-offs

- **[Risk]**: Database lock contention during high-volume check-ins → **[Mitigation]**: Keep transactions extremely short and focused; use optimized indexes on `registration_id`.
- **[Risk]**: Time skew between mobile devices during offline scan → **[Mitigation]**: Log both device time and server time; prioritize device time for business logic but server time for system auditing.
