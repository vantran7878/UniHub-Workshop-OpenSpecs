## MODIFIED Requirements

### Requirement: Admin Workshop Details
The system SHALL provide an endpoint `GET /api/admin/workshops/:id` that allows admins to view detailed information about a specific workshop.

#### Scenario: Retrieve workshop detail
- **WHEN** an admin provides a valid workshop ID
- **THEN** the system SHALL return the full workshop object
- **AND** include the `pricing` object (base_price, currency, early_bird_price, early_bird_deadline) if the workshop is `paid`
- **AND** include the total `registration_count`
