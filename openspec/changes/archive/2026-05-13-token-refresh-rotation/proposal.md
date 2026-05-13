## Why

To maintain a secure and seamless user experience, we need a mechanism to issue new short-lived access tokens without forcing the user to log in again. Implementing a refresh token rotation strategy ensures that compromised tokens are invalidated and continuous access is tightly controlled.

## What Changes

- Implement the `POST /auth/refresh` endpoint.
- Read the refresh token strictly from the `HttpOnly` cookie.
- Hash the incoming token and verify its existence in Redis.
- Implement token rotation: delete the old token hash from Redis, generate new access and refresh tokens, and store the new refresh token hash in Redis.
- Set the new refresh token in the `HttpOnly` cookie.
- Gracefully handle Redis unavailability by returning a `503 Service Unavailable` response to prevent system crashes.
- Log `TOKEN_REFRESH` events via the audit log.

## Non-goals

- We will not implement JWT access token verification middleware in this endpoint (it only relies on the refresh token cookie).
- We will not implement the logout endpoint here.

## Capabilities

### New Capabilities
- `token-refresh-rotation`: Defines the policies and flow for securely rotating refresh tokens.

### Modified Capabilities

## Impact

- **API**: Adds one new route `POST /auth/refresh`.
- **Security**: Strengthens session security through one-time use refresh tokens (rotation).
- **Infrastructure**: Increases Redis interaction; adds specific error handling for Redis downtime.
