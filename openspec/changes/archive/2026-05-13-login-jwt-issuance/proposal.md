## Why

The system requires a secure authentication mechanism for users to log in and obtain credentials for accessing protected endpoints. Implementing a robust JWT and refresh token strategy ensures secure, stateless authentication while maintaining a good user experience.

## What Changes

- Implement the `POST /auth/login` endpoint.
- Verify user credentials (email and password via bcrypt).
- Issue short-lived (15 min) RS256-signed JWT Access Tokens for stateless authorization.
- Issue long-lived (7 days) opaque Refresh Tokens, securely stored in an HTTP-only, Secure, SameSite=Strict cookie.
- Store refresh token hashes in Redis to support immediate revocation upon logout or security breach.
- Standardize authentication error responses to a generic `401 Unauthorized` with `"Invalid credentials"` to prevent user enumeration.
- Log authentication events (`LOGIN_SUCCESS` / `LOGIN_FAILURE`) to the database.

## Non-goals

- Implementing the token refresh endpoint (`POST /auth/refresh`) is out of scope for this change and will be handled separately.
- Implementing the logout endpoint is out of scope.
- Password reset functionality is not included.

## Capabilities

### New Capabilities
- `login-jwt-issuance`: Defines the behavior, security policies, and token formats for the core authentication endpoint.

### Modified Capabilities

## Impact

- **API**: Adds one new route `POST /auth/login`.
- **Security**: Introduces RS256 key pair requirements and secure cookie handling.
- **Infrastructure**: Requires Redis for refresh token storage and validation.
