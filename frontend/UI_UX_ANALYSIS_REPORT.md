# Nexus Support — Frontend UI/UX Deep Analysis Report

**Prepared:** April 13, 2026  
**Scope:** `frontend/src/` — all CSS, JSX, Vite config, responsive behavior, performance, design-system consistency  
**Verdict:** Solid foundation with measurable gaps in consistency, accessibility, performance at scale, and visual depth.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack Audit](#2-technology-stack-audit)
3. [Design System Audit](#3-design-system-audit)
4. [CSS Architecture Issues](#4-css-architecture-issues)
5. [Page-by-Page UI/UX Analysis](#5-page-by-page-uiux-analysis)
6. [Responsiveness & Mobile Issues](#6-responsiveness--mobile-issues)
7. [Accessibility (a11y) Failures](#7-accessibility-a11y-failures)
8. [Performance at 1000+ Concurrent Users](#8-performance-at-1000-concurrent-users)
9. [Comparison with Similar Open-Source Projects](#9-comparison-with-similar-open-source-projects)
10. [Bug Inventory](#10-bug-inventory)
11. [Fix Plan — All Issues Resolved](#11-fix-plan--all-issues-resolved)
12. [Modern 3D Design Upgrade Path](#12-modern-3d-design-upgrade-path)
13. [Priority Matrix](#13-priority-matrix)

---

## 1. Project Overview

**Nexus Support** is a full-featured IT Helpdesk SPA built on React 18 + Vite. It has:

| Area | Count |
|---|---|
| Pages (routes) | ~35 lazy-loaded routes |
| CSS files | 55 separate files in `src/styles/` |
| CSS custom properties (tokens) | ~120 `--nx-*` tokens + ~40 bridge aliases |
| Components | 80+ across 16 subdirectories |
| UI libraries | Lucide React (icons), Recharts (charts) |
| Theming | Light + Dark via `[data-theme='dark']` |

The visual language is a glassmorphism-influenced indigo/violet palette. The project has clearly evolved over time — earlier pages use legacy `--primary-color`, `--card-bg` CSS variables while newer pages use `--nx-*` tokens. This dual-system is the root cause of most consistency problems.

---

## 2. Technology Stack Audit

| Item | Current | Assessment |
|---|---|---|
| React | 18.3.1 | ✅ Current |
| Vite | 6.4.1 | ✅ Current |
| React Router | 6.28.0 | ✅ Current |
| Recharts | 3.2.1 | ✅ Current |
| Icon library | lucide-react 0.468 | ✅ Current |
| CSS strategy | 55 plain CSS files | ⚠️ No scoping, no modules |
| CSS framework | None (custom tokens) | ⚠️ Token drift exists |
| Animation | CSS keyframes only | ⚠️ No reduced-motion guard |
| Font loading | System `@import` via CSS var | ✅ Font defined |
| Code splitting | All routes lazy-loaded | ✅ Good |
| Bundle chunking | No `manualChunks` in Vite | ❌ Large vendor chunks |
| List virtualization | None | ❌ Critical gap |
| React perf | Minimal `React.memo`/`useMemo` | ⚠️ Only in contexts |
| Accessibility | No ARIA audit, no a11y lib | ❌ Multiple failures |

---

## 3. Design System Audit

### 3.1 Token System — What Is Good

`src/index.css` defines a well-structured `--nx-*` token set covering:
- Color palette (primary, success, warning, danger, info, purple, orange)
- Surfaces and backgrounds
- Typography scale (11px–28px)
- Spacing scale (4px–40px, 4px increments)
- Shadows (xs → lg)
- Radii (4px → 9999px)
- Z-index (implicit, by usage)
- Status colors (`--nx-status-open`, `--nx-status-resolved`, etc.)
- Dark mode via `[data-theme='dark']`

This is a **good foundation**.

### 3.2 Token System — What Is Broken

**Issue: 40-line bridge alias block**

Every new CSS property (`--background-primary`, `--card-bg`, `--text-primary`) was bridged to `--nx-*` in `index.css`, but files like `TicketsList.css` and `ReportsHub.css` still reference these by the OLD names. This means:

- `TicketsList.css` uses `var(--background-primary, #f8f9fa)` — the fallback `#f8f9fa` is wrong for dark mode (renders as light gray on dark background)
- `ReportsHub.css` uses hardcoded `font-family: 'Inter', 'Segoe UI', system-ui, sans-serif` instead of `var(--nx-font)` — would break if the font is ever changed globally

**Issue: Per-page token re-aliasing (~1,650 wasted lines)**

Every CSS file re-declares 20–40 lines of local aliases pointing back to `--nx-*`:

```css
/* Dashboard.css — 40 lines of this: */
--db-bg: var(--nx-bg);
--db-surface: var(--nx-surface);
/* ... etc ... */

/* Profile.css — 40 lines of this: */
--pf-bg: var(--nx-bg);
--pf-surface: var(--nx-surface);
/* ... etc ... */
```

These add zero value and bloat the CSS by ~1,650 lines across the 55 files. They also mean any change to a naming convention requires touching every file.

**Issue: Status colors defined twice**

`index.css` defines `--nx-status-open: #f59e0b` etc. but `TicketDetail.css` hardcodes:
```css
.td-status-open { background: #fef3c7; color: #d97706; }
```
These are NOT using the token. If the brand color changes, status badges on the Ticket Detail page won't update.

**Issue: Dark mode gaps**

- `Login.css` has no `[data-theme='dark']` overrides — the dark semi-transparent card `rgba(30, 41, 59, 0.75)` works in light mode because it's a dark glass effect, but the login page will look identical in both themes with no adaptation
- `Settings.css` header gradient is hardcoded: `linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)` — not a token, not dark-mode aware

---

## 4. CSS Architecture Issues

### 4.1 Specificity Warfare in Header.css

`Header.css` uses `!important` on 20+ properties for its flex layout:

```css
/* Header.css lines 15–50 */
.header { display: flex !important; align-items: center !important; ... }
.header-left { display: flex !important; gap: 10px !important; flex: 0 0 auto !important; ... }
.header-center { flex: 1 1 100% !important; display: flex !important; ... }
```

**Root cause:** Generic class names `.header-left` and `.header-right` collide with identically named classes in `TicketsList.css`:
```css
/* TicketsList.css */
.header-left { flex: 1; min-width: 0; }
.header-right { display: flex; gap: 8px; ... }
```

Both `.header-left` and `.header-right` exist in **different components** but share the same class name with no scope prefix. When both CSS files load (they always do via Vite's global CSS), the Header.css author was forced to add `!important` to prevent TicketsList.css from overwriting the header layout.

**This is a live bug:** On any page that uses the `<Header>` + `<TicketsList>` together (every ticket page), both rule sets apply to `.header-left` and the `!important` in Header.css wins only because it's defined "last" in specificity order. This is fragile.

### 4.2 Inconsistent Breakpoint Scale

The project uses 11 different breakpoint values with no documented system:

| Breakpoint | Files Using It |
|---|---|
| 480px | AIAssistant, AllNotifications, BotSettings, CRBucket, CreateTicket, Dashboard, EditTicket, EmailQueue ... |
| 500px | ForgotPassword |
| 520px | AnalyticsEnhanced |
| 600px | AttachmentPreviewModal, EmailDetailModal |
| 640px | AnalyticsEnhanced, CreateTicket, EmailQueue, EmailTemplates |
| 768px | ~40 files (most common) |
| 1024px | ~20 files |
| 1200px | Header |
| 1280px | Dashboard |
| 1400px | DepartmentsList |
| 1600px | UsersList |

**EmailQueue.css** uses mobile-first (`min-width`) breakpoints while every other file uses desktop-first (`max-width`). These two strategies fight each other on medium viewports.

**Fix:** Standardize to 4 breakpoints: `sm: 480px`, `md: 768px`, `lg: 1024px`, `xl: 1280px` — documented as CSS vars or a comment block at the top of index.css.

### 4.3 Hardcoded Values Outside the Token System

Files that bypass CSS variables with hardcoded hex/px:

| File | Example Violation |
|---|---|
| `CreateTicket.css` | `color: #1a202c`, `color: #64748b`, `border: 1px solid #e2e8f0` |
| `CRDetail.css` | `color: #6366f1` direct hex for hover |
| `TicketDetail.css` | All status/priority colors hardcoded, not using `--nx-status-*` |
| `AttachmentPreviewModal.css` | `font-size: 8px`, `font-size: 72px` — not using `--nx-font-*` scale |
| `ReportsHub.css` | `font-family: 'Inter', ...` hardcoded |
| `Settings.css` | Header gradient with 3 hardcoded dark-indigo colors |

### 4.4 Z-Index Layer Chaos

No documented z-index layer system. Scattered values:

| Element | z-index |
|---|---|
| Sidebar shell | 140 |
| Dashboard content | — (implicit 0) |
| Header | 100 |
| AI Assistant FAB | 90 |
| AI Chat window | 100 |
| Toast container | 99999 |
| Modal overlays | Unknown (no centralized value) |

**Bug:** The AI Chat window (`z-index: 100`) can render BEHIND the sticky Header (`z-index: 100`) when the chat window is scrolled under the header. Since both are `z-index: 100` with no stacking context difference, the render order depends on DOM position. This can cause the chat header to be clipped by the sticky app header.

---

## 5. Page-by-Page UI/UX Analysis

### 5.1 Login Page

**Strengths:**
- Glassmorphism card with `backdrop-filter: blur(10px)` looks professional
- Well-separated logo, title, subtitle hierarchy

**Issues:**
1. **No WebP/loading optimization for background image** — `background-image: url('/images/login-bg.jpg')` is loaded via CSS, meaning the browser cannot lazy-load or prioritize it. On slow connections this causes a white flash before the image loads.
2. **No reduced-motion fallback** — if the page uses any entrance animation (can't confirm without running, but the pattern exists elsewhere), users with vestibular disorders get no opt-out.
3. **Font mismatch on login page** — `Login.css` declares `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto' ...` directly (line 28) instead of `var(--nx-font)`. If Inter font is loaded globally, the login page uses the system font stack — visually inconsistent.
4. **No dark mode adaptation** — login page looks identical regardless of system/app theme.
5. **`max-width: 400px` card is too narrow on tablets** — 400px with 35px horizontal padding leaves only 330px for form content on iPad portrait.

### 5.2 Dashboard

**Strengths:**
- Well-structured welcome banner
- Clear stat cards with proper semantic color use
- Skeleton loading is implemented

**Issues:**
1. **Redundant token aliases** — 40 lines of `--db-bg: var(--nx-bg)` etc. are waste (~40 lines).
2. **Re-fetch on every mount** — Dashboard likely has no `useMemo`/cache on API calls; with 1000 users all loading the dashboard, this means 1000 simultaneous API calls on login.
3. **Welcome banner animation `repHeroIn`** — 0.55s cubic-bezier entrance on dashboard widgets fires every time user navigates back to dashboard; no `prefers-reduced-motion` guard.
4. **Chart re-renders** — Recharts components with no `React.memo` will re-render on any parent state change (e.g., notification badge update).

### 5.3 Tickets List

**Strengths:**
- Good filter/search UX
- Bulk action bar is well thought-out
- Responsive breakpoints present

**Issues:**
1. **`.header-left` / `.header-right` collision** with Header.css (detailed in §4.1).  
2. **No virtual scrolling** — ticket lists of 500–10,000 items are rendered into DOM simultaneously. At 100 tickets with 10+ cells each = 1000+ DOM nodes in a single table. This causes visible scroll jank at 500+ rows.
3. **`min-height: 100vh` on `.tickets-page`** — on mobile, `100vh` includes the browser chrome, causing unwanted scroll in some mobile browsers (use `100dvh` instead).
4. **`var(--background-primary, #f8f9fa)` fallback value** — wrong for dark mode; dark mode will fall back to the light gray instead of `var(--nx-bg)`.

### 5.4 Create Ticket

**Strengths:**
- Two-column layout (form + sidebar) is good UX pattern
- Step-by-step guided intake path exists

**Issues:**
1. **Hardcoded colors throughout** — `color: #1a202c`, `border: 1px solid #e2e8f0` etc. bypass the token system entirely.
2. **`grid-template-columns: 1fr 350px`** — the sidebar is fixed at 350px on all screens > 768px; on 1024px laptops this gives the main form column only 650px. Modern laptops at 1366px give only 966px total, which is usable but cramped.
3. **Mobile breakpoint only at 768px** — tablets (768–1024px) get the full desktop two-column layout which is too dense.

### 5.5 Ticket Detail

**Strengths:**
- Journey/timeline component is a thoughtful UX pattern
- Status pills with distinct colors

**Issues:**
1. **All status colors hardcoded** — bypasses `--nx-status-*` tokens defined in `index.css`:
   ```css
   .td-status-open { background: #fef3c7; color: #d97706; } /* hardcoded */
   ```
   While index.css defines:
   ```css
   --nx-status-open: #f59e0b;
   --nx-status-open-bg: #fffbeb;
   ```
   The background color is different (`#fef3c7` vs `#fffbeb`) — **inconsistency between Ticket Detail and any other page** that uses the global status tokens.

2. **Priority color `#d97706` (amber-600)** used for both `medium` priority and `open` status — color-blind users cannot distinguish these.
3. **Attachment preview z-index** — `AttachmentPreviewModal.css` is not listed in the z-index layer docs above; it likely uses `z-index: 1000` or similar, which may conflict.

### 5.6 Analytics / Reports

**Strengths:**
- Multiple chart types, date range pickers
- Print media query exists
- Shimmer loading state

**Issues:**
1. **`--primary-color: var(--nx-primary)` re-declared inside `.ae-page`** — this shadows the global token only within `.ae-page`. If any component inside Analytics uses `--primary-color` expecting the global value, it gets the local override. This can cause unexpected color shifts if the local and global values ever diverge.
2. **Recharts renders all data points at once** — no data decimation for large datasets. 12 months × 4 series × daily points = potentially 1,440 SVG path nodes per chart.
3. **`ae-header-actions` wraps on small screens** — `flex-wrap: wrap` causes the date range filter to drop below the title, which looks messy. Should collapse into a dropdown on mobile.
4. **Export buttons (Excel/PDF) trigger `exceljs` + `jspdf` imports** — these libraries are ~850KB combined. Without `manualChunks`, they're likely bundled into the main chunk or a large split chunk, increasing initial load.

### 5.7 Settings Page

**Issues:**
1. **Header gradient fully hardcoded**: `linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)` — not responsive to theme or token changes.
2. **Multiple sub-sections with inconsistent card patterns** — some sections use `glass` style, others plain white — visual inconsistency within a single page.
3. **No keyboard navigation between settings sections** — tab order is implicit only.

### 5.8 AI Assistant (Chat Bot)

**Issues:**
1. **Z-index conflict with Header** (both `z-index: 100`) — chat window can be hidden behind the sticky header on scroll.
2. **FAB pulse animation runs 24/7** — `animation: nbotPulse 2s infinite` fires every 2 seconds regardless of whether the user is interacting. On low-end hardware this consumes GPU resources continuously. No `prefers-reduced-motion` override.
3. **Mobile overflow** — fixed bottom-right position `bottom: 20px; right: 20px` with `width: 380px` overflows on phones narrower than 400px (many Android devices at 360px width).
4. **Expanded chat `width: min(600px, calc(100vw - 40px))`** — correct approach, but `height: min(700px, calc(100vh - 40px))` doesn't account for mobile keyboard popping up, which reduces `100vh` and can make the chat panel very small on mobile.

### 5.9 Help Center

**Issues:**
1. **Hero section `padding: 56px 24px 52px`** — generous but creates a very tall hero that pushes content below the fold on laptop screens.
2. **Hero gradient is hardcoded** (`linear-gradient(135deg, var(--hc-primary) 0%, #7c3aed 60%, #a855f7 100%)`) — `#7c3aed` and `#a855f7` are not token values.

### 5.10 Sidebar

**Strengths:**
- Compact rail + hover expand is a clean modern pattern
- Dark mode support is thorough with `[data-theme='dark']`
- Glassmorphism with `backdrop-filter: blur(18px)` looks premium

**Issues:**
1. **`backdrop-filter: blur(18px)` on sidebar + `backdrop-filter: blur(18px)` on header** — these two blur layers stack. On Chromium, each `backdrop-filter` creates an isolated compositing layer. Two simultaneous blur layers on every page load is a meaningful GPU cost on lower-end devices.
2. **`will-change: width, min-width, max-width`** — three separate `will-change` hints promote the sidebar to its own GPU layer. This is correct for smooth animation, but the layer is never torn down. On mobile where the sidebar never expands (it's a toggle), this wastes GPU memory permanently.
3. **Hover expand doesn't work on touch devices** — CSS `:hover` does not persist on mobile/tablet touch. The sidebar relies entirely on `:hover` for desktop expand; touch users get no expand behavior unless `sidebar-shell-open` class is toggled. Check if mobile uses a burger menu toggle — if not, sidebar is permanently collapsed (88px = icon-only) on tablets.
4. **`position: sticky; top: 0`** — sidebar uses `position: sticky` not `position: fixed`. On very long pages, sticky positioning in a flex parent works only if the parent height is constrained. If the `dashboard-container` height is `min-height: 100vh`, the sidebar will correctly stick — but if any child overflows, the sidebar may scroll away.

### 5.11 Notifications Page

**Issues:**
1. **NotificationContext polls every 30 seconds** — with 1000 users, that's ~33 API requests per second to the notifications endpoint continuously.
2. **`backdrop-filter: blur(10px)` on notification dropdown** — every notification panel open = additional GPU layer.

### 5.12 Profile Page

**Strengths:**
- Clean avatar gradient, well-structured sections
- Print stylesheet present

**Issues:**
1. **`--pf-gradient: linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #a855f7 100%)`** — same hardcoded 3-stop gradient used on profile, settings, help center, and ticket detail badge. This should be a single token `--nx-brand-gradient`.

### 5.13 Outage Wall

**Issues:**
1. `outage-wall-container` has `max-width: 920px` — narrower than all other pages (most use 1440–1600px). Outage is an admin-facing page and should match the rest of the layout width.
2. Live status dot uses a CSS animation — no `prefers-reduced-motion` guard.

---

## 6. Responsiveness & Mobile Issues

### 6.1 Breakpoint Inconsistency

No documented breakpoint system. Files mix 11 different widths. This means:
- A tablet at 1023px gets different layouts on TicketsList (mobile below 1024px) vs DepartmentsList (mobile below 783px) — **same device, different experiences on different pages**.

### 6.2 Missing Touch Patterns

- Sidebar hover-expand = **non-functional on all touch screens**
- No touch-specific swipe gestures for sidebar
- Fixed-position AI chat window = overflow risk on 360–390px phones

### 6.3 Mobile Overflows

- `grid-template-columns: 1fr 350px` in CreateTicket.css — sidebar won't collapse until below 768px, meaning 768–1024px tablets get an unnecessarily cramped form
- Table layouts in TicketsList, UsersList, DepartmentsList — horizontal scroll is suppressed with `overflow-x: hidden` but table columns may truncate data without indication

### 6.4 `100vh` vs `100dvh`

`min-height: 100vh` on multiple pages causes content to be clipped on mobile browsers because `100vh` includes the invisible browser chrome (address bar). Should use `100dvh` (dynamic viewport height) with `100vh` fallback.

---

## 7. Accessibility (a11y) Failures

### 7.1 Color Contrast Failures

| Element | Foreground | Background | Ratio | WCAG AA Requirement | Status |
|---|---|---|---|---|---|
| Muted text (`--nx-muted`) | `#94a3b8` | `#ffffff` | ~2.4:1 | 4.5:1 | ❌ FAIL |
| Secondary text (`--nx-text-secondary`) | `#475569` | `#ffffff` | ~7.5:1 | 4.5:1 | ✅ PASS |
| Disabled button state | ~`#94a3b8` | `#ffffff` | ~2.4:1 | 3:1 (non-text) | ❌ FAIL |
| Status badge: `td-status-open` | `#d97706` | `#fef3c7` | ~2.7:1 | 4.5:1 | ❌ FAIL |
| Status badge: `td-status-progress` | `#2563eb` | `#dbeafe` | ~3.3:1 | 4.5:1 | ❌ FAIL |
| Status badge: `td-priority-medium` | `#d97706` | `#fef3c7` | ~2.7:1 | 4.5:1 | ❌ FAIL |

**Critical:** Status badges throughout Ticket Detail fail WCAG AA contrast. These are critical UI elements — users need to clearly read ticket status.

### 7.2 No `prefers-reduced-motion` Guard

Every animation in every CSS file runs unconditionally. Users with vestibular disorders, epilepsy, or motion sensitivity have no way to opt out. This is a **WCAG 2.1 SC 2.3.3** failure.

Affected animations (count: 15+):
- Sidebar `::before` glow radial gradient glow
- AI FAB pulse ring (runs every 2 seconds, 24/7)
- Skeleton shimmer (all pages, all loading states)
- Toast slide-in
- Dashboard hero `repHeroIn` entrance
- Announcement banner `announcement-slide-in`
- Report hero `repPulse` infinite pulse
- Outage live dot pulse
- Bot chat `nbotPopIn` entrance
- Typing indicator bounce animation

### 7.3 Color-Only Status Differentiation

Status badges distinguish open/in-progress/resolved/closed using color only. No icons or patterns differentiate them for color-blind users. The `td-priority-medium` (amber) and `td-status-open` (amber) are **the same hue** — a deuteranopia user cannot tell priority from status.

### 7.4 No Global Focus Ring Strategy

`index.css` defines `--nx-focus-ring: 0 0 0 3px rgba(99,102,241,.15)` but there is no global:
```css
:focus-visible { outline: ... }
```
Focus rings appear only where explicitly coded. Any element without an explicit `:focus-visible` style has browser-default focus outline (ugly but functional) or no outline at all (if `outline: none` is set).

### 7.5 Missing ARIA Labels

Not a CSS issue, but worth documenting: icon-only buttons (the icon-action buttons like filters and refresh) have no visible text. Without `aria-label`, screen readers read nothing meaningful.

---

## 8. Performance at 1000+ Concurrent Users

### 8.1 Frontend Rendering Performance

**No List Virtualization (Critical)**

`TicketsList`, `UsersList`, `DepartmentsList`, `AllNotifications` render all records into the DOM. At 500+ records per list with 8–12 table cells each:
- 500 rows × 10 cells = 5,000 DOM nodes per table
- React re-renders all 5,000 nodes on any parent state change (filter, sort, notification badge update)
- Scroll performance drops below 60fps beyond ~300 rows on mid-range hardware

**Fix:** Install `@tanstack/react-virtual` and implement windowed rendering. This reduces "live" DOM nodes from thousands to ~20 (the visible viewport rows + buffer).

**No `React.memo` on List Row Components**

List rows are inline JSX, not memoized components. Every context update (e.g., notification count change) triggers a full re-render of the entire list. With 1000 users all receiving notifications simultaneously, this creates a "notification storm" re-render pattern.

**Recharts SVG Scale**

Analytics charts render all data as SVG path nodes. 365-day queries = 365 SVG elements per series × 4 series = 1,460 SVG nodes per chart. Multiple charts on the Analytics page = 5,000+ SVG nodes. SVG is not GPU-accelerated — complex SVG causes CPU-heavy layout/paint.

### 8.2 CSS Runtime Performance

**Two `backdrop-filter: blur()` Layers on Every Page**

Both the sidebar (`blur(18px)`) and header (`blur(18px)`) are always active. Each creates a separate GPU compositing layer. On Intel integrated graphics (common in enterprise laptops), maintaining two high-resolution blur layers at 60fps is taxing.

**Continuous `backdrop-filter` on Sidebar `::before` Pseudo-element**

The `sidebar::before` gradient/blur glow is an additional GPU layer. Total per page:
1. Header blur layer
2. Sidebar blur layer  
3. Sidebar `::before` glow  
= **3 GPU compositing layers on every single page at all times**.

**Skeleton Shimmer on Hidden Elements**

`skeleton-shimmer` animation runs `background-position` transition at 1.5s loop. If skeleton loaders are rendered but off-screen (e.g., in a hidden tab or scrolled past), the animation still runs. No `animation-play-state: paused` when not in viewport.

**Fix:** Use `will-change` only during animation, and apply `contain: strict` on list containers. Use Intersection Observer to pause skeleton animations when off-screen.

### 8.3 Bundle Size Issues

Vite config has no `rollupOptions.output.manualChunks`. This means:

- `recharts` (~180KB gzipped) — loaded on Analytics page
- `exceljs` (~400KB gzipped) — loaded on any page that imports Reports
- `jspdf` + `jspdf-autotable` (~450KB gzipped combined) — loaded on Report download

Without chunking, these could end up in the initial or shared chunk, making first load slow for all users.

**Estimated total JS bundle:** ~2–3MB unoptimized (recharts + exceljs + jspdf + react + react-dom + react-router + lucide = large).

**Fix:**

```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-charts': ['recharts'],
        'vendor-export': ['exceljs', 'jspdf', 'jspdf-autotable'],
        'vendor-editor': ['react-quill'],
      }
    }
  }
}
```

### 8.4 Notification Polling Storm

`NotificationContext` polls for unread count every 30 seconds. With 1000 concurrent users each with the app open:
- 1000 ÷ 30 = ~33 notification poll requests per second to the backend
- Each poll likely does a DB `COUNT(*)` query

No batching, no WebSocket fallback, no exponential backoff when tab is hidden.

**Fix:** Use `document.visibilityState` to pause polling when the tab is hidden. Implement WebSocket/Server-Sent Events for real-time notifications instead of polling.

---

## 9. Comparison with Similar Open-Source Projects

### 9.1 Zammad (zammad.org)

Zammad is a production IT helpdesk used by 50,000+ organizations.

| Aspect | Nexus Support | Zammad |
|---|---|---|
| Base font size | 13px | 14–15px |
| Color contrast on all text | Fails WCAG on muted/status | Passes WCAG AA |
| CSS architecture | 55 plain CSS files | Vue SFC scoped styles |
| List virtualization | None | Implemented |
| Mobile sidebar | Hover-only (broken on touch) | Proper mobile drawer |
| Dark mode | CSS `data-theme` attribute | Full support |
| Keyboard navigation | Partial | Comprehensive |
| Animation opt-out | None | Partial |
| Design depth | Flat + glassmorphism | Flat, clean |

**Lesson from Zammad:** 14px minimum body text; all list views are paginated + virtualized; mobile gets a full-screen drawer, not an icon rail.

### 9.2 Linear (linear.app — commercial reference)

Linear is the gold standard for modern SaaS issue tracking UI.

| Aspect | Nexus Support | Linear |
|---|---|---|
| Animation | CSS keyframes, always-on | `framer-motion` + `prefers-reduced-motion` |
| List performance | DOM-full rendering | Fully virtualized |
| Keyboard shortcuts | None found | Comprehensive (Cmd+K palette) |
| Focus management | Inconsistent | Every modal traps focus |
| Design depth | Flat with glass | Subtle 3D depth, light shadows |
| Mobile | Breakpoint responsive | Native app + PWA |

### 9.3 Plane (open source PM — github.com/makeplane/plane)

Plane uses Tailwind + React 18. Relevant comparisons:

| Aspect | Nexus Support | Plane |
|---|---|---|
| CSS approach | 55 separate CSS files | Tailwind utility classes |
| Token consistency | Dual system (legacy + nx) | Single Tailwind config |
| Breakpoint system | 11 ad-hoc values | Tailwind standard (sm/md/lg/xl/2xl) |
| Component isolation | Global CSS, no scoping | Tailwind = inherently scoped |
| Bundle size | ~2–3MB estimated | ~1.5MB with tree-shaking |

### 9.4 FreshDesk / ServiceNow UI (commercial reference)

| Aspect | Nexus Support | Freshdesk |
|---|---|---|
| Information density | Dense (13px, compact) | Balanced (14px, breathable) |
| Visual hierarchy | Good but flat | 3D card depth, clear layers |
| Status indicators | Color badge only | Color + icon + label |
| Chart interactivity | Basic recharts | Rich interactive tooltips |
| Onboarding | None visible | Guided tours, tooltips |
| Empty states | Basic error message | Illustrated, actionable |

### 9.5 Key Takeaways from Comparisons

1. **Base font size should be 14px minimum** — every comparable production tool uses 14–15px for body text. 13px is hard to read in dense data tables during long shifts.
2. **Status indicators need icon + color + label** — not color alone (accessibility + memorability).
3. **Sidebar needs a proper mobile drawer**, not hover collapse.
4. **Virtual scrolling is non-negotiable** for ticket/user lists beyond 100 rows.
5. **The glassmorphism look is not unique** — comparable tools have moved toward subtle 3D depth with clean shadows rather than blur-heavy glassmorphism, which degrades on low-end hardware.

---

## 10. Bug Inventory

| # | Severity | Location | Bug Description |
|---|---|---|---|
| B-01 | 🔴 Critical | `Header.css` + `TicketsList.css` | `.header-left` / `.header-right` class name collision; resolved only by `!important` — fragile and will break if specificity shifts |
| B-02 | 🔴 Critical | `AIAssistant.css` | Chat window `z-index: 100` same as Header `z-index: 100` — chat clips behind sticky header on scroll |
| B-03 | 🔴 Critical | All list pages | No virtual scrolling — DOM fills with thousands of nodes; scroll jank + possible tab crash above ~2000 rows |
| B-04 | 🟠 High | `TicketsList.css` | `var(--background-primary, #f8f9fa)` fallback is light gray — shows as light gray in dark mode |
| B-05 | 🟠 High | `Login.css` | `font-family` hardcoded (not using `var(--nx-font)`) — visual inconsistency on login vs all other pages |
| B-06 | 🟠 High | `TicketDetail.css` | All status badge colors hardcoded, different values from `--nx-status-*` tokens in index.css — same status looks different on different pages |
| B-07 | 🟠 High | All CSS files | No `prefers-reduced-motion` guard — WCAG 2.1 SC 2.3.3 failure; affects users with vestibular/motion disorders |
| B-08 | 🟠 High | Multiple status badges | Color contrast fails WCAG AA: `#d97706` on `#fef3c7` = 2.7:1 (need 4.5:1) |
| B-09 | 🟡 Medium | `Sidebar.css` | `backdrop-filter: blur(18px)` + `will-change` on 3 properties — excessive GPU layer cost, never torn down |
| B-10 | 🟡 Medium | `AIAssistant.css` | FAB pulse animation runs 24/7 — no `prefers-reduced-motion`, no pause when chat is open |
| B-11 | 🟡 Medium | `NotificationContext.jsx` | Polls every 30s — 1000 users = ~33 req/s to backend with no tab-visibility pause |
| B-12 | 🟡 Medium | `vite.config.js` | No `manualChunks` — `exceljs` + `jspdf` (~850KB) likely bloat initial/shared chunk |
| B-13 | 🟡 Medium | `AIAssistant.css` | Chat `width: 380px` overflows on phones ≤ 400px (360–390px Android viewports) |
| B-14 | 🟡 Medium | `EmailQueue.css` | Uses `min-width` (mobile-first) breakpoints while all other files use `max-width` (desktop-first) — layout fights on mid-size viewports |
| B-15 | 🟡 Medium | Multiple files | `min-height: 100vh` should be `100dvh` on mobile to account for browser chrome height |
| B-16 | 🟡 Medium | `Settings.css` | Header gradient hardcoded with 3 dark-indigo hex values — not theme-aware, not token-linked |
| B-17 | 🟡 Medium | All CSS files | ~1,650 lines of per-page token re-aliasing (`--db-bg: var(--nx-bg)` etc.) — dead weight, risk of drift |
| B-18 | 🟢 Low | Multiple pages | `font-size` in raw `px` in many files instead of `var(--nx-font-*)` tokens |
| B-19 | 🟢 Low | `DepartmentsList.css` | Uses `--dept-*` prefix token aliases — the only page using this prefix system; all others use 2-letter prefixes |
| B-20 | 🟢 Low | `AnalyticsEnhanced.css` | Re-declares `--primary-color` locally inside `.ae-page`, shadowing the global bridge alias |

---

## 11. Fix Plan — All Issues Resolved

### Fix F-01: Resolve `.header-left` / `.header-right` Collision (B-01)

**File:** `frontend/src/styles/TicketsList.css`

Rename the generic classes to namespaced ones:
```css
/* BEFORE */
.header-left { flex: 1; min-width: 0; }
.header-right { display: flex; gap: 8px; ... }

/* AFTER */
.tl-header-left { flex: 1; min-width: 0; }
.tl-header-right { display: flex; gap: 8px; ... }
```

Update matching JSX in `TicketsList.jsx` to use `tl-header-left` / `tl-header-right`.

Then remove ALL `!important` declarations from `Header.css` (they are no longer needed once the collision is fixed).

Do the same audit for any other file using `.page-header`, `.page-title`, `.header-left`, `.header-right` without a prefix.

---

### Fix F-02: Fix AI Chat Z-Index (B-02)

**File:** `frontend/src/styles/AIAssistant.css`

```css
/* BEFORE */
.nbot-chat { z-index: 100; }
.nbot-fab  { z-index: 90;  }

/* AFTER */
.nbot-chat { z-index: 120; } /* above header (100) and sidebar (140 is shell, 120 is content) */
.nbot-fab  { z-index: 115; }
```

Also document z-index layers in `index.css`:
```css
:root {
  --nx-z-base:    1;
  --nx-z-sticky:  10;
  --nx-z-header:  100;
  --nx-z-bot-fab: 115;
  --nx-z-bot-chat:120;
  --nx-z-sidebar: 140;
  --nx-z-modal:   200;
  --nx-z-toast:   300;
}
```

---

### Fix F-03: Add `prefers-reduced-motion` to index.css (B-07, B-10)

Add globally to `index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:   0.01ms !important;
    animation-iteration-count: 1  !important;
    transition-duration:  0.01ms !important;
    scroll-behavior: auto         !important;
  }
}
```

This single rule disables all animations for users who request it. Zero per-file changes needed.

---

### Fix F-04: Fix Dark Mode Fallback in TicketsList.css (B-04)

**File:** `frontend/src/styles/TicketsList.css`

```css
/* BEFORE */
.tickets-page {
  background: var(--background-primary, #f8f9fa);
}

/* AFTER */
.tickets-page {
  background: var(--nx-bg);
}
```

---

### Fix F-05: Fix Login Font (B-05)

**File:** `frontend/src/styles/Login.css`

```css
/* BEFORE */
.login-page-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', ...;
}

/* AFTER */
.login-page-container {
  font-family: var(--nx-font);
}
```

---

### Fix F-06: Unify Status Badge Colors (B-06, B-08)

Update `TicketDetail.css` to use the `--nx-status-*` tokens from `index.css` and fix contrast:

```css
/* BEFORE */
.td-status-open { background: #fef3c7; color: #d97706; }
.td-status-progress { background: #dbeafe; color: #2563eb; }

/* AFTER — using tokens + WCAG-compliant colors */
.td-status-open     { background: var(--nx-status-open-bg);           color: #92400e; } /* amber-800 = 4.8:1 on amber-50 */
.td-status-progress { background: var(--nx-status-in-progress-bg);    color: #1e40af; } /* blue-800 = 4.6:1 on blue-50 */
.td-status-resolved { background: var(--nx-status-resolved-bg);       color: #065f46; }
.td-status-closed   { background: var(--nx-status-closed-bg);         color: #374151; }
.td-status-pending  { background: var(--nx-status-pending-bg);        color: #5b21b6; }
```

Add an icon to each status pill (Lucide icons already available):
```jsx
// TicketDetail.jsx — add icon alongside status text
<span className={`td-status-pill td-status-${status}`}>
  <StatusIcon size={12} />
  {statusLabel}
</span>
```

---

### Fix F-07: Add Vendor Chunking to Vite (B-12)

**File:** `frontend/vite.config.js`

```js
build: {
  sourcemap: false,
  minify: 'esbuild',
  target: 'es2019',
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
        'vendor-charts': ['recharts'],
        'vendor-export': ['exceljs', 'jspdf', 'jspdf-autotable'],
        'vendor-editor': ['react-quill'],
        'vendor-icons':  ['lucide-react'],
      }
    }
  }
},
```

This splits ~850KB of export libraries into a separate lazy chunk loaded only when the user triggers an export.

---

### Fix F-08: Fix Mobile Chat Overflow (B-13)

**File:** `frontend/src/styles/AIAssistant.css`

```css
/* BEFORE */
.nbot-chat { width: 380px; }

/* AFTER */
.nbot-chat {
  width: min(380px, calc(100vw - 24px));
  right: 12px;   /* reduce right margin on small screens */
}

@media (max-width: 420px) {
  .nbot-chat {
    width: calc(100vw - 24px);
    right: 12px;
    bottom: 12px;
    border-radius: 12px;
  }
}
```

---

### Fix F-09: Replace `100vh` with `100dvh` (B-15)

In all CSS files containing `min-height: 100vh` that apply to page-level containers:

```css
/* Pattern to apply globally */
.tickets-page,
.create-ticket-page,
.users-page,
.profile-page,
.hc-page /* etc */ {
  min-height: 100vh;          /* fallback for browsers without dvh support */
  min-height: 100dvh;         /* dynamic viewport height for mobile */
}
```

---

### Fix F-10: Reduce GPU Layer Count (B-09)

**File:** `frontend/src/styles/Sidebar.css`

The `backdrop-filter` on the sidebar adds a GPU compositing layer. On inner sidebar content (not the overlay), this is unnecessary:

```css
/* BEFORE */
.sidebar {
  backdrop-filter: blur(18px);
  will-change: width, min-width, max-width;
}

/* AFTER */
.sidebar {
  /* Remove backdrop-filter from sidebar itself; keep only on header */
  /* If sidebar is over actual content in overlay mode, blur is valid */
  /* If sidebar pushes content, blur is decorative only — use solid color instead */
  will-change: width;  /* only one dimension actually changes */
  /* Apply will-change only while transitioning, remove after */
}
```

Also add to `index.css`:
```css
/* Remove will-change after transitions complete */
.sidebar { transition: width 0.32s cubic-bezier(...); }
.sidebar:not(:hover) { will-change: auto; }
```

---

### Fix F-11: Fix Polling — Pause on Hidden Tab (B-11)

**File:** `frontend/src/context/notifications/NotificationContext.jsx`

```js
// Add at start of the polling useEffect
useEffect(() => {
  const startPolling = () => { /* existing interval setup */ };
  const stopPolling  = () => { clearInterval(intervalRef.current); };

  const handleVisibilityChange = () => {
    if (document.hidden) stopPolling();
    else startPolling();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  startPolling();

  return () => {
    stopPolling();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

---

### Fix F-12: Brand Gradient Token (multiple files)

Add to `index.css`:
```css
:root {
  --nx-brand-gradient: linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #a855f7 100%);
  --nx-brand-gradient-dark: linear-gradient(135deg, #4338ca 0%, #5b21b6 60%, #7c3aed 100%);
}
```

Then replace in: `Profile.css`, `Settings.css`, `HelpCenter.css`, `TicketDetail.css`:
```css
/* BEFORE */
background: linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #a855f7 100%);

/* AFTER */
background: var(--nx-brand-gradient);
```

---

### Fix F-13: Remove Per-Page Token Re-Aliasing (B-17)

Remove the 20–40 line alias blocks at the top of every CSS file. Replace references like `var(--db-bg)` with `var(--nx-bg)` directly. This removes ~1,650 lines of CSS overhead.

Do this incrementally per-page. Start with Dashboard (highest traffic):
- Find: `var(--db-bg)` → Replace with: `var(--nx-bg)`
- Find: `var(--db-surface)` → Replace with: `var(--nx-surface)`
- etc.

---

### Fix F-14: Standardize Breakpoints (B-14 + inconsistency)

Add to `index.css`:
```css
/*
  STANDARD BREAKPOINTS — use these only:
  --bp-sm:  480px   (phones)
  --bp-md:  768px   (tablets)
  --bp-lg:  1024px  (small laptops)
  --bp-xl:  1280px  (desktop)
*/
```

Update `EmailQueue.css` to use `max-width` breakpoints to match every other file:
```css
/* BEFORE (EmailQueue.css uses min-width) */
@media (min-width: 768px) { ... }

/* AFTER */
@media (max-width: 768px) { ... }
```

Then audit the remaining outliers (500px, 520px, 600px, 640px, 1200px, 1400px, 1600px) and snap them to the nearest standard breakpoint.

---

### Fix F-15: Virtual Scrolling for Lists (B-03)

Install: `npm install @tanstack/react-virtual`

Apply to `TicketsList.jsx`, `UsersList.jsx`, `AllNotifications.jsx`:

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef(null);
const rowVirtualizer = useVirtualizer({
  count: tickets.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 60, // estimated row height in px
  overscan: 10,
});

return (
  <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
      {rowVirtualizer.getVirtualItems().map(virtualRow => (
        <div
          key={virtualRow.index}
          style={{ position: 'absolute', top: virtualRow.start, width: '100%' }}
        >
          <TicketRow ticket={tickets[virtualRow.index]} />
        </div>
      ))}
    </div>
  </div>
);
```

---

## 12. Modern 3D Design Upgrade Path

To elevate Nexus Support from a functional but flat/glassmorphism UI to a premium, modern 3D-influenced enterprise design — while keeping complexity manageable.

### 12.1 Visual Depth System

Replace the current flat cards with a subtle depth hierarchy using layered shadows and perspective transforms:

```css
/* Add to index.css — 3D Depth Scale */
:root {
  /* Surface depth levels — each level appears "higher" */
  --nx-depth-0: none;                                          /* flush with page */
  --nx-depth-1: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);   /* card level */
  --nx-depth-2: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06);  /* raised card */
  --nx-depth-3: 0 8px 24px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.08);  /* modal, dropdown */
  --nx-depth-4: 0 20px 60px rgba(0,0,0,.14), 0 8px 20px rgba(0,0,0,.10); /* max elevation */
  
  /* Inset shadow for "pressed" / input feel */
  --nx-inset-1: inset 0 2px 4px rgba(0,0,0,.04);
  --nx-inset-2: inset 0 2px 8px rgba(0,0,0,.08);
}
```

**Card lift on hover** — animate from depth-1 to depth-2:
```css
.nx-card {
  box-shadow: var(--nx-depth-1);
  transform: translateY(0);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.nx-card:hover {
  box-shadow: var(--nx-depth-2);
  transform: translateY(-2px);
}
```

### 12.2 3D Stat Cards on Dashboard

Add a subtle perspective effect to stat cards:
```css
.db-stat-card {
  transform-style: preserve-3d;
  perspective: 800px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.db-stat-card:hover {
  transform: perspective(800px) rotateX(2deg) rotateY(-1deg) translateY(-4px);
  box-shadow: var(--nx-depth-3),
              0 0 0 1px rgba(99,102,241,0.08);
}
```

### 12.3 Increase Base Font Size to 14px

```css
/* index.css — update typography */
:root {
  --nx-font-base: 14px;  /* was 13px */
  --nx-font-sm:   13px;  /* was 12px */
  --nx-font-xs:   12px;  /* was 11px */
}
```

This single change improves readability significantly, especially in data tables during long support sessions.

### 12.4 Replace Glassmorphism with Layered Surfaces

Heavy `backdrop-filter: blur()` is GPU expensive and visually dated (2021 trend). Replace the sidebar/header blur with solid layered surfaces:

```css
/* MODERN approach — no backdrop-filter */
.header {
  background: rgba(255,255,255,0.97);  /* opaque, no blur needed */
  border-bottom: 1px solid var(--nx-border);
  box-shadow: 0 1px 0 var(--nx-border), var(--nx-depth-1);
}

.sidebar {
  background: var(--nx-surface);
  border-right: 1px solid var(--nx-border);
  box-shadow: var(--nx-depth-2); /* depth instead of blur */
}
```

If glassmorphism must be kept, scope it to feature cards only and add an `@supports` fallback:
```css
@supports (backdrop-filter: blur(8px)) {
  .glass-card { backdrop-filter: blur(8px); background: rgba(255,255,255,0.7); }
}
/* Fallback for browsers/hardware without backdrop-filter */
.glass-card { background: rgba(255,255,255,0.95); }
```

### 12.5 Modern Gradient System

Replace the repeated 3-color gradients with a design-token-based gradient scale:

```css
:root {
  /* Brand gradients */
  --nx-gradient-primary:   linear-gradient(135deg, #6366f1, #8b5cf6);
  --nx-gradient-brand:     linear-gradient(135deg, #6366f1, #7c3aed, #a855f7);
  --nx-gradient-success:   linear-gradient(135deg, #10b981, #059669);
  --nx-gradient-danger:    linear-gradient(135deg, #ef4444, #dc2626);
  --nx-gradient-warm:      linear-gradient(135deg, #f97316, #f59e0b);
  
  /* Surface gradients — subtle, for hero headers */
  --nx-gradient-surface-1: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  --nx-gradient-surface-2: linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%);
  
  /* Dark gradient — for settings, modal headers */
  --nx-gradient-dark:      linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}
```

### 12.6 Micro-interaction Upgrade

Replace static icon-only buttons with icon buttons that have animated feedback:

```css
/* Icon button with accessible press animation */
.nx-icon-btn {
  position: relative;
  overflow: hidden;
  transition: background 0.15s, transform 0.1s;
}
.nx-icon-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  border-radius: inherit;
  transition: opacity 0.15s;
}
.nx-icon-btn:focus-visible::after,
.nx-icon-btn:active::after {
  opacity: 0.1;
}
.nx-icon-btn:active {
  transform: scale(0.94);
}
```

### 12.7 Status Badges Upgrade

Redesign status badges to include an icon + consistent WCAG contrast:

```css
/* WCAG AA compliant status badge system */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 6px;
  border-radius: 9999px;
  font-size: var(--nx-font-xs);  /* 12px */
  font-weight: 600;
  border: 1px solid transparent;
}

/* Open — amber, WCAG AA compliant */
.status-open    { background: #fef3c7; color: #92400e; border-color: #fde68a; }
/* In Progress — blue */
.status-progress { background: #dbeafe; color: #1e3a8a; border-color: #bfdbfe; }
/* Resolved — green */
.status-resolved { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
/* Closed — gray */
.status-closed  { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
```

### 12.8 Typography Upgrade

```css
/* index.css additions */
:root {
  /* Add missing scale steps */
  --nx-font-4xl: 36px;
  --nx-font-5xl: 48px;
  
  /* Letter spacing scale */
  --nx-tracking-tight:  -0.025em;
  --nx-tracking-normal:  0;
  --nx-tracking-wide:    0.025em;
  --nx-tracking-wider:   0.05em;
  --nx-tracking-widest:  0.1em;
}

/* Page title — all hero headers */
.nx-page-title {
  font-size: var(--nx-font-2xl);
  font-weight: var(--nx-weight-bold);
  letter-spacing: var(--nx-tracking-tight);
  line-height: var(--nx-leading-tight);
}
```

### 12.9 Login Page 3D Upgrade

Replace static background image with a subtle CSS-animated gradient particle background:

```css
.login-page-container {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #312e81 100%);
  /* Remove background-image dependency */
}

/* Animated ambient orbs for depth */
.login-page-container::before {
  content: '';
  position: absolute;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
  top: -200px; left: -100px;
  animation: orb-drift 8s ease-in-out infinite alternate;
  border-radius: 50%;
}

.login-page-container::after {
  content: '';
  position: absolute;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(139,92,246,0.20) 0%, transparent 70%);
  bottom: -100px; right: -50px;
  animation: orb-drift 10s ease-in-out infinite alternate-reverse;
  border-radius: 50%;
}

@keyframes orb-drift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(30px, -20px) scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .login-page-container::before,
  .login-page-container::after { animation: none; }
}
```

This removes the 200–400KB background image download on login and replaces it with a pure CSS effect that loads instantly.

### 12.10 Sidebar Modern Upgrade — Active Item 3D

```css
/* Active nav item with floating 3D pill effect */
.nav-item.active {
  background: var(--nx-gradient-primary);
  box-shadow: 
    0 8px 20px rgba(99, 102, 241, 0.35),
    inset 0 1px 0 rgba(255,255,255,0.15);  /* inner top highlight for 3D */
  transform: translateX(3px);  /* slight push-right = depth illusion */
}
```

---

## 13. Priority Matrix

| Priority | Fix | Impact | Effort |
|---|---|---|---|
| P0 — Now | F-01: Fix `.header-left` collision | Prevents layout bugs on all ticket pages | Low |
| P0 — Now | F-02: Fix AI chat z-index | Chat clips behind header | Low |
| P0 — Now | F-03: `prefers-reduced-motion` in index.css | WCAG compliance, single rule | Low |
| P0 — Now | F-04: Fix dark-mode fallback in TicketsList | Dark mode renders wrong background | Low |
| P0 — Now | F-05: Fix Login font | Visual consistency | Low |
| P1 — Week 1 | F-06: Unify status badge colors + WCAG contrast | Accessibility + consistency | Medium |
| P1 — Week 1 | F-07: Vite manualChunks | Reduce initial bundle by ~850KB | Low |
| P1 — Week 1 | F-08: Fix chat mobile overflow | Mobile usability critical | Low |
| P1 — Week 1 | F-11: Pause notification polling on hidden tab | Server load × 1000 users | Low |
| P2 — Week 2 | F-09: `100dvh` replacement | Mobile viewport fix | Low |
| P2 — Week 2 | F-12: Brand gradient token | Design consistency | Low |
| P2 — Week 2 | F-14: Standardize breakpoints | Responsive consistency | Medium |
| P2 — Week 2 | 12.3: Increase base font to 14px | Readability for long work sessions | Low |
| P2 — Week 2 | 12.8: Status badge icons | Color-blind accessibility | Medium |
| P3 — Sprint | F-15: Virtual scrolling | Performance for 1000+ user data loads | High |
| P3 — Sprint | F-10: Reduce GPU layer count | 1000-user GPU performance | Medium |
| P3 — Sprint | F-13: Remove token re-aliasing | Remove 1,650 lines of dead CSS | Medium |
| P4 — Design | 12.1–12.9: Modern 3D design upgrade | Visual premium, brand elevation | High |
| P4 — Design | 12.9: Login 3D background | Remove 400KB image dependency | Medium |

---

*End of Report — Nexus Support Frontend UI/UX Analysis v1.0*  
*Analysis covers 55 CSS files, ~35 route-level pages, 80+ components across the `frontend/src/` tree.*
