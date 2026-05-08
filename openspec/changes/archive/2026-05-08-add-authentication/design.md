## Context

The UniHub Workshop system requires a robust authentication layer. Currently, the system has no user verification, allowing unauthorized access to sensitive operations like workshop management and registration. This design outlines a stateless authentication system using JWTs and Redis-backed session management.

## Goals / Non-Goals

**Goals:**
- Implement secure login for three distinct user roles.
- Ensure stateless scalability using JWTs.
- Provide a mechanism to revoke sessions via refresh token blacklisting.
- Protect against brute-force attacks on login.

**Non-Goals:**
- Social login or SSO integration (to be considered in future phases).
- Dynamic permission management (roles are fixed).
- Password recovery flow (out of scope for this initial implementation).

## Decisions

### Decision 1: JWT Algorithm - RS256
- **Rationale**: RS256 (Asymmetric) allows backend services to verify tokens using a public key without needing the private key held by the Auth Service. This improves security and separation of concerns compared to HS256 (Symmetric).
- **Alternatives**: HS256 was considered but rejected because it requires sharing a secret across all services, increasing the attack surface.

### Decision 2: Refresh Token Storage - Redis
- **Rationale**: Redis provides high-performance, TTL-based storage perfect for opaque refresh tokens. It also supports atomic operations for blacklisting JWT IDs (jti) during logout.
- **Alternatives**: Storing refresh tokens in PostgreSQL was considered but rejected due to higher latency and the overhead of managing TTLs manually.

### Decision 3: Rate Limiting - Token Bucket (Redis + Lua)
- **Rationale**: Implementing rate limiting in Redis using a Lua script ensures atomicity and prevents race conditions in a distributed environment. The Token Bucket algorithm provides a smooth rate limit with support for bursts.
- **Alternatives**: Simple counter-based limiting was rejected as it is less flexible and prone to "edge-of-window" bursts.

## Risks / Trade-offs

- **[Risk]**: Private key compromise → **[Mitigation]**: Secure key management (environment variables/secrets manager) and support for key rotation (though rotation will invalidate all current access tokens).
- **[Risk]**: Redis downtime → **[Mitigation]**: Implement "fail-open" for blacklisting checks (availability over strict revocation for the 15-minute JWT window), but "fail-closed" for login/refresh.
