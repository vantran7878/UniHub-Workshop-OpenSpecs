## Context

Tokens issued during login have a short TTL (15 minutes) for security. When the access token expires, clients need a way to obtain a new one without requiring the user to re-enter their credentials. This is handled by the `/auth/refresh` endpoint using the long-lived refresh token stored in an HTTP-only cookie.

## Goals / Non-Goals

**Goals:**
- Implement `POST /auth/refresh`.
- Read the refresh token from the request cookies.
- Validate the token against Redis (ensuring it exists and is not expired/blacklisted).
- Enforce token rotation: generate a completely new refresh token and invalidate the old one upon successful refresh.
- Issue a new access token (15 min TTL).
- Handle Redis connection errors gracefully (`503 Service Unavailable`).
- Log the `TOKEN_REFRESH` event in `AuditLog`.

**Non-Goals:**
- Implementing the logout/blacklisting endpoint (`/auth/logout`).
- Supporting multiple active sessions globally (Redis handles this implicitly by mapping token hashes to user IDs).

## Decisions

- **Token Rotation**: Every successful refresh issues a new refresh token and deletes the old one from Redis.
  - *Rationale*: If a refresh token is stolen, the attacker can only use it once. If the legitimate user then tries to use their token (which has been rotated out), they will be denied, signaling a potential breach and forcing a re-login.
- **Graceful Degradation**: If the Redis client throws a connection error, catch it and return `503`.
  - *Rationale*: Authentication depends entirely on Redis state for refresh validation. We cannot fail open (allow refresh) and should not crash the server. `503` informs the client to retry later.

## Risks / Trade-offs

- [Risk] **Race Conditions in Rotation**: If a client sends multiple concurrent refresh requests with the same token, only the first will succeed; others will fail with `401`.
  - Mitigation: Clients should serialize their refresh token requests. For this MVP, we accept this standard behavior.
