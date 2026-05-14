## Context

The UniHub authentication endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`) are exposed to the public internet and are susceptible to brute-force attacks and abuse. We need to introduce rate limiting to throttle excessive requests from individual IPs. Redis is chosen as the state store to support distributed rate limiting across multiple API instances.

## Goals / Non-Goals

**Goals:**
- Implement a distributed rate limiting mechanism using Redis.
- Use a sliding window or fixed window algorithm (Sliding Window is preferred for better accuracy against burst traffic).
- Apply specific rate limits per IP for different auth endpoints:
  - `POST /auth/login`: 10 req / 15 min
  - `POST /auth/register`: 5 req / 1 hour
  - `POST /auth/refresh`: 30 req / 15 min
- Fail-open strategy: If Redis is down, log a warning but allow the request to proceed.

**Non-Goals:**
- Rate limiting for non-authentication endpoints.
- User-based rate limiting (we are only doing IP-based).
- Fail-closed rate limiting (blocking requests if Redis is unavailable).

## Decisions

**1. Rate Limiting Algorithm: Sliding Window**
- *Decision*: Sliding Window algorithm implemented via a robust library like `rate-limiter-flexible` or `@nestjs/throttler` (with Redis adapter). Sliding window is chosen over fixed window to prevent traffic bursts at window boundaries.
- *Rationale*: It provides a smoother rate limiting experience and prevents abuse at the edge of time windows.

**2. Fail-Open Behavior**
- *Decision*: Wrap the rate limit check in a `try-catch` block. If the check throws an error (e.g., Redis connection timeout), catch it, log a warning using the application logger, and allow the request to proceed to the controller.
- *Rationale*: Rate limiting is a defense-in-depth measure. Availability of the authentication service is prioritized over strict rate enforcement in the event of a caching tier failure. This contrasts with token blacklisting, which must fail-closed for security.

**3. Integration Point**
- *Decision*: Implement rate limiting as NestJS Guards or Middleware applied to specific routes.
- *Rationale*: Guards/Middleware provide a clean, declarative way to apply logic before the request reaches the route handler, and can easily extract the client IP.

## Risks / Trade-offs

- **[Risk] Redis unavailability increases load on database**: If Redis goes down and we fail-open, a brute force attack could overwhelm the primary database.
  - *Mitigation*: Ensure robust Redis monitoring and alerting. The fail-open log warning should trigger an immediate alert.
- **[Risk] IP Spoofing or Proxying**: Relying solely on IP for rate limiting might block legitimate users sharing a NAT, or be bypassed by attackers rotating IPs.
  - *Mitigation*: Ensure the application correctly parses the `X-Forwarded-For` header if behind a load balancer/proxy, prioritizing the true client IP.
