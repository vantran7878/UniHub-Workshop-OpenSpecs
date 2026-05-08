## Why

The UniHub Workshop system currently lacks a centralized authentication and authorization mechanism. This is critical for securing student data, managing workshop registrations, and providing role-based access control (RBAC) for admins and staff. Implementing this now is essential to move beyond the manual processes currently in place.

## What Changes

- **Identity Management**: Implement a secure login system for Students, Admins, and Staff.
- **Token-Based Auth**: Use RS256-signed JWTs for stateless authentication.
- **Session Control**: Implement refresh token management using Redis for secure session extension and revocation.
- **Access Control**: Establish an RBAC system to protect endpoints based on user roles.
- **Rate Limiting**: Add brute-force protection for the login endpoint.

## Capabilities

### New Capabilities
- `auth-module`: Defines the complete authentication and authorization lifecycle, including JWT structure, role definitions, and session management.

### Modified Capabilities
<!-- No existing capabilities are being modified at the specification level. -->

## Impact

- **API Security**: All protected endpoints will now require a valid `Authorization: Bearer <token>` header.
- **Infrastructure**: Requires a Redis instance for refresh token storage and blacklisting.
- **Security**: Requires management of RSA key pairs (RS256).
