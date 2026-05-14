### Requirement: Registration Endpoint Validation
The system MUST validate the incoming payload for proper email format and password strength.

#### Scenario: Weak password submission
- **WHEN** a client submits a registration request with a password lacking a special character or number
- **THEN** the API MUST return `400 Bad Request` with validation error details.

#### Scenario: Invalid email submission
- **WHEN** a client submits an improperly formatted email address
- **THEN** the API MUST return `400 Bad Request`.

### Requirement: Email Uniqueness
The system MUST prevent multiple accounts from using the same email address.

#### Scenario: Duplicate email registration
- **WHEN** a client attempts to register with an email that already exists in the database
- **THEN** the API MUST return `409 Conflict` and not create the account.

### Requirement: Secure Account Creation
The system MUST securely create the account, hashing the password and enforcing the student role.

#### Scenario: Successful registration
- **WHEN** a client submits a valid registration payload
- **THEN** the API MUST create the user with `role=student`, store the password as a bcrypt hash, return `201 Created`, and record a `REGISTER_SUCCESS` audit log.

#### Scenario: Privilege escalation attempt
- **WHEN** a client submits a payload containing `"role": "admin"`
- **THEN** the API MUST ignore the provided role, create the account with `role=student`, and return `201 Created`.
