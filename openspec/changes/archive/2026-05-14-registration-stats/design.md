## Context

The system currently tracks registrations and pricing, but does not provide an aggregated view of this data for administrators.

## Goals / Non-Goals

**Goals:**
- Provide a single endpoint to retrieve all registration and financial metrics for a workshop.
- Support time-series data for registration trends.
- Handle both free and paid workshops with appropriate field visibility.

**Non-Goals:**
- Data persistence for snapshots (metrics are computed on the fly).
- Support for multiple currencies per workshop (uses the workshop's defined currency).

## Decisions

**1. Metrics Aggregation Strategy**
- *Decision*: Use Prisma's `aggregate` and `groupBy` functions for registrations and revenue.
- *Rationale*: Leverages the database for efficient aggregation rather than fetching all records and processing in memory.

**2. Time-Series Resolution**
- *Decision*: Group registrations by the date part of `createdAt`.
- *Rationale*: Provides a "daily" view as requested, which is suitable for the likely duration of registration periods (days/weeks).

**3. Financial Calculation**
- *Decision*: Revenue is calculated based on registrations with a `confirmed` status.
- *Rationale*: Ensures that only completed registrations contribute to "total_collected".

**4. Performance**
- *Decision*: Ensure indices exist on `workshop_id` and `created_at` in the `registrations` table.
- *Rationale*: Ensures the aggregation operations remain fast as the data grows.

## Risks / Trade-offs

- **[Risk] High load on analytics endpoint**: Frequent calls to complex aggregation queries could impact DB performance.
  - *Mitigation*: Implementation of basic response caching if performance issues arise in production.
