# auth-module Specification

## Purpose
TBD - created by archiving change add-authentication. Update Purpose after archive.
## Requirements
### Requirement: User Login with Credentials
The system SHALL provide an endpoint for users to authenticate using their email and password. Upon successful authentication, the system SHALL return an access token (JWT) and a refresh token.

#### Scenario: Successful Login
- **WHEN** a user provides a valid email and correct password to the `/api/auth/login` endpoint
- **THEN** the system returns a 200 OK status with an `accessToken`, a `refreshToken`, and user profile information

#### Scenario: Failed Login - Invalid Credentials
- **WHEN** a user provides an incorrect password or an email that does not exist to the `/api/auth/login` endpoint
- **THEN** the system returns a 401 Unauthorized status with a generic `INVALID_CREDENTIALS` error code

### Requirement: Role-Based Access Control (RBAC)
The system SHALL enforce access control based on three fixed roles: `student`, `admin`, and `staff`. Each role SHALL have specific permissions for accessing endpoints.

#### Scenario: Admin Access to Protected Endpoint
- **WHEN** a user with the `admin` role calls a protected admin-only endpoint (e.g., `POST /api/workshops`) with a valid token
- **THEN** the system allows the request and returns the appropriate response

#### Scenario: Student Access Denied to Admin Endpoint
- **WHEN** a user with the `student` role calls an admin-only endpoint (e.g., `POST /api/workshops`)
- **THEN** the system returns a 403 Forbidden status

### Requirement: JWT Authentication with RS256
The system SHALL use RS256 asymmetric encryption for signing Access Tokens. The Auth Service SHALL hold the private key, and all backend services SHALL verify tokens using the public key.

#### Scenario: Valid JWT Verification
- **WHEN** a backend service receives a request with a valid RS256-signed JWT
- **THEN** the system extracts the user identity and role from the payload and proceeds with the request

#### Scenario: Expired JWT Handling
- **WHEN** a request is made with an expired JWT
- **THEN** the system returns a 401 Unauthorized status with the error code `TOKEN_EXPIRED`

### Requirement: Session Management with Refresh Tokens
The system SHALL support session extension via refresh tokens. Refresh tokens SHALL be opaque strings stored in Redis with a TTL of 7 days.

#### Scenario: Token Refresh Success
- **WHEN** a client provides a valid, unexpired refresh token to the `/api/auth/refresh` endpoint
- **THEN** the system returns a new access token

### Requirement: Rate Limiting for Login
The system SHALL implement rate limiting on the login endpoint to prevent brute-force attacks, allowing a maximum of 5 requests per minute per IP address.

#### Scenario: Rate Limit Exceeded
- **WHEN** an IP address makes more than 5 login attempts within one minute
- **THEN** the system returns a 429 Too Many Requests status with a `Retry-After` header

