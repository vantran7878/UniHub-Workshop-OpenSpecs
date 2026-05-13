## ADDED Requirements

### Requirement: Refresh Token Validation
The system MUST validate the incoming refresh token securely from the HTTP-only cookie.

#### Scenario: Missing cookie
- **WHEN** a client calls the refresh endpoint without a `refresh_token` cookie
- **THEN** the API MUST return `401 Unauthorized`.

#### Scenario: Invalid or rotated token
- **WHEN** a client calls the refresh endpoint with a token that does not exist in Redis (e.g., already used, expired, or bogus)
- **THEN** the API MUST return `401 Unauthorized`.

### Requirement: Token Rotation
The system MUST rotate refresh tokens on every successful use to prevent replay attacks.

#### Scenario: Successful refresh
- **WHEN** a client calls the refresh endpoint with a valid token
- **THEN** the API MUST:
  1. Delete the old token's hash from Redis.
  2. Issue a new RS256 access token.
  3. Generate a new opaque refresh token, hash it, and store it in Redis (7-day TTL).
  4. Return `200 OK` with the new access token.
  5. Set the new refresh token in a new `Set-Cookie` header.

### Requirement: Infrastructure Resilience
The system MUST handle dependency failures gracefully.

#### Scenario: Redis unavailability
- **WHEN** Redis is down or unreachable during a refresh attempt
- **THEN** the API MUST return `503 Service Unavailable` instead of crashing.
