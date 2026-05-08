## Why

Students and staff need reliable, timely information regarding workshop registrations, payment confirmations, and schedule changes. Providing these updates via multiple channels (Email, Push) enhances user experience and ensures attendance accuracy. An asynchronous, decoupled notification module is essential to handle these communications without introducing latency or failures into the core business transaction flows.

## What Changes

- **Asynchronous Notification Worker**: A standalone Node.js service that consumes event messages from RabbitMQ and dispatches them across configured channels.
- **Multi-Channel Adapters**: Implementation of an extensible Adapter pattern for Email (using Nodemailer and Handlebars templates) and Push Notifications (using Firebase Cloud Messaging).
- **Event Schema & Bus**: Definition of a standardized event payload structure and integration of RabbitMQ for reliable event buffering and delivery.
- **Reliability & Retries**: Implementation of a RabbitMQ-based retry mechanism (Dead Letter Exchange) with exponential backoff to handle transient network or provider failures.
- **Audit & Observability**: Creation of a `notification_logs` table to provide a full audit trail of every notification attempt, success, and failure per channel.
- **FCM Token Lifecycle**: API endpoints to manage device-specific push tokens, including automated cleanup of invalid tokens.

## Capabilities

### New Capabilities
- `notification-module`: Provides the infrastructure for asynchronous multi-channel notifications (Email, Push), delivery audit logging, and automated retry logic.

### Modified Capabilities
<!-- No existing capabilities are being modified at the specification level. -->

## Impact

- **Infrastructure**: Requires RabbitMQ for message queueing and Redis for lightweight coordination if needed.
- **Third-Party Services**: Integration with an SMTP provider (e.g., SendGrid, AWS SES) and Firebase Cloud Messaging (FCM).
- **Database**: Introduces the `notification_logs` table and adds `fcm_token` support to the `users` table.
- **Performance**: Decouples heavy communication tasks from the main API thread, improving overall system responsiveness.
