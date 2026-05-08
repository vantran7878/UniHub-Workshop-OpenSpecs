# notification-module Specification

## Purpose
TBD - created by archiving change add-notification-module. Update Purpose after archive.
## Requirements
### Requirement: Asynchronous Event Consumption
The system SHALL consume business events from a centralized message queue (RabbitMQ). The system MUST process these events independently from the main business transaction thread to ensure high system availability.

#### Scenario: Successful Event Intake
- **WHEN** a business module publishes a registration event to the `notification.queue`
- **THEN** the notification worker MUST acknowledge the message and begin the dispatch process

#### Scenario: Sequential Processing
- **WHEN** multiple events are published simultaneously
- **THEN** the system SHALL process messages in the order they were received using a prefetch configuration to balance load

### Requirement: Multi-Channel Dispatching
The system SHALL support multiple notification channels, starting with Email and Push Notifications. The system MUST allow for different channels to be enabled or disabled per event type via a centralized mapping.

#### Scenario: Dispatch to Multiple Channels
- **WHEN** an event type is mapped to both 'email' and 'push' channels
- **THEN** the system SHALL trigger both dispatchers concurrently and log their results independently

#### Scenario: Channel Skipping
- **WHEN** a user does not have an email address or an FCM token configured
- **THEN** the system SHALL skip the respective channel dispatch and record the reason in the delivery logs

### Requirement: Reliable Delivery and Retries
The system SHALL implement a retry mechanism for transient delivery failures. The system MUST retry failed notification attempts up to 3 times with a delay between attempts before marking them as permanently failed.

#### Scenario: Transient Failure Retry
- **WHEN** an email dispatch fails due to a network timeout
- **THEN** the system SHALL requeue the message for a later retry attempt and increment the retry counter

#### Scenario: Permanent Failure Exhaustion
- **WHEN** a notification attempt fails after 3 consecutive retries
- **THEN** the system SHALL mark the notification as 'failed' in the audit logs and cease further retry attempts

### Requirement: Audit Logging and Monitoring
The system SHALL record the outcome of every notification attempt in a persistent audit log. The system MUST capture metadata such as the channel used, timestamp, status (sent/failed), and error details if applicable.

#### Scenario: Successful Delivery Audit
- **WHEN** a push notification is successfully delivered to the provider
- **THEN** the system SHALL create a record in `notification_logs` with status 'sent' and the corresponding event ID

#### Scenario: Error Auditing
- **WHEN** a dispatch attempt fails due to an invalid provider configuration
- **THEN** the system SHALL record the provider's error response in the `error_details` field of the audit log

