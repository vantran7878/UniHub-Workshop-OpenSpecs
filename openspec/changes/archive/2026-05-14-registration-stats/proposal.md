## Why

Administrators need a centralized way to monitor workshop performance, including registration trends, capacity utilization, and revenue metrics. This data is essential for planning and operational decisions.

## What Changes

- **Analytics API**: Implement `GET /api/admin/workshops/:id/stats` for administrators.
- **Metrics Calculation**:
  - Capacity utilization percentage.
  - Waitlist count.
  - Revenue tracking (collected vs. pending) for paid workshops.
  - Time-series registration data (daily counts over time).

## Capabilities

### New Capabilities
- `workshop-analytics`: Capability for retrieving workshop-specific performance metrics and time-series registration data.

## Impact

- **API**: New endpoint `/api/admin/workshops/:id/stats`.
- **Database**: Complex aggregation queries on the `registrations` table.

## Non-goals

- Global analytics across all workshops (to be handled by a separate dashboard feature).
- Real-time live-updating stats via WebSockets (data will be calculated per-request).
