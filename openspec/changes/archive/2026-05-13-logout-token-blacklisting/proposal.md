## Why

Users must be able to securely terminate their sessions. Additionally, the system requires a mechanism to immediately revoke access for all active sessions when security-critical events occur (e.g., password changes, administrative role modifications) to prevent unauthorized access.

## What Changes

- Implement the `POST /auth/logout` endpoint.
- Read the active refresh token from the `HttpOnly` cookie and delete it from Redis.
- Clear the client's `refresh_token` cookie by setting it with an expired date.
- Return a `204 No Content` response on successful logout.
- Record a `LOGOUT` event in the audit log.
- **BREAKING**: Modify the Redis storage strategy for refresh tokens. Map them to a user-specific key pattern (`refresh_token:<userId>:<hash>`) to allow bulk deletion of all tokens for a single user.
- Implement an internal `blacklistAllTokens(userId: string)` utility function that deletes all active refresh tokens for a specific user.

## Non-goals

- Access tokens are stateless and cannot be immediately revoked. They will remain valid until their 15-minute natural expiration. This is an accepted architectural trade-off for performance.
- We will not implement the actual triggers (password change, admin role change) in this specific change, but we will provide the `blacklistAllTokens` utility they will call.

## Capabilities

### New Capabilities
- `logout-token-blacklisting`: Defines the logout flow and the token invalidation/blacklisting policies.

### Modified Capabilities

## Impact

- **API**: Adds one new route `POST /auth/logout`.
- **Infrastructure**: Modifies the Redis data structure used to store refresh tokens to enable user-centric querying and bulk deletion.
