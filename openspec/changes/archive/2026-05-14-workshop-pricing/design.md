## Context

The current `Workshop` model only has a single `price` field. The platform requires more complex pricing (e.g., currency, early bird) which is better handled by a separate table.

## Goals / Non-Goals

**Goals:**
- Extend the data model to support complex pricing.
- Implement an idempotent (upsert) endpoint for pricing configuration.
- Integrate validation logic that considers the workshop's own timing (`startTime`).
- Provide audit trails for all pricing changes.

**Non-Goals:**
- Historical price tracking (only current price is stored).
- Multiple currencies per workshop.

## Decisions

**1. Data Model Extension**
- *Decision*: Create a `WorkshopPricing` model with a 1:1 relationship to `Workshop`.
- *Rationale*: Keeps the main `Workshop` table lean. Allows optional pricing details (only for paid workshops).

**2. Upsert Implementation**
- *Decision*: Use Prisma's `upsert` functionality.
- *Rationale*: Ensures that calling the endpoint multiple times is safe and results in a single consistent state.

**3. Validation with Cross-Entity Context**
- *Decision*: Fetch the `Workshop` details (specifically `startTime` and `isPaid`) before validating the pricing payload.
- *Rationale*: Needed to ensure `early_bird_deadline` is valid relative to the workshop's start time and to prevent setting pricing for "free" workshops.

**4. Registration Count Check**
- *Decision*: Perform a count of registrations before updating.
- *Rationale*: Required to issue the `warning` response field as per the spec.

## Risks / Trade-offs

- **[Risk] Race conditions during upsert**: Two simultaneous requests might try to create the same record.
  - *Mitigation*: Use a unique constraint on `workshop_id` in the `WorkshopPricing` model to ensure atomicity.
