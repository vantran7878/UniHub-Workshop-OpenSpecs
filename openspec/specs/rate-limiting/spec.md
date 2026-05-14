## ADDED Requirements

### Requirement: Login Rate Limiting
The system SHALL limit the number of login requests to 10 requests per IP address within a 15-minute sliding window.

#### Scenario: Exceeding login limit
- **WHEN** an IP address sends its 11th request to `POST /auth/login` within 15 minutes
- **THEN** the system returns a `429 Too Many Requests` status code
- **AND** the response includes a `Retry-After` header indicating the seconds until the limit resets

### Requirement: Registration Rate Limiting
The system SHALL limit the number of registration requests to 5 requests per IP address within a 1-hour sliding window.

#### Scenario: Exceeding registration limit
- **WHEN** an IP address sends its 6th request to `POST /auth/register` within 1 hour
- **THEN** the system returns a `429 Too Many Requests` status code
- **AND** the response includes a `Retry-After` header

### Requirement: Token Refresh Rate Limiting
The system SHALL limit the number of token refresh requests to 30 requests per IP address within a 15-minute sliding window.

#### Scenario: Exceeding refresh limit
- **WHEN** an IP address sends its 31st request to `POST /auth/refresh` within 15 minutes
- **THEN** the system returns a `429 Too Many Requests` status code
- **AND** the response includes a `Retry-After` header

### Requirement: Independent Limits per IP
The system SHALL track rate limits independently for each IP address, such that traffic from one IP does not affect the limits of another.

#### Scenario: Different IPs do not interfere
- **WHEN** IP `A` exceeds its login rate limit
- **THEN** IP `B` can still successfully send login requests
- **AND** IP `B` is only rate limited if it independently exceeds its own limit

### Requirement: Redis Fail-Open
The system SHALL implement a fail-open strategy for rate limiting. If the Redis service is unavailable, the rate limiting check must not block the request.

#### Scenario: Redis is unavailable
- **WHEN** the Redis connection fails or times out during a rate limit check
- **THEN** the system logs a warning indicating the rate limiter failure
- **AND** the request is allowed to proceed to the controller
