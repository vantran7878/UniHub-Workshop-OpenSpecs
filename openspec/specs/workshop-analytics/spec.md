# workshop-analytics Specification

## Purpose
TBD - created by archiving change registration-stats. Update Purpose after archive.
## Requirements
### Requirement: Workshop Registration Statistics
The system SHALL provide an endpoint `GET /api/admin/workshops/:id/stats` that returns aggregated registration and financial data for a specific workshop.

#### Scenario: Successful stats retrieval (Paid Workshop)
- **WHEN** an admin requests stats for a `paid` workshop with registrations
- **THEN** the system SHALL return the registration count and waitlist count
- **AND** return `capacity_used_pct` rounded to 1 decimal place
- **AND** return a `revenue` object with `total_collected`, `currency`, and `pending_count`
- **AND** return `registrations_over_time` grouped by date with `count_type: "daily"`

#### Scenario: Successful stats retrieval (Free Workshop)
- **WHEN** an admin requests stats for a `free` workshop
- **THEN** the system SHALL return `revenue: null` in the response

#### Scenario: Stats for non-existent workshop
- **WHEN** an admin requests stats for a workshop ID that does not exist
- **THEN** the system SHALL return a `404 Not Found` response

