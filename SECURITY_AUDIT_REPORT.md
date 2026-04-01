# IT Helpdesk — Comprehensive Security Audit Report

| **Audit Date** | June 2025 |
|---|---|
| **Scope** | Full-stack: Backend (Node.js/Express), Frontend (React/Vite), Database (SQL Server), Docker Infrastructure, License Generator, Nginx, Dependencies |
| **Methodology** | OWASP Top 10 (2021), CWE/SANS Top 25, NIST Cybersecurity Framework, npm Advisory Database |
| **Auditor** | Automated Static Analysis + Manual Code Review |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Severity Matrix](#2-severity-matrix)
3. [Findings Overview](#3-findings-overview)
4. [CRITICAL Findings](#4-critical-findings)
5. [HIGH Findings](#5-high-findings)
6. [MEDIUM Findings](#6-medium-findings)
7. [LOW / Informational Findings](#7-low--informational-findings)
8. [Dependency Vulnerability Report](#8-dependency-vulnerability-report)
9. [Remediation Priority Matrix](#9-remediation-priority-matrix)
10. [Security Best Practices Checklist](#10-security-best-practices-checklist)

---

## 1. Executive Summary

This report presents the results of a comprehensive end-to-end security audit of the IT Helpdesk application. The audit covered all layers of the technology stack — backend API, frontend SPA, database configuration, Docker infrastructure, Nginx reverse proxy, license generator, and dependency supply-chain.

### Key Statistics

| Severity | Count |
|----------|-------|
| **CRITICAL** | 6 |
| **HIGH** | 10 |
| **MEDIUM** | 8 |
| **LOW / Informational** | 5 |
| **Dependency CVEs (Backend)** | 15 (7 high, 6 moderate, 2 low) |
| **Dependency CVEs (Frontend)** | 3 (1 moderate, 2 low) |
| **Total Issues** | **47** |

### Risk Summary

The application demonstrates strong security fundamentals — parameterized queries via `executeQuery()`, bcrypt password hashing, JWT session management with token-hash validation, helmet security headers, CORS configuration, and role-based access control. However, several **critical gaps** exist:

1. **Secrets in version control** — Production credentials (DB password, JWT secret, license keys, private crypto key) are committed to the repository
2. **Cross-Site Scripting (XSS)** — Two components use `dangerouslySetInnerHTML` without sanitization, creating stored XSS vectors
3. **JWT tokens in localStorage** — Combined with XSS vulnerabilities, allows complete account takeover
4. **Unencrypted database connection** — Cleartext SQL traffic vulnerable to network sniffing/MITM
5. **Vulnerable dependencies** — 15 backend and 3 frontend npm packages have known CVEs, including SMTP command injection in nodemailer and XSS in quill

---

## 2. Severity Matrix

| Severity | Definition | SLA |
|----------|-----------|-----|
| **CRITICAL** | Immediate risk of data breach, full system compromise, or credential exposure. Exploitable with minimal effort. | Fix within **48 hours** |
| **HIGH** | Significant vulnerability that could lead to data theft, privilege escalation, or service disruption under specific conditions. | Fix within **1 week** |
| **MEDIUM** | Security weakness that increases attack surface or could be exploited in combination with other issues. | Fix within **2 weeks** |
| **LOW** | Minor issue, defense-in-depth improvement, or informational finding. | Fix within **1 month** |

---

## 3. Findings Overview

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| C-01 | CRITICAL | Sensitive Data Exposure | Secrets committed to version control |
| C-02 | CRITICAL | Cryptographic Failures | Private ED25519 key exposed in git history |
| C-03 | CRITICAL | Security Misconfiguration | Hardcoded SQL Server SA password in Docker |
| C-04 | CRITICAL | Cryptographic Failures | Unencrypted database connection (no TLS) |
| C-05 | CRITICAL | XSS / Injection | dangerouslySetInnerHTML without sanitization (2 locations) |
| C-06 | CRITICAL | Broken Authentication | JWT tokens stored in localStorage |
| H-01 | HIGH | Security Misconfiguration | Weak Content Security Policy (unsafe-inline/eval) |
| H-02 | HIGH | Security Misconfiguration | No TLS/HTTPS enforcement (missing HSTS) |
| H-03 | HIGH | Security Misconfiguration | SQL Server port exposed to host network |
| H-04 | HIGH | Broken Authentication | Password reset tokens exposed in URL |
| H-05 | HIGH | Input Validation | File upload MIME type spoofing |
| H-06 | HIGH | Injection | SQL injection risk via string interpolation patterns (30+ instances) |
| H-07 | HIGH | Vulnerable Components | Nodemailer SMTP command injection (CVE) |
| H-08 | HIGH | Vulnerable Components | Express-rate-limit IPv4-mapped IPv6 bypass |
| H-09 | HIGH | Vulnerable Components | JWS improper HMAC signature verification |
| H-10 | HIGH | Vulnerable Components | Quill XSS via HTML export (frontend) |
| M-01 | MEDIUM | Security Misconfiguration | CORS fallback to localhost |
| M-02 | MEDIUM | Sensitive Data Exposure | Database backups stored unencrypted |
| M-03 | MEDIUM | Information Disclosure | Console.log statements in production frontend |
| M-04 | MEDIUM | Broken Authentication | Password reset token reuse (no old-token invalidation) |
| M-05 | MEDIUM | Security Misconfiguration | Rate limiter bypassed when DB is down |
| M-06 | MEDIUM | Broken Authentication | No CSRF protection middleware |
| M-07 | MEDIUM | Security Misconfiguration | Weak bcrypt rounds (10, recommended 12+) |
| M-08 | MEDIUM | Security Misconfiguration | DB container initially runs as root |
| L-01 | LOW | Security Misconfiguration | Missing Strict-Transport-Security header in nginx |
| L-02 | LOW | Information Disclosure | Server version headers not fully suppressed |
| L-03 | LOW | Broken Authentication | JWT issuer/audience use generic values |
| L-04 | LOW | Information Disclosure | Verbose error messages in development mode |
| L-05 | LOW | Sensitive Data Exposure | License JSON files committed to repository |

---

## 4. CRITICAL Findings

### C-01: Secrets Committed to Version Control

| | |
|---|---|
| **OWASP Category** | A02:2021 – Cryptographic Failures |
| **CWE** | CWE-798: Hard-coded Credentials |
| **Affected Files** | `.env`, `docker/production-release/.env` |

**Description:**

The repository contains `.env` files with production-grade secrets committed to version control. Even though `.gitignore` lists `.env`, these files exist in the workspace and potentially in git history.

**Evidence:**

```
# .env (root):
DB_PASSWORD=Root@1234
JWT_SECRET=423c026c02315dc5fff686b166b57bA!Bb2@Cc3#4ab790448fc819b42855f59f8dd424de51adfde44b0a8aca50194e55a877d032a6
LICENSE_RECOVERY_KEY=06304a1bff47e77adca57dcfe7c861c6127aa6c3ffefce7a

# docker/production-release/.env:
JWT_SECRET=Y9!sH3Lq2RvR8Pa4Nx7Ud1mK6Zp0We5Tf9Ls2Ha7Qm4Cx8Bn1Jd5Vp3Rk6Tm8QwX
```

**Impact:**
- Any user with repository access obtains database admin credentials, JWT signing secrets, and license recovery keys
- Attacker can forge JWT tokens, access the database directly, and bypass license enforcement
- **Full system compromise** — JWT secret allows impersonation of any user including administrators

**Remediation (Minimal Impact):**

1. **Immediately rotate all exposed secrets** — Generate new JWT secret, DB password, license recovery key
2. **Remove secrets from git history:**
   ```bash
   # Use BFG Repo-Cleaner or git-filter-repo
   git filter-repo --path .env --invert-paths
   git filter-repo --path docker/production-release/.env --invert-paths
   ```
3. **Use `.env.example` with placeholder values** (commit this instead):
   ```env
   DB_PASSWORD=<CHANGE_ME_STRONG_PASSWORD>
   JWT_SECRET=<GENERATE_WITH: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   LICENSE_RECOVERY_KEY=<GENERATE_WITH: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))">
   ```
4. **For production Docker deployments**, use Docker secrets or environment variable injection from a secrets manager:
   ```yaml
   # docker-compose.yml
   services:
     backend:
       secrets:
         - jwt_secret
         - db_password
   secrets:
     jwt_secret:
       external: true
     db_password:
       external: true
   ```
5. **Add pre-commit hook** to prevent future credential commits:
   ```bash
   # .git/hooks/pre-commit
   if git diff --cached --name-only | grep -qE '\.env$'; then
     echo "ERROR: Attempting to commit .env file"
     exit 1
   fi
   ```

---

### C-02: Private ED25519 Key Exposed in Git History

| | |
|---|---|
| **OWASP Category** | A02:2021 – Cryptographic Failures |
| **CWE** | CWE-321: Use of Hard-coded Cryptographic Key |
| **Affected Files** | `license-generator/storage/keys/license-private-key.pem` |

**Description:**

The ED25519 private key used for license signing is committed to git history. Although `.gitignore` now lists `storage/keys/*.pem`, the key was committed before this rule was added and remains in the repository's git history.

**Evidence:**
```
# license-generator/.gitignore (added after the commit):
storage/keys/*.pem
storage/keys/*.key
storage/keys/*.pub
```

The private key file exists on disk and in git history.

**Impact:**
- Attacker can forge valid software licenses for unlimited seats/duration
- Complete bypass of the licensing system
- Revenue loss from unauthorized license generation

**Remediation (Minimal Impact):**

1. **Generate a NEW key pair immediately:**
   ```bash
   cd license-generator
   node -e "
     const crypto = require('crypto');
     const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
     require('fs').writeFileSync('storage/keys/license-private-key.pem',
       privateKey.export({ type: 'pkcs8', format: 'pem' }));
     require('fs').writeFileSync('storage/keys/license-public-key.pem',
       publicKey.export({ type: 'spki', format: 'pem' }));
   "
   ```
2. **Remove the old key from git history:**
   ```bash
   git filter-repo --path license-generator/storage/keys/ --invert-paths
   ```
3. **Re-issue all existing licenses** signed with the compromised key
4. **Update the public key** in backend `.env` (`LICENSE_PUBLIC_KEY`)

---

### C-03: Hardcoded SQL Server SA Password in Docker

| | |
|---|---|
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **CWE** | CWE-798: Hard-coded Credentials |
| **Affected Files** | `docker/db/Dockerfile.patch` (line 8), docker-compose files |

**Description:**

The SQL Server `sa` password is hardcoded in Docker build files and baked into the database image.

**Evidence:**
```dockerfile
# docker/db/Dockerfile.patch
ENV MSSQL_SA_PASSWORD=ItHelpdeskDb@2026!
```

The password `ItHelpdeskDb@2026!` is visible to anyone with access to the Docker image or Dockerfile.

**Impact:**
- Direct database access with `sa` (sysadmin) privileges
- Full data exfiltration — all user records, tickets, passwords hashes
- Data modification or deletion

**Remediation (Minimal Impact):**

1. **Use Docker secrets** instead of environment variables:
   ```yaml
   # docker-compose.yml
   services:
     db:
       environment:
         MSSQL_SA_PASSWORD_FILE: /run/secrets/sa_password
       secrets:
         - sa_password
   secrets:
     sa_password:
       file: ./secrets/sa_password.txt  # NOT committed to git
   ```
2. **Create a dedicated database user** for the application instead of using `sa`:
   ```sql
   CREATE LOGIN helpdesk_app WITH PASSWORD = '<strong_password>';
   CREATE USER helpdesk_app FOR LOGIN helpdesk_app;
   ALTER ROLE db_datareader ADD MEMBER helpdesk_app;
   ALTER ROLE db_datawriter ADD MEMBER helpdesk_app;
   GRANT EXECUTE TO helpdesk_app;
   -- DO NOT grant db_owner or sysadmin
   ```
3. **Add `secrets/` to `.gitignore`**

---

### C-04: Unencrypted Database Connection

| | |
|---|---|
| **OWASP Category** | A02:2021 – Cryptographic Failures |
| **CWE** | CWE-319: Cleartext Transmission of Sensitive Information |
| **Affected Files** | `.env` (lines 12-13), `docker/production-release/.env` |

**Description:**

The database connection is configured without TLS encryption, and the certificate validation is disabled.

**Evidence:**
```env
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

```yaml
# docker-compose.yml (production)
DB_ENCRYPT: "false"
DB_TRUST_SERVER_CERTIFICATE: "true"
```

**Impact:**
- All SQL queries and results travel in cleartext — vulnerable to network sniffing (MITM)
- Credential interception — `sa` username and password sent unencrypted
- Compliance violations (HIPAA, PCI-DSS, SOC 2 all require encrypted data in transit)

**Remediation (Minimal Impact):**

1. **Enable TLS on the SQL Server container:**
   ```bash
   # Generate self-signed cert for SQL Server
   openssl req -x509 -nodes -newkey rsa:2048 \
     -keyout /var/opt/mssql/mssql.key \
     -out /var/opt/mssql/mssql.pem \
     -days 365 -subj '/CN=helpdesk-db'
   ```
2. **Update connection settings:**
   ```env
   DB_ENCRYPT=true
   DB_TRUST_SERVER_CERTIFICATE=false   # Use 'true' only with self-signed certs in dev
   ```
3. **For Docker internal networking**, at minimum set:
   ```env
   DB_ENCRYPT=true
   DB_TRUST_SERVER_CERTIFICATE=true    # Acceptable for Docker-internal self-signed
   ```

---

### C-05: Cross-Site Scripting (XSS) via dangerouslySetInnerHTML

| | |
|---|---|
| **OWASP Category** | A03:2021 – Injection |
| **CWE** | CWE-79: Cross-Site Scripting (Stored XSS) |
| **Affected Files** | `frontend/src/components/helpdesk/AIAssistant.jsx` (line 1365), `frontend/src/components/email/TemplatePreview.jsx` (line 242) |

**Description:**

Two React components render HTML content using `dangerouslySetInnerHTML` without DOMPurify sanitization, allowing stored XSS attacks.

**Location 1 — AIAssistant.jsx:1365:**
```jsx
<div
  className="message-text"
  dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
/>
```
The `formatText()` function uses regex to convert markdown-like syntax to HTML (`**bold**` → `<b>bold</b>`, etc.) but does NOT sanitize input. If the AI bot returns malicious content or if bot responses are crafted by an attacker, arbitrary JavaScript executes in the user's browser.

**Location 2 — TemplatePreview.jsx:242:**
```jsx
<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
```
Email template body HTML is rendered directly without any sanitization. An admin who creates a malicious template can execute JavaScript in any user's browser who previews the template.

**Positive Finding:** `HelpCenter.jsx` (lines 303, 451, 452) correctly uses `DOMPurify.sanitize()` — this pattern should be replicated everywhere.

**Impact:**
- **Account takeover** — XSS can steal JWT tokens from localStorage (see C-06)
- **Session hijacking** — Attacker can exfiltrate the token and impersonate any user
- **Data exfiltration** — JavaScript can read page content and send it to attacker's server
- **Phishing** — Inject fake login forms into the helpdesk UI

**Remediation (Minimal Impact):**

DOMPurify is already a project dependency. Apply it to both locations:

**Fix for AIAssistant.jsx:**
```jsx
import DOMPurify from 'dompurify';

// In the render method (line ~1365):
<div
  className="message-text"
  dangerouslySetInnerHTML={{ 
    __html: DOMPurify.sanitize(formatText(msg.text)) 
  }}
/>
```

**Fix for TemplatePreview.jsx:**
```jsx
import DOMPurify from 'dompurify';

// Line ~242:
<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(bodyHtml) 
}} />
```

---

### C-06: JWT Tokens Stored in localStorage

| | |
|---|---|
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **CWE** | CWE-922: Insecure Storage of Sensitive Information |
| **Affected Files** | `frontend/src/context/AuthContext.jsx` (line 155), `frontend/src/services/api.js` (line 22), `frontend/src/services/authService.js` (line 18) |

**Description:**

JWT authentication tokens are stored in `localStorage`, which is accessible to any JavaScript running on the page. Combined with the XSS vulnerabilities in C-05, this creates a direct path to account takeover.

**Evidence:**
```javascript
// AuthContext.jsx:155
localStorage.setItem('token', data.data.token);

// api.js:22
const token = localStorage.getItem('token');

// authService.js:18
localStorage.setItem('token', token);
```

**Impact:**
- Any XSS vulnerability (C-05) can steal the JWT token via `localStorage.getItem('token')`
- Stolen tokens remain valid until expiry (8 hours as configured)
- No way to invalidate a stolen token on the client side

**Remediation (Minimal Impact):**

**Option A — HttpOnly Cookies (Recommended, moderate refactor):**

Backend changes:
```javascript
// auth.controller.js - login endpoint
res.cookie('token', jwtToken, {
  httpOnly: true,     // Not accessible via JavaScript
  secure: true,       // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  path: '/',
});
res.json(createResponse(true, 'Login successful', { user: userData }));
```

```javascript
// middleware/auth.js - read token from cookie instead of header
const token = req.cookies?.token || 
  (req.headers.authorization?.startsWith('Bearer ') 
    ? req.headers.authorization.substring(7) 
    : null);
```

Frontend changes:
```javascript
// api.js - remove Authorization header, cookies are sent automatically
const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // Send cookies with requests
});
// Remove: localStorage.getItem('token') interceptor
```

**Option B — Short-lived tokens with refresh (less refactor):**

If migrating to cookies is too disruptive, reduce blast radius by:
1. Reduce JWT expiry to 15 minutes
2. Use a refresh token (stored in HttpOnly cookie) for silent renewal
3. Fix all XSS vulnerabilities first (C-05) to prevent token theft

---

## 5. HIGH Findings

### H-01: Weak Content Security Policy

| | |
|---|---|
| **OWASP Category** | A05:2021 – Security Misconfiguration |
| **CWE** | CWE-1021: Improper Restriction of Rendered UI Layers |
| **Affected Files** | `frontend/nginx/conf.d/default.conf` (line 21), `frontend/index.html` (line 9) |

**Description:**

The Content Security Policy allows `unsafe-inline` and `unsafe-eval` in the `script-src` directive, which severely undermines XSS protection.

**Evidence:**
```
Content-Security-Policy: "default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; ..."
```

**Impact:**
- `unsafe-inline` allows inline `<script>` tags — enables XSS payload execution
- `unsafe-eval` allows `eval()`, `new Function()`, `setTimeout('string')` — enables code injection
- CSP is rendered ineffective as an XSS mitigation

**Remediation (Minimal Impact):**

1. **Use nonce-based CSP** (requires build tool integration):
   ```nginx
   # Generate nonce per-request via nginx sub_filter or backend
   add_header Content-Security-Policy 
     "default-src 'self'; 
      script-src 'self' 'nonce-$request_id'; 
      style-src 'self' 'unsafe-inline'; 
      img-src 'self' data: blob: https:; 
      connect-src 'self' ws: wss:; 
      object-src 'none'; 
      frame-ancestors 'self';";
   ```

2. **Interim improvement** — Remove `unsafe-eval` (only needed by some charting libraries; test first):
   ```nginx
   script-src 'self' 'unsafe-inline';  # Remove 'unsafe-eval'
   ```

3. **Long-term** — Migrate to strict CSP with hashes:
   ```
   script-src 'self' 'sha256-<hash_of_inline_script>';
   ```

---

### H-02: No TLS/HTTPS Enforcement

| | |
|---|---|
| **OWASP Category** | A02:2021 – Cryptographic Failures |
| **CWE** | CWE-319: Cleartext Transmission of Sensitive Information |
| **Affected Files** | `frontend/nginx/conf.d/default.conf`, `backend/server.js` |

**Description:**

The application serves all traffic over HTTP (port 80). No HSTS header is configured, and there is no HTTP→HTTPS redirect. In production, this means:

- Login credentials travel in cleartext
- JWT tokens can be intercepted
- Session cookies (if implemented) can be stolen

**Evidence:**
```nginx
# nginx/conf.d/default.conf
listen 80;                        # HTTP only, no SSL
# No add_header Strict-Transport-Security
```

**Remediation (Minimal Impact):**

1. **Add TLS termination** (nginx or reverse proxy):
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate     /etc/nginx/ssl/cert.pem;
       ssl_certificate_key /etc/nginx/ssl/key.pem;
       ssl_protocols       TLSv1.2 TLSv1.3;
       ssl_ciphers         HIGH:!aNULL:!MD5;
       
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   }
   
   # Redirect HTTP to HTTPS
   server {
       listen 80;
       return 301 https://$host$request_uri;
   }
   ```

2. **For Docker deployments behind a load balancer**, add HSTS and trust `X-Forwarded-Proto`:
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

---

### H-03: SQL Server Port Exposed to Host Network

| | |
|---|---|
| **OWASP Category** | A05:2021 – Security Misconfiguration |
| **CWE** | CWE-284: Improper Access Control |
| **Affected Files** | `docker/production-release/docker-compose.yml` (line 12), `docker/production-release/.env` |

**Description:**

The SQL Server port is mapped to the host network, making the database directly accessible from outside the Docker network.

**Evidence:**
```yaml
# docker-compose.yml
ports:
  - "${DB_PUBLISH_PORT}:1433"   # DB_PUBLISH_PORT defaults to 1433
```

**Impact:**
- Database is accessible from outside the Docker network
- Combined with hardcoded SA password (C-03), this allows remote database access
- Brute-force attacks against the database login

**Remediation (Minimal Impact):**

1. **Remove the port mapping** — backend connects via Docker internal network (`db:1433`):
   ```yaml
   services:
     db:
       # Remove 'ports:' section entirely
       # Backend connects internally via service name 'db'
       expose:
         - "1433"   # Only accessible within Docker network
   ```

2. **If external access is needed for development**, bind to localhost only:
   ```yaml
   ports:
     - "127.0.0.1:${DB_PUBLISH_PORT}:1433"
   ```

---

### H-04: Password Reset Tokens Exposed in URL

| | |
|---|---|
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **CWE** | CWE-598: Use of GET Request Method with Sensitive Query Strings |
| **Affected Files** | `frontend/src/pages/auth/ResetPassword.jsx` (line 40) |

**Description:**

Password reset tokens are passed as URL query parameters, which are stored in browser history, server access logs, referrer headers, and potentially proxy logs.

**Evidence:**
```jsx
// ResetPassword.jsx:40
const token = searchParams.get('token');
// URL: /reset-password?token=abc123...
```

**Impact:**
- Tokens visible in browser history — local attacker can use them
- Tokens logged in web server access logs — anyone with log access can reset passwords
- Tokens leaked via `Referer` header if user clicks an external link on the reset page

**Remediation (Minimal Impact):**

1. **Use URL fragment** instead of query parameter (fragments are not sent to the server or logged):
   ```
   /reset-password#token=abc123...
   ```
   ```jsx
   // ResetPassword.jsx
   const token = new URLSearchParams(window.location.hash.substring(1)).get('token');
   ```

2. **Add `Referrer-Policy: no-referrer`** to the reset page (already partially done via nginx with `strict-origin-when-cross-origin`, but `no-referrer` is safer for this page)

3. **Set short token expiry** (15 minutes max) and single-use:
   ```sql
   -- Backend: mark token used after consumption
   UPDATE password_reset_tokens 
   SET used_at = GETDATE() 
   WHERE token_hash = @tokenHash AND used_at IS NULL;
   ```

---

### H-05: File Upload MIME Type Spoofing

| | |
|---|---|
| **OWASP Category** | A04:2021 – Insecure Design |
| **CWE** | CWE-434: Unrestricted Upload of File with Dangerous Type |
| **Affected Files** | `backend/controllers/attachmentsController.js` (lines 100-145) |

**Description:**

File upload validation checks the file extension and MIME type separately, but does not verify file contents using magic bytes. An attacker can upload an executable file with a `.jpg` extension and `image/jpeg` MIME type.

**Remediation (Minimal Impact):**

Install and use the `file-type` package for magic byte detection:
```bash
npm install file-type
```

```javascript
// attachmentsController.js
const { fileTypeFromBuffer } = require('file-type');

// After multer saves the file, validate magic bytes:
const buffer = require('fs').readFileSync(req.file.path);
const type = await fileTypeFromBuffer(buffer);

if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
  // Delete the uploaded file
  require('fs').unlinkSync(req.file.path);
  return res.status(400).json(
    createResponse(false, 'Invalid file type detected')
  );
}
```

---

### H-06: SQL Injection Risk via String Interpolation Patterns

| | |
|---|---|
| **OWASP Category** | A03:2021 – Injection |
| **CWE** | CWE-89: SQL Injection |
| **Affected Files** | Multiple controllers and services (30+ instances) |

**Description:**

While the core `executeQuery()` function properly uses parameterized queries (`request.input(key, value)`), numerous controllers build SQL WHERE/ORDER BY/SET clauses via JavaScript template literals and then interpolate the resulting strings into queries. The parameter values within these clauses ARE properly parameterized, but the clause structure is built via string concatenation, making the pattern fragile and error-prone.

**Affected Files and Patterns:**

| File | Line(s) | Pattern |
|------|---------|---------|
| `controllers/analytics.controller.js` | 37, 42, 47, 53 | `${dateFilter}` interpolated |
| `controllers/dashboard.controller.js` | 86, 93, 126, 267, 492 | `${ticketWhere}`, `${filter}` |
| `controllers/ratings.controller.js` | 493, 503, 521, 536, 548, 551, 554, 557 | `${dateFilter}` |
| `controllers/system.controller.js` | 266, 270, 274, 278 | `${whereClause}` |
| `services/outageNotificationService.js` | 43-47, 646, 690, 694, 700, 704, 708 | `${inClause}`, `${searchClause}` |
| `services/whatsappService.js` | 805, 811 | `${where}` |
| `controllers/whatsapp.controller.js` | 536 | `${placeholders}` |
| `controllers/ticketApprovals.controller.js` | 659 | `${setClauses.join(', ')}` in UPDATE |
| `services/approvalWorkflow.service.js` | 105 | `${ticketUpdateSetClauses.join(', ')}` in UPDATE |

**Example — analytics.controller.js:**
```javascript
// Line 37: dateFilter is built as:
// 'AND t.created_at BETWEEN @startDate AND @endDate'
// The VALUES are parameterized, but the clause string is interpolated:
const query = `SELECT ... FROM tickets t WHERE 1=1 ${dateFilter}`;
const result = await executeQuery(query, { startDate, endDate });
```

**Risk Assessment:**
- **Current Risk: MEDIUM-HIGH** — The interpolated strings are built from controlled internal variables (not direct user input), and values within them ARE parameterized. However:
  - A future developer could accidentally introduce user-controlled values into the clause string
  - The pattern bypasses the parameterization guarantee
  - Code review burden is high — each instance must be manually verified

**Remediation (Minimal Impact):**

Refactor to pass the full query as a parameterized string. Example for `analytics.controller.js`:

```javascript
// BEFORE (fragile):
let dateFilter = '';
if (startDate && endDate) {
  dateFilter = 'AND t.created_at BETWEEN @startDate AND @endDate';
}
const query = `SELECT ... FROM tickets t WHERE 1=1 ${dateFilter}`;

// AFTER (safe by construction):
let conditions = ['1=1'];
let params = {};
if (startDate && endDate) {
  conditions.push('t.created_at BETWEEN @startDate AND @endDate');
  params.startDate = startDate;
  params.endDate = endDate;
}
const query = `SELECT ... FROM tickets t WHERE ${conditions.join(' AND ')}`;
const result = await executeQuery(query, params);
```

This is functionally identical but keeps the pattern consistent and safe-by-construction.

---

### H-07: Nodemailer SMTP Command Injection (CVE)

| | |
|---|---|
| **OWASP Category** | A06:2021 – Vulnerable and Outdated Components |
| **CWE** | CWE-77: Command Injection |
| **Affected Package** | `nodemailer <=8.0.3` |

**Description:**

The installed version of nodemailer has two known vulnerabilities:
1. **GHSA-rcmh-qjqh-p98v** — DoS via recursive calls in addressparser
2. **GHSA-c7w3-x93f-qmm8** — SMTP command injection due to unsanitized `envelope.size` parameter

**Remediation:**
```bash
cd backend
npm audit fix
# or specifically:
npm install nodemailer@latest
```

---

### H-08: Express-Rate-Limit IPv4-Mapped IPv6 Bypass

| | |
|---|---|
| **OWASP Category** | A06:2021 – Vulnerable and Outdated Components |
| **CWE** | CWE-807: Reliance on Untrusted Inputs |
| **Affected Package** | `express-rate-limit 8.1.0` |

**Description:**

The rate limiter can be bypassed on dual-stack networks. An attacker can send requests from IPv4-mapped IPv6 addresses (e.g., `::ffff:192.168.1.1`) to circumvent per-IP rate limits, effectively doubling their allowed request volume.

**GHSA:** GHSA-46wh-pxpv-q5gq

**Remediation:**
```bash
npm install express-rate-limit@latest
```

---

### H-09: JWS Improper HMAC Signature Verification

| | |
|---|---|
| **OWASP Category** | A06:2021 – Vulnerable and Outdated Components |
| **CWE** | CWE-347: Improper Verification of Cryptographic Signature |
| **Affected Package** | `jws <3.2.3` |

**Description:**

The `jws` package (dependency of `jsonwebtoken`) has improper HMAC signature verification (GHSA-869p-cjfg-cm3x). This could allow an attacker to forge signatures under specific conditions.

**Remediation:**
```bash
npm audit fix
# Ensure jws >= 3.2.3
```

---

### H-10: Quill XSS via HTML Export (Frontend)

| | |
|---|---|
| **OWASP Category** | A06:2021 – Vulnerable and Outdated Components |
| **CWE** | CWE-79: Cross-Site Scripting |
| **Affected Package** | `quill =2.0.3` (via `react-quill`) |

**Description:**

The Quill rich text editor (used for email templates and KB articles) has an XSS vulnerability in its HTML export feature (GHSA-v3m3-f69x-jf25). Crafted input can produce HTML that executes JavaScript when rendered.

**Remediation:**
```bash
cd frontend
npm audit fix
# or: npm install quill@latest react-quill@latest
```

Additionally, always sanitize Quill HTML output before rendering:
```javascript
import DOMPurify from 'dompurify';
const safeHtml = DOMPurify.sanitize(quillEditor.root.innerHTML);
```

---

## 6. MEDIUM Findings

### M-01: CORS Fallback to Localhost

| | |
|---|---|
| **Affected Files** | `backend/config/config.js` (line 184) |

**Description:**

If `CORS_ORIGIN` environment variable is not set, the CORS configuration defaults to `http://localhost:5173`. While harmless in development, if this default leaks into a production deployment, it would allow requests from any origin since the CORS check would fail silently.

**Remediation:**

```javascript
// config.js
cors: {
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' 
    ? (() => { throw new Error('CORS_ORIGIN must be set in production'); })()
    : 'http://localhost:5173'),
}
```

---

### M-02: Database Backups Stored Unencrypted

| | |
|---|---|
| **Affected Files** | `backend/services/backup.service.js` |

**Description:**

Database backup files are stored as plaintext `.bak` files. If the backup volume is compromised, all data (including password hashes, user PII, tickets) is exposed.

**Remediation:**

Encrypt backups using SQL Server's built-in backup encryption:
```sql
BACKUP DATABASE ITHelpdesk
TO DISK = '/backup/ITHelpdesk.bak'
WITH ENCRYPTION (
  ALGORITHM = AES_256,
  SERVER CERTIFICATE = BackupCert
);
```

Or use filesystem-level encryption (e.g., LUKS for Docker volumes).

---

### M-03: Console.log Statements in Production Frontend

| | |
|---|---|
| **Affected Files** | `frontend/src/App.jsx` (lines 71-85), `frontend/src/context/NotificationContext.jsx` (lines 65-80), `frontend/src/components/helpdesk/AIAssistant.jsx` (line 234), `frontend/src/components/common/ErrorBoundary.jsx` (line 14), `frontend/src/components/common/Sidebar.jsx` (line 555) |

**Description:**

Debug `console.log()` statements in the production frontend expose:
- API response data including user objects
- WebSocket connection details
- Error stack traces
- Internal state information

Attackers can open browser DevTools and observe sensitive information flowing through the application.

**Remediation:**

1. **Remove all debug console.log** from production code, or
2. **Use a build-time transform** to strip console statements:
   ```javascript
   // vite.config.js
   export default defineConfig({
     esbuild: {
       drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
     },
   });
   ```

---

### M-04: Password Reset Token Reuse

| | |
|---|---|
| **Affected Files** | `backend/controllers/password-reset.controller.js` |

**Description:**

When a user requests a new password reset, old reset tokens are not invalidated. An attacker who intercepts an earlier token can still use it even after the user requests a new one.

**Remediation:**

```javascript
// Before inserting new token, invalidate all existing tokens for this user:
await executeQuery(
  `UPDATE password_reset_tokens 
   SET used_at = GETDATE() 
   WHERE user_id = @userId AND used_at IS NULL`,
  { userId }
);
```

---

### M-05: Rate Limiter Bypassed When DB is Down

| | |
|---|---|
| **Affected Files** | `backend/middleware/rateLimiter.js` |

**Description:**

The rate limiter stores its counters in the database. If the database is unavailable, the rate limiter either fails open (allowing unlimited requests) or uses potentially permissive defaults.

**Remediation:**

Use an in-memory fallback when the database is unavailable:

```javascript
// Simple in-memory fallback
const memoryStore = new Map();

async function checkRateLimit(key, limit, windowMs) {
  try {
    return await dbBasedRateLimit(key, limit, windowMs);
  } catch (err) {
    // Fallback to memory-based limiting
    const now = Date.now();
    const entry = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    memoryStore.set(key, entry);
    return entry.count <= limit;
  }
}
```

---

### M-06: No CSRF Protection

| | |
|---|---|
| **Affected Files** | `backend/server.js` |

**Description:**

No CSRF protection middleware is implemented. Currently, JWT tokens are stored in localStorage and sent via `Authorization` header, which naturally prevents CSRF. However, if the application migrates to cookie-based authentication (as recommended in C-06), CSRF protection becomes essential.

**Remediation:**

If migrating to cookies, add CSRF protection:
```bash
npm install csrf-csrf
```

```javascript
const { doubleCsrf } = require('csrf-csrf');
const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__csrf',
  cookieOptions: { sameSite: 'strict', secure: true },
});
app.use(doubleCsrfProtection);
```

For the current localStorage-based auth, `SameSite` cookie attribute on any cookies provides adequate protection.

---

### M-07: Weak Bcrypt Rounds

| | |
|---|---|
| **Affected Files** | `.env` (line 29) |

**Description:**

`BCRYPT_ROUNDS=10` is the minimum acceptable value. OWASP and modern best practices recommend 12+ rounds (2024 guidance).

**Remediation:**

```env
BCRYPT_ROUNDS=12
```

Note: Existing password hashes remain valid (bcrypt stores the round count in the hash). New passwords and password changes will use the higher rounds.

---

### M-08: Database Container Initially Runs as Root

| | |
|---|---|
| **Affected Files** | `docker/db/Dockerfile` |

**Description:**

The database Dockerfile uses `USER root` for package installation, then switches to `mssql` user. While this is common practice, if the switch fails or is bypassed, the container runs as root.

**Remediation:**

Ensure the `USER mssql` directive is the final user instruction and cannot be skipped:
```dockerfile
# After all root operations
USER mssql
ENTRYPOINT ["/entrypoint.sh"]
```

Verify at runtime:
```bash
docker exec helpdesk-db whoami  # Should output 'mssql'
```

---

## 7. LOW / Informational Findings

### L-01: Missing Strict-Transport-Security Header

| | |
|---|---|
| **Affected Files** | `frontend/nginx/conf.d/default.conf` |

The nginx configuration has good security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`) but is missing `Strict-Transport-Security`. This should be added when TLS is enabled (see H-02).

---

### L-02: Server Version Headers

While `server_tokens off` may be set in `nginx.conf`, the application server (Express/Node.js) may leak version information. Helmet's `hidePoweredBy` handles Express, but verify nginx is not exposing its version.

**Remediation:**
```nginx
# nginx.conf
server_tokens off;
```

---

### L-03: JWT Issuer/Audience Use Generic Values

The JWT configuration uses generic `issuer` and `audience` values. While not directly exploitable, deployment-specific values add defense-in-depth against token reuse across environments.

**Remediation:**
```env
JWT_ISSUER=it-helpdesk-prod
JWT_AUDIENCE=it-helpdesk-api-prod
```

---

### L-04: Verbose Error Messages in Development Mode

Error responses include stack traces when `NODE_ENV=development`. Ensure this is never set in production deployments.

**Verification:**
```yaml
# docker-compose.yml (production)
environment:
  NODE_ENV: "production"   # ✅ Already correctly set
```

---

### L-05: License JSON Files in Repository

License files are committed under `license-generator/storage/licenses/`. While they contain signed license data (not secrets), they disclose customer information and license terms.

**Remediation:** Add to `.gitignore` (already done) and remove from history:
```bash
git rm -r --cached license-generator/storage/licenses/
```

---

## 8. Dependency Vulnerability Report

### Backend (15 vulnerabilities)

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `body-parser 2.2.0` | Moderate | DoS via URL encoding (GHSA-wqch-xfxh-vrr4) | `npm audit fix` |
| `brace-expansion 2.0.0-2.0.2` | Moderate | Zero-step sequence hang (GHSA-f886-m6hf-6m8v) | `npm audit fix` |
| `dompurify <=3.3.1` | Moderate | Mutation-XSS + XSS (GHSA-h8r8-wccr-v5f2, GHSA-v2wj-7wpq-c8vv) | `npm audit fix` |
| `express-rate-limit 8.1.0` | **High** | IPv4-mapped IPv6 bypass (GHSA-46wh-pxpv-q5gq) | `npm audit fix` |
| `jws <3.2.3` | **High** | Improper HMAC verification (GHSA-869p-cjfg-cm3x) | `npm audit fix` |
| `lodash 4.x` | Moderate | Prototype pollution in `_.unset`/`_.omit` (GHSA-xxjr-mmjv-4gpg) | `npm audit fix` |
| `minimatch 5.0-5.1.7, 9.0-9.0.6` | **High** | Multiple ReDoS vulnerabilities (3 CVEs) | `npm audit fix` |
| `multer <=2.1.0` | **High** | 3× DoS: incomplete cleanup, resource exhaustion, recursion | `npm audit fix` |
| `nodemailer <=8.0.3` | **High** | DoS + SMTP command injection (2 CVEs) | `npm audit fix` |
| `path-to-regexp 8.0-8.3.0` | **High** | 2× DoS: sequential optional groups, wildcards | `npm audit fix` |
| `qs <=6.14.1` | Moderate | arrayLimit bypass DoS (2 CVEs) | `npm audit fix` |
| `validator <=13.15.20` | **High** | URL validation bypass + filtering bypass (2 CVEs) | `npm audit fix` |
| `imapflow` | (transitive) | Depends on vulnerable nodemailer | Updated with nodemailer |
| `mailparser` | (transitive) | Depends on vulnerable nodemailer | Updated with nodemailer |
| `express-validator` | (transitive) | Depends on vulnerable validator | Updated with validator |

### Frontend (3 vulnerabilities)

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `brace-expansion <1.1.13, 2.0-2.0.3` | Moderate | Zero-step sequence hang (GHSA-f886-m6hf-6m8v) | `npm audit fix` |
| `quill =2.0.3` | Low | XSS via HTML export (GHSA-v3m3-f69x-jf25) | `npm audit fix` |
| `react-quill` | Low (transitive) | Depends on vulnerable quill | Updated with quill |

### Remediation Command

```bash
# Backend
cd backend && npm audit fix

# Frontend
cd frontend && npm audit fix

# Verify
npm audit --omit=dev
```

---

## 9. Remediation Priority Matrix

### Phase 1 — Immediate (48 hours)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| 1 | C-01 | Rotate all secrets (JWT, DB password, license key) | Low |
| 2 | C-05 | Add DOMPurify.sanitize() to AIAssistant.jsx and TemplatePreview.jsx | Low |
| 3 | C-02 | Generate new ED25519 key pair, remove old from git history | Low |
| 4 | H-07,08,09,10 | Run `npm audit fix` on backend and frontend | Low |
| 5 | C-03 | Move SA password to Docker secrets | Medium |

### Phase 2 — Short-term (1 week)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| 6 | C-04 | Enable DB_ENCRYPT=true | Low |
| 7 | H-03 | Remove DB port mapping from production docker-compose | Low |
| 8 | H-01 | Remove `unsafe-eval` from CSP, test with charting libraries | Medium |
| 9 | H-05 | Add magic byte validation for file uploads | Medium |
| 10 | M-03 | Add console drop in vite.config.js for production builds | Low |

### Phase 3 — Medium-term (2 weeks)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| 11 | C-06 | Migrate JWT to HttpOnly cookies | High |
| 12 | H-02 | Add TLS termination to nginx | Medium |
| 13 | H-04 | Move reset token to URL fragment | Low |
| 14 | M-04 | Invalidate old reset tokens on new request | Low |
| 15 | H-06 | Refactor SQL interpolation to safe-by-construction pattern | High |

### Phase 4 — Long-term (1 month)

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| 16 | M-01 | Fail-fast CORS in production if CORS_ORIGIN unset | Low |
| 17 | M-02 | Enable backup encryption | Medium |
| 18 | M-05 | Add memory-based rate limit fallback | Medium |
| 19 | M-06 | Add CSRF protection (after cookie migration) | Medium |
| 20 | M-07 | Increase bcrypt rounds to 12 | Low |
| 21 | H-01 | Migrate to nonce-based CSP | High |

---

## 10. Security Best Practices Checklist

### Currently Implemented ✅

| Practice | Status | Notes |
|----------|--------|-------|
| Parameterized SQL queries (core) | ✅ | `executeQuery()` uses `request.input()` |
| Password hashing (bcrypt) | ✅ | With configurable rounds |
| JWT session management | ✅ | Token hash stored in DB, session validation on every request |
| Session timeout enforcement | ✅ | 8-hour inactivity check via `securityService` |
| Account lockout | ✅ | Timed lockout with configurable threshold |
| Helmet security headers | ✅ | CSP (API), X-Content-Type, X-Frame-Options |
| CORS configuration | ✅ | Origin-restricted |
| Rate limiting | ✅ | On `/api/` routes |
| Request body size limit | ✅ | 10MB limit via body-parser |
| Input validation | ✅ | express-validator on many routes |
| Role-based access control | ✅ | Per-endpoint permission checks |
| Nginx security headers | ✅ | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Request ID tracking | ✅ | UUID per request for log correlation |
| License enforcement | ✅ | Blocks authenticated traffic when license invalid |
| Maintenance mode | ✅ | Global toggle to restrict access |

### Not Implemented / Needs Improvement ❌

| Practice | Status | Priority |
|----------|--------|----------|
| Secrets management (vault/secrets manager) | ❌ | Critical |
| TLS/HTTPS in production | ❌ | High |
| HttpOnly cookie-based auth | ❌ | High |
| HSTS header | ❌ | High |
| DOMPurify on all HTML rendering | ❌ (2/5 locations missing) | Critical |
| Magic byte file upload validation | ❌ | High |
| Nonce-based CSP | ❌ | Medium |
| Backup encryption | ❌ | Medium |
| CSRF protection | ❌ | Medium (after cookie migration) |
| Dependency update automation (Dependabot) | ❌ | Medium |
| Security audit logging (SIEM integration) | ❌ | Low |
| Content-Type validation on API responses | ❌ | Low |
| Subresource Integrity (SRI) hashes | ❌ | Low |

---

## Appendix A: Tools & Methodology

### Static Analysis
- **Manual code review** of all source files in: `backend/`, `frontend/src/`, `docker/`, `license-generator/`
- **Pattern matching** via `grep` for: SQL injection (`${`, `executeQuery`, template literals), XSS (`dangerouslySetInnerHTML`), command injection (`child_process`, `exec`, `spawn`), eval/Function, hardcoded secrets
- **Dependency audit** via `npm audit --omit=dev` on both backend and frontend

### Standards Referenced
- **OWASP Top 10 (2021)** — A01-A10
- **CWE/SANS Top 25 Most Dangerous Software Weaknesses**
- **NIST SP 800-53** — Security Controls
- **OWASP ASVS 4.0** — Application Security Verification Standard

### Files Reviewed (partial list)
- `backend/server.js` — Express configuration, middleware chain, helmet, CORS, rate limiting
- `backend/config/database.js` — SQL connection pool, `executeQuery()` implementation
- `backend/config/config.js` — Environment variable handling, defaults
- `backend/middleware/auth.js` — JWT verification, session validation, account lockout
- `backend/middleware/rateLimiter.js` — Rate limiting implementation
- `backend/controllers/auth.controller.js` — Login, registration, token management
- `backend/controllers/attachmentsController.js` — File upload handling
- `backend/controllers/analytics.controller.js` — SQL query patterns
- `backend/controllers/dashboard.controller.js` — SQL query patterns
- `backend/controllers/ratings.controller.js` — SQL query patterns
- `backend/controllers/system.controller.js` — SQL query patterns
- `backend/controllers/ticketApprovals.controller.js` — SQL query patterns
- `backend/controllers/whatsapp.controller.js` — SQL query patterns
- `backend/controllers/password-reset.controller.js` — Reset flow
- `backend/services/whatsappService.js` — SQL query patterns
- `backend/services/outageNotificationService.js` — SQL query patterns
- `backend/services/approvalWorkflow.service.js` — SQL query patterns
- `backend/services/backup.service.js` — Backup implementation
- `backend/services/security.service.js` — Session/lockout logic
- `frontend/src/context/AuthContext.jsx` — Token storage
- `frontend/src/services/api.js` — API client, interceptors
- `frontend/src/services/authService.js` — Auth service
- `frontend/src/components/helpdesk/AIAssistant.jsx` — XSS vector
- `frontend/src/components/email/TemplatePreview.jsx` — XSS vector
- `frontend/src/pages/HelpCenter.jsx` — DOMPurify usage (positive finding)
- `frontend/src/pages/auth/ResetPassword.jsx` — Reset token handling
- `frontend/index.html` — CSP meta tag
- `frontend/nginx/conf.d/default.conf` — Nginx security headers
- `docker/production-release/docker-compose.yml` — Container configuration
- `docker/production-release/.env` — Production secrets
- `docker/db/Dockerfile`, `docker/db/Dockerfile.patch` — DB container
- `license-generator/server/lib/license-core.js` — Key handling
- `license-generator/.gitignore` — Key exclusion rules
- `.env` — Application secrets
- `.gitignore` files — Exclusion rules

---

**End of Security Audit Report**

*This report should be treated as confidential. Do not distribute outside the development team.*
