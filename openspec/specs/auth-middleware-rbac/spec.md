### Requirement: Token Authentication
The system MUST verify the JWT access token before granting access to protected routes.

#### Scenario: Missing token
- **WHEN** a client requests a protected route without an `Authorization` header
- **THEN** the system MUST return `401 Unauthorized`.

#### Scenario: Expired token
- **WHEN** a client requests a protected route with an expired JWT token
- **THEN** the system MUST return `401 Unauthorized`.

### Requirement: Role-Based Access Control (RBAC)
The system MUST restrict access to certain routes based on the user's role.

#### Scenario: Insufficient role
- **WHEN** a `student` requests an endpoint that requires `admin` or `staff` roles
- **THEN** the system MUST return `403 Forbidden`.

### Requirement: Resource Ownership
The system MUST restrict access to user-specific resources based on ownership, unless the user is an admin.

#### Scenario: Unauthorized resource access
- **WHEN** a `student` attempts to modify a resource belonging to another user
- **THEN** the system MUST return `403 Forbidden`.

#### Scenario: Admin resource access
- **WHEN** an `admin` attempts to modify a resource belonging to another user
- **THEN** the system MUST allow the action.
