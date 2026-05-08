## Why

Workshop documentation can be extensive and difficult for students to digest quickly. By providing AI-generated summaries of PDF materials, the system can offer immediate value through structured highlights (Theme, Main Content, Key Points), enhancing the learning experience and increasing engagement with workshop resources.

## What Changes

- **Backend Endpoints**: Implement `POST /api/workshops/:id/pdf` for admin uploads and `GET /api/workshops/:id/summary` for cross-role summary retrieval.
- **Asynchronous Processing**: Integrate RabbitMQ to decouple the time-intensive AI summarization from the main request-response cycle.
- **AI Worker Service**: Implement a dedicated worker to extract text from PDFs and interact with external AI APIs (e.g., OpenAI).
- **Persistence**: Add the `workshop_summaries` table to track statuses (`pending`, `processing`, `done`, `failed`) and store the final output.
- **File Management**: Set up structured storage for uploaded PDF documents on the server.

## Capabilities

### New Capabilities
- `ai-pdf-summary`: Implements the end-to-end flow for PDF upload, queuing, AI summarization, and result polling.

### Modified Capabilities
<!-- No existing capabilities are being modified at the specification level. -->

## Impact

- **Infrastructure**: Requires a running RabbitMQ instance and external AI API access.
- **Storage**: Increased disk usage for storing uploaded PDFs.
- **Security**: Strict RBAC ensuring only admins can trigger the generation process.
