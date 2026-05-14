## Why

The authentication endpoints (login, register, refresh) are currently vulnerable to brute-force attacks and abuse. Implementing rate limiting using Redis will protect these critical endpoints from excessive requests, acting as a defense-in-depth mechanism.

## What Changes

- Implement a Redis-based rate limiter (sliding window or fixed window).
- Apply rate limits to specific authentication endpoints based on IP address:
  - `POST /auth/login`: 10 requests / IP / 15 minutes.
  - `POST /auth/register`: 5 requests / IP / 1 hour.
  - `POST /auth/refresh`: 30 requests / IP / 15 minutes.
- Return `429 Too Many Requests` status code when limits are exceeded, including a `Retry-After: <seconds>` header.
- Implement fail-open behavior: if Redis is unavailable, rate limiting is bypassed (requests are not blocked) and a warning log is recorded.

## Capabilities

### New Capabilities
- `rate-limiting`: Rate limiting mechanism using Redis with fail-open behavior, applied specifically to authentication endpoints.

### Modified Capabilities
<!-- No modified capabilities -->

## Impact

- **APIs**: The response behavior of `/auth/login`, `/auth/register`, and `/auth/refresh` will change to include `429` status codes and `Retry-After` headers when limits are exceeded.
- **Dependencies**: Redis is introduced as a dependency for the rate limiter.
- **Code**: New rate limiting middleware/service needs to be integrated into the authentication routes.

## Non-goals

- Implementing rate limiting for non-authentication endpoints at this time.
- Implementing a fail-closed mechanism for rate limiting (if Redis goes down, requests will continue to flow to maintain availability).
