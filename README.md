# UniHub Workshop (spec-driven blueprint)

This repository is being built from the OpenSpec change `openspec/changes/blueprint/`.

## Local development (Docker)

### Prerequisites
- Docker + Docker Compose
- Node.js (LTS) + npm

### Start infra

```bash
docker compose up -d
```

Services:
- PostgreSQL: `localhost:5432` (db `unihub`, user `unihub`, password `unihub`)
- Redis: `localhost:6379`
- RabbitMQ: `localhost:5672` (management UI `http://localhost:15672`, user/pass `guest/guest`)
- MailHog (dev SMTP): SMTP `localhost:1025`, UI `http://localhost:8025`

### Environment

Copy env examples once apps exist:
- `backend/.env.example` → `backend/.env`
- `workers/.env.example` → `workers/.env`
- `web/.env.example` → `web/.env`

### Next steps

Run `openspec instructions apply --change "blueprint" --json` to see implementation tasks and progress.

