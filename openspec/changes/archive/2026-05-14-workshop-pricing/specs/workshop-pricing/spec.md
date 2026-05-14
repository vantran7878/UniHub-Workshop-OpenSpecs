## ADDED Requirements

### Requirement: Admin Workshop Pricing Setup
The system SHALL provide an endpoint `POST /api/admin/workshops/:id/pricing` that allows admins to configure pricing for `paid` workshops.

#### Scenario: Successful pricing setup (create)
- **WHEN** an admin provides valid `base_price`, `currency`, `early_bird_price`, and `early_bird_deadline`
- **AND** the workshop exists and is marked as `paid`
- **AND** `base_price` is greater than 0
- **AND** `early_bird_price` (if provided) is less than `base_price`
- **AND** `early_bird_deadline` (if provided) is before the workshop's `startTime`
- **THEN** the system SHALL create a pricing record for the workshop
- **AND** record a `PRICING_UPDATED` audit log
- **AND** return a `200 OK` response with the pricing details

#### Scenario: Successful pricing setup (update)
- **WHEN** an admin provides valid pricing details for a workshop that already has pricing
- **THEN** the system SHALL update the existing pricing record
- **AND** return a `200 OK` response

#### Scenario: Warning for existing registrations
- **WHEN** an admin updates the price for a workshop that already has one or more registrations
- **THEN** the system SHALL return a `200 OK` response
- **AND** include a `warning` message indicating the number of existing registrations

#### Scenario: Pricing for free workshop
- **WHEN** an admin attempts to set pricing for a workshop with `pricing_type = free`
- **THEN** the system SHALL return a `400 Bad Request` response

#### Scenario: Invalid price validation
- **WHEN** `base_price` is less than or equal to 0
- **OR** `early_bird_price` is greater than or equal to `base_price`
- **THEN** the system SHALL return a `400 Bad Request` response

#### Scenario: Invalid deadline validation
- **WHEN** `early_bird_deadline` is after the workshop's `startTime`
- **THEN** the system SHALL return a `400 Bad Request` response
