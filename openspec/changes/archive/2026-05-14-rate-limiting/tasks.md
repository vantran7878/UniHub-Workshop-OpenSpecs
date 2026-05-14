## 1. Setup & Configuration

- [x] 1.1 Install rate limiting and Redis dependencies (e.g., `rate-limiter-flexible`, `ioredis`, or equivalent framework libraries like `@nestjs/throttler` and `throttler-storage-redis`).
- [x] 1.2 Configure Redis connection for the rate limiter within the application.
- [x] 1.3 Add environment variables for Redis configuration (e.g., `REDIS_HOST`, `REDIS_PORT`) if not already present.

## 2. Core Implementation

- [x] 2.1 Implement the rate limiting service/middleware with sliding window logic.
- [x] 2.2 Configure rate limit rules for `POST /auth/login` (10 requests / 15 minutes).
- [x] 2.3 Configure rate limit rules for `POST /auth/register` (5 requests / 1 hour).
- [x] 2.4 Configure rate limit rules for `POST /auth/refresh` (30 requests / 15 minutes).
- [x] 2.5 Implement fail-open behavior: intercept Redis connection or execution errors, log a warning via the application logger, and allow the request to proceed.
- [x] 2.6 Ensure responses format `429 Too Many Requests` status codes and include the `Retry-After` header.
- [x] 2.7 Configure IP extraction to properly handle proxies or load balancers (e.g., `X-Forwarded-For`).

## 3. Integration & Testing

- [x] 3.1 Apply the rate limiter to the authentication routes (`/auth/login`, `/auth/register`, `/auth/refresh`).
- [x] 3.2 Verify rate limits apply independently per IP address.
- [x] 3.3 Verify the rate limiter blocks exactly the N+1 request (e.g., 11th consecutive login request from the same IP receives a 429).
- [x] 3.4 Simulate Redis downtime and verify requests can still bypass the rate limiter (fail-open) and warnings are logged.
