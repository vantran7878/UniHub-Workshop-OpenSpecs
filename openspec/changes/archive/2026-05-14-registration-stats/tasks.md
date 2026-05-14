## 1. Setup & Discovery

- [x] 1.1 Verify indices on `registrations` table (`workshop_id`, `created_at`).

## 2. API Implementation

- [x] 2.1 Implement `GET /api/admin/workshops/:id/stats` endpoint.
- [x] 2.2 Implement registration count and utilization calculation.
- [x] 2.3 Implement revenue aggregation logic for `paid` workshops.
- [x] 2.4 Implement `registrations_over_time` daily grouping logic using Prisma `groupBy`.

## 3. Integration & Testing

- [x] 3.1 Verify that `revenue` is `null` for `free` workshops.
- [x] 3.2 Verify `capacity_used_pct` rounding logic.
- [x] 3.3 Verify daily registration counts match the source data.
- [x] 3.4 Verify total revenue matches the sum of confirmed registration prices.
