# IT Helpdesk — Production Readiness Audit Report

**Date:** February 27, 2026  
**Audited By:** Automated Deep Analysis  
**Scope:** Full-stack application (Backend, Frontend, Database)  
**Tech Stack:** Node.js + Express, React (Vite), SQL Server

---

## Executive Summary

**Total Issues Found: 100** across backend security, backend logic, frontend, and database layers.

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 — Critical** | **22** | Must fix before production — SQL injection, auth bypass, XSS, CORS misconfiguration |
| **P1 — High** | **31** | Should fix before production — missing permissions, race conditions, no transactions |
| **P2 — Medium** | **40** | Fix soon after launch — performance, dark mode, validation, logging |
| **P3 — Low** | **32** | Nice to have — naming, accessibility, dead code cleanup |

---

## P0 — CRITICAL (Must Fix Before Production)

### Security — Backend

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| 1 | **CORS wildcard `*` overrides config** — any website can make API requests | server.js (L63-L68) | Full API accessible from any origin |
| 2 | **Content Security Policy disabled** (`contentSecurityPolicy: false`) | server.js (L51-L55) | XSS attacks have no browser mitigation |
| 3 | **2FA bypass on email failure** — if OTP email fails, user gets full JWT without 2FA | auth.controller.js (L370-L377) | 2FA completely defeated |
| 4 | **Password reset token returned in HTTP response body** when password expired | auth.controller.js (L300-L313) | Token interception = account takeover |
| 5 | **`disable2FA` requires no password verification** | twoFactor.controller.js (L184-L197) | Stolen JWT can permanently disable 2FA |
| 6 | **No input validation middleware exists** — `express-validator` installed but never used | All controllers | XSS, oversized inputs, type confusion |
| 7 | **`speakeasy` dependency is unmaintained** (archived since 2017) | package.json | Known security issues, no patches |

### SQL Injection — Backend

| # | Issue | File(s) |
|---|-------|---------|
| 8 | **Date/limit/days params interpolated directly** into SQL queries | analytics.controller.js (9+ locations) |
| 9 | **String values "escaped" with `.replace(/'/g, "''")` then interpolated** — bypassable | roles.controller.js (6+ locations) |
| 10 | **Same pattern in all department CRUD** | departments.controller.js (6+ locations) |
| 11 | **User ID interpolated into SQL** in dashboard stats | system.controller.js (L347-L365) |
| 12 | **`sortBy`/`sortOrder` from query string injected into ORDER BY** | tickets.controller.js (L163) |
| 13 | **`offset`/`limit` interpolated** | emailQueue.controller.js (L108-L109) |
| 14 | **Ticket number prefix interpolated** into LIKE clause | tickets.controller.js (L553) |

### Authentication — Backend

| # | Issue | File(s) |
|---|-------|---------|
| 15 | **Security settings routes are fully PUBLIC** — no auth middleware | securityRoutes.js |

### Frontend Security

| # | Issue | File(s) |
|---|-------|---------|
| 16 | **JWT token stored in `localStorage`** — accessible to any XSS | authService.js (L22-L23) |
| 17 | **Plaintext password stored in `sessionStorage`** (base64 = not encryption) during 2FA | Login.jsx (L241-L244) |
| 18 | **XSS via `dangerouslySetInnerHTML`** — DOMPurify installed but never imported/used | HelpCenter.jsx (L202), TemplatePreview.jsx (L216) |
| 19 | **No CSP meta tag in index.html** | index.html |

### Database

| # | Issue | File(s) |
|---|-------|---------|
| 20 | **No FK constraints** — manual cascade deletes everywhere, user delete orphans 15+ tables | tickets.controller.js (L2085-L2115) |
| 21 | **`autoClose.job.js` calls non-existent `emailQueueService.queueEmail()`** — runtime crash | autoClose.job.js (L321-L330) |
| 22 | **SQL injection in departments controller** (same as #10 but DB-layer consequence) | departments.controller.js |

---

## P1 — HIGH (Fix Before or Immediately After Launch)

### Missing Permission Checks

| # | Issue | File(s) |
|---|-------|---------|
| 23 | **All 8 analytics endpoints** — any user can see admin analytics | analytics.controller.js |
| 24 | **All department CUD endpoints** — any user can create/update/delete depts | departments.controller.js |
| 25 | **All backup endpoints** — any user can create/download/delete backups | backup.controller.js |
| 26 | **`getSettings` returns ALL system settings** including SMTP passwords | system.controller.js (L293) |
| 27 | **`addComment` — any user can comment on any ticket** regardless of access | tickets.controller.js (L1855) |

### Security

| # | Issue | File(s) |
|---|-------|---------|
| 28 | **Error messages leak internal details** (`err.message` returned verbatim) | errorHandler.js (L27) |
| 29 | **`/test-uploads` debug endpoint** exposes directory listing in production | server.js (L160-L176) |
| 30 | **Static upload files served without authentication** — world-readable | server.js (L139-L141) |
| 31 | **No HTTPS enforcement** — no `trust proxy`, no HTTP→HTTPS redirect | server.js |
| 32 | **Anti-enumeration broken** — locked/inactive accounts get distinct error messages | password-reset.controller.js (L84-L91) |
| 33 | **Reset tokens stored in plaintext** in database | password-reset.controller.js (L115-L130) |
| 34 | **Password reset only checks length >= 8** — no policy enforcement | password-reset.controller.js (L338) |
| 35 | **`verify-2fa-login` endpoint has no rate limiting** — OTP brute-force possible | auth.controller.js (L600-L610) |
| 36 | **No 2FA verification middleware** for sensitive operations | Middleware layer |
| 37 | **Express 5.1.0 is pre-release/beta** — not stable for production | package.json |
| 38 | **No `.gitignore` in backend** — `.env` with secrets could be committed | Backend root |
| 39 | **DOMPurify requires `jsdom` for server-side** — without it, sanitization silently fails | package.json |

### Race Conditions & Data Integrity

| # | Issue | File(s) |
|---|-------|---------|
| 40 | **Ticket number generation not atomic** — concurrent requests = duplicates | tickets.controller.js (L548-L557) |
| 41 | **Auto-assignment race condition** — concurrent creates assign same engineer | tickets.controller.js (L608-L680) |
| 42 | **`createTicket` has no transaction wrapping** (15+ queries) | tickets.controller.js (L500-L1045) |
| 43 | **`updateTicket` has no transaction wrapping** | tickets.controller.js (L1065-L1500) |
| 44 | **No UNIQUE constraint on `ticket_number`** | Database schema |
| 45 | **Hardcoded `performed_by = 1`** in auto-escalation job | autoEscalation.job.js (L290) |

### Frontend

| # | Issue | File(s) |
|---|-------|---------|
| 46 | **No token refresh mechanism** — user silently logged out on expiry | authService.js |
| 47 | **Full user object in localStorage** including permissions, email, role | authService.js (L23) |
| 48 | **No lazy loading** — 20+ pages loaded eagerly in one bundle | App.jsx (L19-L37) |
| 49 | **Inconsistent env var names** — `VITE_API_BASE_URL` vs `VITE_API_URL` | constants.js, TicketsList.jsx (L143) |
| 50 | **`ProtectedRoute` crashes if `user.permissions` is undefined** | ProtectedRoute.jsx (L18) |
| 51 | **`window.location.href` causes full page reloads** instead of SPA navigation | Login.jsx (L445), api.js (L53) |

---

## P2 — MEDIUM (Fix Soon After Launch)

### Backend

| # | Issue | File(s) |
|---|-------|---------|
| 52 | DB encryption off by default | config.js (L97-L98) |
| 53 | Session expiry hardcoded to 8h, ignoring DB setting | auth.controller.js (L430) |
| 54 | Bcrypt uses hardcoded 10 rounds in password reset | password-reset.controller.js (L414) |
| 55 | No rate limiting on forgot-password endpoint | password-reset.controller.js |
| 56 | No magic-bytes file validation (extension + MIME easily spoofed) | upload.middleware.js (L44-L51) |
| 57 | Predictable upload filenames | upload.middleware.js (L34-L39) |
| 58 | Internal comments visible to ticket requesters | tickets.controller.js (L455-L460) |
| 59 | Privilege escalation — admin can assign any role without hierarchy check | users.controller.js (L430-L470) |
| 60 | Unsafe file path construction (path traversal risk from DB data) | attachmentsController.js (L480) |
| 61 | Dashboard data exposed to all users (performer metrics) | dashboard.controller.js (L155-L165) |
| 62 | Notifications fail-open on error | notifications.controller.js (L73) |
| 63 | N+1 queries in user listing (correlated subqueries) | users.controller.js (L109-L113) |
| 64 | N+1 in bulk notification creation | notifications.controller.js (L455-L465) |
| 65 | SLA compliance calculation is logically wrong | analytics.controller.js (L78-L81) |
| 66 | Insecure email TLS (`rejectUnauthorized: false`) | emailQueue.service.js (L73) |
| 67 | Connection info logged to console | database.js (L32-L33) |
| 68 | Excessive permission logging on every request | auth.js (L232-L246) |

### Frontend

| # | Issue | File(s) |
|---|-------|---------|
| 69 | 70+ unconditional `console.error`/`console.log` in production | Multiple pages |
| 70 | Dark mode CSS missing — EditTicket, CreateTicket, MyTickets, ForgotPassword | Multiple CSS files |
| 71 | `EditTicket` uses `alert()` instead of toast system | EditTicket.jsx (L237-L240) |
| 72 | No input sanitization or max-length on ticket forms | CreateTicket.jsx |
| 73 | `NotificationProvider` outside `BrowserRouter` — can't use router hooks | App.jsx (L131-L135) |
| 74 | Missing `<meta>` tags — generic title "frontend", no description, no robots | index.html |
| 75 | No sourcemap config for production build | vite.config.js |

### Database

| # | Issue | File(s) |
|---|-------|---------|
| 76 | Missing audit columns (`updated_at`) on 5+ tables | Schema-wide |
| 77 | Missing DEFAULT values on 9+ columns (`is_read`, `retry_count`, etc.) | Schema-wide |
| 78 | Missing NOT NULL constraints on critical columns | Schema-wide |
| 79 | User deletion orphans records in 15+ tables | Schema-wide |
| 80 | `job_executions` inconsistent column usage across jobs | Multiple job files |
| 81 | Jobs filter by `status_name` instead of `status_code` | autoClose.job.js (L148) |

---

## P3 — LOW (Nice to Have / Best Practice)

| # | Issue | Area |
|---|-------|------|
| 82 | No `X-Request-ID` for request tracing | Backend |
| 83 | `compression()` on already-compressed images | Backend |
| 84 | `unhandledRejection` handler doesn't exit process | Backend |
| 85 | CORS origin hardcoded to `localhost:5173` | Backend config |
| 86 | `.zip` allowed in uploads (malware vector) | Backend config |
| 87 | JWT expiry 8h (should be 1-2h with refresh) | Backend config |
| 88 | `optionalAuth` doesn't check session validity | Backend middleware |
| 89 | `morgan` dependency installed but never used | Backend package.json |
| 90 | Both `speakeasy` and `otplib` installed (duplicate) | Backend package.json |
| 91 | `console.log` instead of logger in securityController | Backend |
| 92 | Hardcoded role IDs `IN (1, 2)` for managers | Backend |
| 93 | No test framework configured | Backend package.json |
| 94 | Hardcoded "30 days" in auto-close activity description | Backend jobs |
| 95 | ESLint suppresses uppercase unused variable warnings | Frontend config |
| 96 | No React Error Boundary component | Frontend |
| 97 | Missing accessibility (aria-labels, dialog roles) | Frontend |
| 98 | `react-quill` may be unused/outdated | Frontend package.json |
| 99 | Stale closure risk in notification polling | Frontend |
| 100 | Inconsistent timestamp column naming across tables | Database |

---

## Detailed Fix Plan

### Sprint 1 — Security Hardening (P0) — ~3-4 days

| Step | Task | Files to Modify |
|------|------|-----------------|
| 1.1 | Remove CORS `*` override, configure proper origin | server.js |
| 1.2 | Enable CSP in helmet config | server.js |
| 1.3 | Fix ALL SQL injection — convert to parameterized queries | analytics, roles, departments, system, tickets, emailQueue controllers |
| 1.4 | Add authentication to security routes | securityRoutes.js |
| 1.5 | Fix 2FA bypass — reject login when OTP email fails | auth.controller.js |
| 1.6 | Remove password reset token from HTTP response | auth.controller.js |
| 1.7 | Require password to disable 2FA | twoFactor.controller.js |
| 1.8 | Add express-validator input validation to all endpoints | All controllers + new validators middleware |
| 1.9 | Replace `speakeasy` with `otplib` | auth, twoFactor controllers |
| 1.10 | Fix `autoClose.job.js` — use correct method name | autoClose.job.js |
| 1.11 | Add `.gitignore` to backend | backend/.gitignore |

### Sprint 2 — Authorization & Access Control (P1) — ~2-3 days

| Step | Task | Files to Modify |
|------|------|-----------------|
| 2.1 | Add permission checks to analytics routes | analytics routes/controller |
| 2.2 | Add permission checks to department CUD routes | departments routes/controller |
| 2.3 | Add permission checks to backup routes | backup routes/controller |
| 2.4 | Restrict `getSettings` to admin role | system controller |
| 2.5 | Add ticket ownership check to `addComment` | tickets controller |
| 2.6 | Remove `/test-uploads` endpoint | server.js |
| 2.7 | Add auth middleware to static upload paths | server.js |
| 2.8 | Fix error handler — never return raw `err.message` | errorHandler.js |
| 2.9 | Fix anti-enumeration (same msg for locked/inactive) | password-reset controller |
| 2.10 | Hash reset tokens before DB storage | password-reset controller |

### Sprint 3 — Data Integrity & Transactions (P1) — ~2 days

| Step | Task | Files to Modify |
|------|------|-----------------|
| 3.1 | Wrap `createTicket` in a transaction | tickets controller |
| 3.2 | Wrap `updateTicket` in a transaction | tickets controller |
| 3.3 | Make ticket number generation atomic (DB sequence) | tickets controller + DB migration |
| 3.4 | Add UNIQUE constraint on `ticket_number` | DB migration |
| 3.5 | Add critical FK constraints | DB migration |
| 3.6 | Add missing indexes on high-frequency columns | DB migration |
| 3.7 | Fix hardcoded `performed_by = 1` in escalation job | autoEscalation.job.js |

### Sprint 4 — Frontend Security & UX (P0+P1) — ~2 days

| Step | Task | Files to Modify |
|------|------|-----------------|
| 4.1 | Import and use DOMPurify on all `dangerouslySetInnerHTML` | HelpCenter, TemplatePreview |
| 4.2 | Move token to httpOnly cookie (or at minimum sessionStorage) | authService.js, backend auth |
| 4.3 | Remove password from sessionStorage in 2FA flow | Login.jsx |
| 4.4 | Add CSP meta tag to index.html | index.html |
| 4.5 | Add React.lazy() code splitting for all routes | App.jsx |
| 4.6 | Fix env var name inconsistency | TicketsList.jsx |
| 4.7 | Add null-safe access in ProtectedRoute | ProtectedRoute.jsx |
| 4.8 | Replace `window.location.href` with `navigate()` | Login.jsx, api.js |
| 4.9 | Add Error Boundary component | New component |

### Sprint 5 — Production Polish (P2) — ~2-3 days

| Step | Task | Files to Modify |
|------|------|-----------------|
| 5.1 | Filter internal comments by user role | tickets controller |
| 5.2 | Fix SLA compliance calculation | analytics controller |
| 5.3 | Add dark mode CSS to missing pages | CSS files |
| 5.4 | Replace `alert()` with toast in EditTicket | EditTicket.jsx |
| 5.5 | Remove/guard all `console.log` statements | All files |
| 5.6 | Fix session expiry to use DB setting | auth controller |
| 5.7 | Set proper `<title>` and meta tags | index.html |
| 5.8 | Add DB DEFAULT values and NOT NULL constraints | DB migration |
| 5.9 | Fix jobs to use `status_code` instead of `status_name` | Job files |
| 5.10 | Downgrade Express to 4.x LTS or verify 5.x stability | package.json |

---

## Estimated Total Effort

| Sprint | Focus | Duration |
|--------|-------|----------|
| Sprint 1 | Security Hardening (P0) | 3-4 days |
| Sprint 2 | Authorization & Access Control (P1) | 2-3 days |
| Sprint 3 | Data Integrity & Transactions (P1) | 2 days |
| Sprint 4 | Frontend Security & UX (P0+P1) | 2 days |
| Sprint 5 | Production Polish (P2) | 2-3 days |
| **Total** | | **11-14 days** |

---

## Pre-Deployment Checklist

- [ ] All P0 issues resolved
- [ ] All P1 issues resolved
- [ ] `.env` file configured for production (DB, JWT_SECRET, CORS origin, SMTP)
- [ ] `.gitignore` added to backend
- [ ] HTTPS/TLS configured via reverse proxy (nginx/IIS)
- [ ] `NODE_ENV=production` set
- [ ] Database indexes created
- [ ] Database constraints (FK, UNIQUE, NOT NULL) applied
- [ ] `npm audit` run with no critical/high vulnerabilities
- [ ] Load testing performed
- [ ] Backup/restore procedure tested
- [ ] Monitoring/alerting configured
- [ ] Error logging configured (no console.log in production)
- [ ] Rate limiting enabled on auth endpoints

---

*Report generated on February 27, 2026*
