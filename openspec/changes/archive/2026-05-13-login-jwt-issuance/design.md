## Context

The UniHub system must authenticate users (students, staff, admin) via the `POST /auth/login` endpoint and issue JSON Web Tokens (JWT) for subsequent stateless requests. To ensure security, we must decouple the short-lived access token from a long-lived refresh mechanism.

## Goals / Non-Goals

**Goals:**
- Implement `POST /auth/login` to accept `email` and `password`.
- Validate the credentials against the database using `bcrypt`.
- Issue a RS256-signed Access Token containing `sub` (user_id), `role`, `iat`, and `exp` with a 15-minute TTL.
- Issue an opaque Refresh Token with a 7-day TTL, set via an `HTTP-Only`, `Secure`, `SameSite=Strict` cookie.
- Store a SHA-256 hash of the Refresh Token in Redis to allow centralized revocation.
- Log `LOGIN_SUCCESS` and `LOGIN_FAILURE` audit events.

**Non-Goals:**
- Implementing the `POST /auth/refresh` endpoint itself.
- Implementing the `POST /auth/logout` endpoint.

## Decisions

- **Token Signing Algorithm**: `RS256` (Asymmetric).
  - *Rationale*: RS256 allows our future gateway or microservices to verify the token using only the public key without needing access to the private signing key, enhancing overall system security.
- **Refresh Token Format**: Opaque random string (`crypto.randomBytes`).
  - *Rationale*: Opaque tokens don't carry internal state and can be securely checked against a data store (Redis) for revocation.
- **Refresh Token Storage**: Redis with SHA-256 hashing.
  - *Rationale*: We hash the token in Redis so that if Redis is compromised, the attacker cannot use the hashes to authenticate. Redis's native TTL feature handles the 7-day expiration automatically.
- **Error Handling**: Generic messages for `401 Unauthorized` ("Invalid credentials").
  - *Rationale*: Prevents user enumeration attacks where an attacker could deduce if an email exists by analyzing differing response messages.

## Risks / Trade-offs

- [Risk] **Redis dependency**: Login fails or refresh mechanism breaks if Redis is down.
  - Mitigation: Ensure Redis cluster high availability.
- [Risk] **RS256 Key Management**: Private keys need to be securely stored and injected via environment variables.
  - Mitigation: Use a secure secrets manager or properly configured `.env` in production deployments.
