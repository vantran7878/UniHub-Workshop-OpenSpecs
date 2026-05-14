## Context

Users need a way to end their sessions (`/auth/logout`), which should immediately invalidate their refresh token to prevent further access token issuance. Furthermore, we need an internal mechanism to invalidate *all* active sessions for a user if a security-critical event occurs (e.g., password change or role modification).

## Goals / Non-Goals

**Goals:**
- Implement `POST /auth/logout`.
- Clear the client's `refresh_token` cookie.
- Delete the specific refresh token hash from Redis.
- Log the `LOGOUT` event in `AuditLog`.
- Refactor Redis storage structure to use a Set `user:${userId}:refresh_tokens` holding all active refresh token hashes for that user, to easily support bulk deletion.
- Implement an internal utility `blacklistAllTokens(userId: string)` to clear all tokens for a user.

**Non-Goals:**
- Invalidating currently active JWT Access Tokens. They are stateless and will remain valid until their natural 15-minute expiration.
- Implementing the actual API routes for password changes or role modifications in this change. We are only building the underlying token invalidation mechanism.

## Decisions

- **Redis Storage Migration**: 
  - *Current*: `refresh_token:${hash}` -> `userId`.
  - *New*: We will use a Redis Set `user:${userId}:refresh_tokens` that contains the hashes, AND maintain the string keys `refresh_token:${hash}` for fast lookup during normal token rotation. 
  - *Rationale*: A Set allows us to find all tokens belonging to a user in O(1) time without using the expensive `KEYS` command. When `blacklistAllTokens` is called, we can read the Set, delete all associated string keys, and then delete the Set itself.
- **Client-side clearing**: Return a `Set-Cookie` header with an expiration date in the past to clear the cookie on the client side.
- **Response Code**: `204 No Content` for successful logout since there is no body to return.

## Risks / Trade-offs

- [Risk] **Stateless JWTs**: Access tokens remain valid for up to 15 minutes after logout or blacklisting.
  - Mitigation: The 15-minute TTL is short enough to mitigate most risks. This is a deliberate architectural trade-off to avoid the latency of checking Redis on every API request.
