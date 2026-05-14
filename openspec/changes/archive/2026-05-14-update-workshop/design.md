## Context

Workshops currently cannot be modified after creation. Admins need to adjust details like capacity and room assignments dynamically.

## Goals / Non-Goals

**Goals:**
- Provide a partial update endpoint for workshops.
- Enforce business rules (capacity, timing, immutability).
- Detect critical changes (time, location) for downstream notification systems.
- Audit all modifications.

**Non-Goals:**
- Real-time notification delivery (only setting the flag).
- Changing status (handled by specific transition endpoints like cancel/publish).

## Decisions

**1. Data Model Modification**
- *Decision*: Add `needsNotification` (Boolean, default false) to the `Workshop` model.
- *Rationale*: Simple way to flag records for an asynchronous notification worker to process.

**2. Immutability via API Contract**
- *Decision*: Explicitly filter the request body in the handler to only allow specific fields (`title`, `description`, `room`, `startTime`, `endTime`, `capacity`).
- *Rationale*: Prevents accidental or malicious modification of `pricing_type`, `status`, or `createdBy`.

**3. Validation Logic**
- *Decision*: Fetch the current state (specifically registration count) before updating.
- *Rationale*: Necessary to enforce the `capacity >= registrations` rule.

**4. Diffing for Audit Logs**
- *Decision*: Compare the request body with the current database state before applying updates.
- *Rationale*: Allows precise recording of which fields changed in the audit log.

## Risks / Trade-offs

- **[Risk] Reducing capacity while a registration is in progress**: A user might start registration while the capacity is being reduced.
  - *Mitigation*: The capacity check in the registration flow should always check the database's latest capacity value.
