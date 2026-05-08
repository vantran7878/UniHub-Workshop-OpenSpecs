## Context

The UniHub Workshop system requires a robust, asynchronous notification system to handle communication with students and staff across multiple channels. The current system lacks a unified way to dispatch emails and push notifications, leading to scattered logic and potential performance bottlenecks in business transactions.

## Goals / Non-Goals

**Goals:**
- Provide a unified, asynchronous processing worker for all system notifications.
- Implement extensible adapters for Email and Push Notification (FCM) channels.
- Ensure reliability through automated retries and dead-letter queue handling.
- Maintain a comprehensive audit trail of all communication attempts.

**Non-Goals:**
- Implementing real-time chat functionality.
- Supporting SMS or social media channels (e.g., WhatsApp, Telegram) in the initial release (though the design must allow for them).

## Decisions

### Decision 1: Adapter Pattern for Channel Dispatchers
- **Rationale**: The Adapter pattern allows us to define a consistent interface (`send(user, eventType, payload)`) for all notification channels. This makes it trivial to add new channels (like Telegram) in the future without modifying the core worker logic.
- **Alternatives**: Hardcoding channel logic in the worker was rejected as it violates the Open/Closed principle and makes the system harder to maintain as it grows.

### Decision 2: Handlebars for Email Templating
- **Rationale**: Handlebars is a mature, logic-less templating engine that allows designers and developers to create rich HTML emails independently of the business logic. It integrates seamlessly with Nodemailer.
- **Alternatives**: Using template strings in code was rejected due to lack of maintainability and poor separation of concerns.

### Decision 3: RabbitMQ Dead Letter Exchange (DLX) for Retries
- **Rationale**: Leveraging RabbitMQ's built-in DLX and TTL features allows us to implement a sophisticated retry mechanism with 60-second delays without blocking the main processing queue or writing complex custom retry logic.
- **Alternatives**: In-memory retry queues were rejected because they risk losing messages if the worker crashes.

### Decision 4: PostgreSQL for Audit Logging
- **Rationale**: Storing `notification_logs` in PostgreSQL ensures that our communication audit trail is part of our relational data model, allowing for easy reporting and correlation with workshops, users, and registrations.
- **Alternatives**: Logging only to standard out or a text file was rejected due to the difficulty of structured querying and long-term persistence.

## Risks / Trade-offs

- **[Risk]**: High volume of notifications (e.g., workshop cancellation) overwhelming the SMTP provider → **[Mitigation]**: Implement a prefetch limit on the worker and use RabbitMQ to buffer bursts of events.
- **[Risk]**: Stale FCM tokens causing excessive failures → **[Mitigation]**: Automatically clear `fcm_token` from the `users` table when the provider returns a 'not registered' error.
- **[Risk]**: RabbitMQ connection instability → **[Mitigation]**: Use the `amqplib` heartbeat and reconnection logic already established in the RabbitMQ config.
