<div align="center">

# 🎫 IT Helpdesk

**A complete IT service-desk platform — tickets, SLAs, approvals and an AI assistant.**

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL%20Server-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Ollama](https://img.shields.io/badge/AI-Ollama-111827?style=flat-square)

![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

</div>

---

## What it does

IT Helpdesk gives an organisation one place to raise, track and close IT requests. Users log a ticket in a few clicks, engineers get it assigned automatically, managers approve changes straight from their email, and everyone sees the SLA clock.

## Highlights

| Area | Features |
|---|---|
| **Tickets** | Guided ticket wizard, duplicate detection, spelling correction, auto-assignment rules |
| **Workflow** | Change requests (CR), multi-step approvals, approve/reject from email |
| **SLA** | SLA timers, outage notifications and outage reports |
| **AI assistant** | Chatbot for users and an engineer assist mode, grounded on the ticket knowledge base (local Ollama model) |
| **Notifications** | Email queue with templates, inbound mail parsing, WhatsApp messages and media |
| **Security** | JWT auth, 2FA, OTP, password policy and expiry, rate limiting, Helmet, input validation |
| **Operations** | Scheduled jobs, backup and restore, migration runner, licence check |
| **Reports** | Ticket, CR and outage reports |

## Architecture

```
React + Vite (nginx)  ──►  Express 5 API  ──►  SQL Server
                               │
                               ├── Ollama (local LLM) for the assistant
                               ├── SMTP / IMAP for email approvals
                               └── WhatsApp API for alerts
```

## Run it locally

```bash
# backend
cd backend
cp .env.example .env      # fill in your own values
npm install
npm run dev

# frontend
cd ../frontend
npm install
npm run dev
```

Docker files for both parts are in `backend/`, `frontend/` and `docker/`.

## Tests

```bash
cd backend
npm test
```

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
Built by <a href="https://github.com/SuvadipPanja">Suvadip Panja</a>
</div>
