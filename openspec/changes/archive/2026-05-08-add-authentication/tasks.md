## 1. Environment and Infrastructure Setup

- [x] 1.1 Generate RSA-256 key pair for JWT signing (private and public keys)
- [x] 1.2 Configure environment variables for Redis connection and JWT keys
- [x] 1.3 Add `jsonwebtoken`, `bcrypt`, and `redis` dependencies to `package.json`

## 2. Core Authentication Logic

- [x] 2.1 Implement password hashing utility using `bcrypt`
- [x] 2.2 Implement JWT signing and verification service (RS256)
- [x] 2.3 Create Redis client and implement refresh token storage/retrieval functions
- [x] 2.4 Implement session revocation logic (logout/blacklisting)

## 3. Middleware Implementation

- [x] 3.1 Create `verifyJWT` middleware to extract and validate access tokens
- [x] 3.2 Create `checkBlacklist` middleware to verify token jti against Redis
- [x] 3.3 Create `loadUser` middleware to fetch user data from PostgreSQL
- [x] 3.4 Create `requireRole` middleware for RBAC enforcement

## 4. Auth Endpoints Implementation

- [x] 4.1 Implement `POST /api/auth/login` with credential validation and token generation
- [x] 4.2 Implement `POST /api/auth/refresh` to issue new access tokens using refresh tokens
- [x] 4.3 Implement `POST /api/auth/logout` to invalidate sessions

## 5. Security and Rate Limiting

- [x] 5.1 Implement Redis Lua script for Token Bucket rate limiting
- [x] 5.2 Apply rate limiting middleware to the login endpoint
- [x] 5.3 Verify that all protected endpoints return 401/403 errors appropriately
