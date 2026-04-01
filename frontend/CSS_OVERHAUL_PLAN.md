# CSS Overhaul Plan — IT Helpdesk (Nexus Support)

## Executive Summary

The frontend has **47 CSS files** totaling **33,509 lines** + **~25 components with heavy inline styles** (~500+ style= occurrences). Currently two competing design systems coexist: a well-defined `--nx-*` global token system in `index.css` and legacy hardcoded CSS scattered across ~20 files. This plan consolidates everything into one consistent, modern, dark-mode-ready design system.

---

## Part 1: Current State Audit

### 1.1 Design Token System (`index.css`)

The `--nx-*` token system is already well-defined but **under-used**:

| Token Category | Defined | Actually Used By |
|---|---|---|
| Colors (`--nx-primary`, etc.) | 13 colors + variants | ~50% of files |
| Surfaces (`--nx-bg`, `--nx-surface`) | 4 levels | ~50% of files |
| Spacing (`--nx-sp-1` to `--nx-sp-10`) | 10 values (4px scale) | ~30% of files |
| Radius (`--nx-radius-xs` to `-round`) | 5 values | ~40% of files |
| Shadows (`--nx-shadow-xs` to `-lg`) | 4 levels | ~40% of files |
| Transitions (`--nx-ease`) | 2 values | ~35% of files |
| Typography (`--nx-font`) | 2 families | Global only |

### 1.2 File Classification

#### Tier 1 — Fully Compliant (use `--nx-*` tokens + dark mode)
| File | Lines | Status |
|---|---|---|
| Dashboard.css | 1,490 | ✅ Full token + dark mode |
| TicketDetail.css | 2,803 | ✅ Full token + dark mode |
| Settings.css | 1,715 | ✅ Full token + dark mode |
| UsersList.css | 1,302 | ✅ Full token + dark mode |
| Profile.css | 886 | ✅ Full token + dark mode |
| EmailTemplates.css | 681 | ✅ Full token + dark mode |
| AnalyticsEnhanced.css | 1,901 | ✅ Full token + dark mode |
| HelpCenter.css | 1,827 | ✅ Full token + dark mode |
| OutageWall.css | 650 | ✅ Full token + dark mode |
| AllNotifications.css | 1,032 | ✅ Full token + dark mode |

#### Tier 2 — Partial Compliance (mix of tokens + hardcoded)
| File | Lines | Issues |
|---|---|---|
| Header.css | 847 | ~30% hardcoded, partial dark mode |
| EditTicket.css | 1,037 | Mixed patterns |
| EmailQueue.css | 749 | Mixed `.dark` + tokens |
| OutageAdmin.css | 340 | Tokens used but missing dark overrides |
| BotSettings.css | 753 | Local vars, no `--nx-*` |
| MyApprovals.css | 652 | Partial token usage |

#### Tier 3 — Non-Compliant (hardcoded, no dark mode)
| File | Lines | Critical Issues |
|---|---|---|
| TicketsList.css | 1,889 | Wrong primary (#667eea), hardcoded everything |
| CreateTicket.css | 1,140 | Hardcoded colors, no CSS vars |
| Login.css | 740 | All hardcoded, no theme |
| Sidebar.css | 296 | Hardcoded gradients, no theme |
| MyTickets.css | 645 | Wrong primary (#667eea), no dark mode |
| SecuritySettings.css | 1,257 | Hardcoded #6366f1/#f8fafc, no dark |
| ReportsHub.css | 765 | Cascading hardcoded vars |
| JobMonitorPanel.css | 766 | Local --jm-* vars, hardcoded |
| ResetPassword.css | 465 | Glass card with hardcoded rgba |
| ForgotPassword.css | 349 | Glass card with hardcoded rgba |
| TicketBucket.css | 1,026 | Local vars, no --nx-* |
| TeamBucket.css | 794 | Local vars, no --nx-* |
| PasswordExpiry.css | 275 | Likely hardcoded |
| RolesList.css | 949 | Needs review |
| DepartmentsList.css | 915 | Needs review |
| TeamsPage.css | 863 | Needs review |
| TicketConfig.css | 750 | Needs review |
| BotSessions.css | 656 | Needs review |

#### Components with Heavy Inline Styles (>10 style= occurrences)
| Component | style= Count | Issue |
|---|---|---|
| Settings.jsx | 83 | Should use CSS classes |
| AIAssistPanel.jsx | 55 | Should use CSS classes |
| SnippetsSettings.jsx | 55 | Should use CSS classes |
| OutageAdminTemplates.jsx | 53 | Should use CSS classes |
| IncidentManagement.jsx | 50 | Should use CSS classes |
| OutagePublish.jsx | 47 | Should use CSS classes |
| EmailDetailModal.jsx | 44 | Should use CSS classes |
| BotSettingsTab.jsx | 38 | Should use CSS classes |
| DynamicTicketFormSections.jsx | 35 | Should use CSS classes |
| TemplateVariables.jsx | 33 | Should use CSS classes |

### 1.3 Specific Inconsistencies Found

#### Primary Color Mismatch
- **Correct:** `#6366f1` (defined as `--nx-primary`)
- **Wrong:** `#667eea` found in TicketsList.css, CreateTicket.css, Sidebar.css, MyTickets.css
- **Impact:** Buttons, gradients, and accents look subtly different across pages

#### Border Radius Off-Scale Values
- `10px` in Sidebar.css (should be 8px or 12px)
- `6px` in Header.css (should be 4px or 8px)
- `14px` in JobMonitorPanel.css (should be 12px or 16px)
- `20px` in ReportsHub.css (should be 16px)

#### Button Height Inconsistency
- Global `.nx-btn`: `height: 36px`, `padding: 0 16px`
- TicketsList: `38px` height
- CreateTicket: `padding: 8px 16px` (asymmetric)
- MyTickets: `padding: 12px 20px` (larger)
- Login: `padding: 14px 16px` (larger)

#### Page Title Font Sizes
- index.css `.nx-page-title`: `22px`
- Dashboard: `24px`
- Profile: `26px`
- TicketsList/MyTickets: `28px`

#### Transition Timing Drift
- Global: `0.2s ease` and `0.25s cubic-bezier(.4,0,.2,1)`
- Sidebar: `0.3s ease`
- Header: `0.15s ease`, `0.4s ease-out`
- Login: `0.3s ease-out`

### 1.4 Dark Mode Status

- **CSS tokens defined:** ✅ Complete `[data-theme='dark']` block in index.css
- **ThemeContext:** ❌ Does NOT exist
- **Theme toggle UI:** ❌ Does NOT exist
- **localStorage persistence:** ❌ Not implemented
- **System preference detection:** ❌ Not implemented
- **Files with dark mode:** ~12 out of 47 (~25%)

---

## Part 2: Design System Enhancements

### 2.1 Typography Scale (NEW — add to index.css)

```css
:root {
  /* Typography Scale */
  --nx-font-xs:   11px;   /* Badges, fine print */
  --nx-font-sm:   12px;   /* Small labels, captions */
  --nx-font-base: 13px;   /* Body text, table cells */
  --nx-font-md:   14px;   /* Form inputs, descriptions */
  --nx-font-lg:   16px;   /* Section headers */
  --nx-font-xl:   18px;   /* Card titles */
  --nx-font-2xl:  22px;   /* Page titles */
  --nx-font-3xl:  28px;   /* Hero headings */

  /* Font Weights */
  --nx-weight-normal:   400;
  --nx-weight-medium:   500;
  --nx-weight-semibold: 600;
  --nx-weight-bold:     700;

  /* Line Heights */
  --nx-leading-tight:   1.25;
  --nx-leading-normal:  1.5;
  --nx-leading-relaxed: 1.625;
}
```

### 2.2 Extended Color Palette (add missing shades)

```css
:root {
  /* Extended primary scale for hover/active/focus states */
  --nx-primary-50:  #eef2ff;
  --nx-primary-100: #e0e7ff;
  --nx-primary-200: #c7d2fe;
  --nx-primary-500: #6366f1;  /* = --nx-primary */
  --nx-primary-600: #4f46e5;  /* = --nx-primary-hover */
  --nx-primary-700: #4338ca;
  --nx-primary-900: #312e81;

  /* Focus ring */
  --nx-focus-ring: 0 0 0 3px rgba(99, 102, 241, 0.15);
  --nx-focus-ring-danger: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

[data-theme='dark'] {
  --nx-primary-50:  rgba(99, 102, 241, 0.08);
  --nx-primary-100: rgba(99, 102, 241, 0.15);
  --nx-primary-200: rgba(99, 102, 241, 0.25);
  --nx-focus-ring:  0 0 0 3px rgba(129, 140, 248, 0.2);
}
```

### 2.3 Standardized Component Tokens

```css
:root {
  /* Cards */
  --nx-card-bg: var(--nx-surface);
  --nx-card-border: var(--nx-border);
  --nx-card-radius: var(--nx-radius);
  --nx-card-shadow: var(--nx-shadow);
  --nx-card-padding: var(--nx-sp-5);

  /* Inputs */
  --nx-input-h: 38px;
  --nx-input-radius: var(--nx-radius-sm);
  --nx-input-border: var(--nx-border);
  --nx-input-focus-border: var(--nx-primary);

  /* Buttons */
  --nx-btn-h: 36px;
  --nx-btn-h-sm: 30px;
  --nx-btn-h-lg: 42px;
  --nx-btn-radius: var(--nx-radius-sm);
  --nx-btn-font: var(--nx-font-base);
  --nx-btn-weight: var(--nx-weight-semibold);

  /* Tables */
  --nx-table-header-bg: var(--nx-surface-hover);
  --nx-table-row-hover: var(--nx-surface-hover);
  --nx-table-border: var(--nx-border);

  /* Page Layout */
  --nx-page-padding: var(--nx-sp-6);
  --nx-page-title-size: var(--nx-font-2xl);
  --nx-section-gap: var(--nx-sp-6);
}
```

### 2.4 Status Color System

```css
:root {
  /* Ticket Status Colors */
  --nx-status-open: #f59e0b;
  --nx-status-open-bg: #fffbeb;
  --nx-status-in-progress: #3b82f6;
  --nx-status-in-progress-bg: #eff6ff;
  --nx-status-resolved: #10b981;
  --nx-status-resolved-bg: #ecfdf5;
  --nx-status-closed: #6b7280;
  --nx-status-closed-bg: #f3f4f6;
  --nx-status-pending: #8b5cf6;
  --nx-status-pending-bg: #f5f3ff;

  /* Priority Colors */
  --nx-priority-critical: #dc2626;
  --nx-priority-high: #ef4444;
  --nx-priority-medium: #f59e0b;
  --nx-priority-low: #10b981;
}
```

---

## Part 3: Dark Mode Implementation

### 3.1 Create ThemeContext

**File: `frontend/src/context/ThemeContext.jsx`**

Responsibilities:
- Manage `light` / `dark` theme state
- Persist to `localStorage` under key `nexus-theme`
- Detect system preference via `prefers-color-scheme` on first visit
- Apply `data-theme` attribute to `<html>` element
- Export `useTheme()` hook returning `{ theme, toggleTheme, isDark }`

### 3.2 Theme Toggle Button

**Location:** Header component (top-right, near profile dropdown)

Design:
- Sun icon (light mode) / Moon icon (dark mode) from lucide-react
- Smooth 0.3s rotation transition on toggle
- Tooltip: "Switch to dark/light mode"
- 36px button, matching existing header icon buttons

### 3.3 Wrap App with ThemeProvider

**File: `frontend/src/App.jsx`**

Wrap existing providers:
```jsx
<ThemeProvider>
  <AuthProvider>
    <ToastProvider>
      {/* existing app */}
    </ToastProvider>
  </AuthProvider>
</ThemeProvider>
```

### 3.4 Dark Mode CSS Migration per File

Each non-compliant CSS file needs `[data-theme='dark']` overrides for:
- Background colors → use `--nx-surface`, `--nx-bg`
- Text colors → use `--nx-text`, `--nx-text-secondary`
- Border colors → use `--nx-border`
- Shadows → use `--nx-shadow-*`
- Input/card backgrounds → use tokens
- Status badges → use rgba() variants

Files already using `--nx-*` tokens get dark mode **automatically** when `[data-theme='dark']` overrides the token values. Only files with hardcoded colors need explicit dark rules.

---

## Part 4: Execution Plan — Phased Approach

### Phase 1: Foundation (Day 1)
**Goal:** Expand design tokens + create theme infrastructure

| Task | Files | Est. Changes |
|---|---|---|
| 1.1 Add typography scale to index.css | index.css | +30 lines |
| 1.2 Add extended color palette | index.css | +25 lines |
| 1.3 Add component tokens (card, input, btn, table) | index.css | +40 lines |
| 1.4 Add status/priority color tokens | index.css | +20 lines |
| 1.5 Create ThemeContext.jsx | New file | ~60 lines |
| 1.6 Create ThemeToggle in Header | Header.jsx, Header.css | ~30 lines |
| 1.7 Wrap App.jsx with ThemeProvider | App.jsx | ~5 lines |

**Milestone:** Dark/light toggle works on pages that already use `--nx-*` tokens (Dashboard, TicketDetail, Settings, UsersList, Profile, etc.)

### Phase 2: Core Pages Migration (Day 2-3)
**Goal:** Migrate the 6 most-used Tier 3 files to design tokens

| Task | File | Lines | Priority |
|---|---|---|---|
| 2.1 Migrate TicketsList.css | TicketsList.css | 1,889 | Critical — used daily |
| 2.2 Migrate CreateTicket.css | CreateTicket.css | 1,140 | Critical — user-facing |
| 2.3 Migrate Sidebar.css | Sidebar.css | 296 | Critical — visible on every page |
| 2.4 Migrate Header.css (complete) | Header.css | 847 | Critical — visible on every page |
| 2.5 Migrate MyTickets.css | MyTickets.css | 645 | High — user-facing |
| 2.6 Migrate Login.css | Login.css | 740 | High — first impression |

**Migration Pattern per File:**
1. Replace `#667eea` → `var(--nx-primary)`
2. Replace hardcoded background/text/border colors → `var(--nx-*)`
3. Replace hardcoded radius values → `var(--nx-radius-*)`
4. Replace hardcoded shadows → `var(--nx-shadow-*)`
5. Replace hardcoded transitions → `var(--nx-ease)`
6. Replace hardcoded font sizes → `var(--nx-font-*)`
7. Replace hardcoded spacing → `var(--nx-sp-*)`
8. Standardize button heights to 36px
9. Add `[data-theme='dark']` overrides for any remaining hardcoded values
10. Test both light and dark modes

### Phase 3: Admin Pages Migration (Day 4-5)
**Goal:** Migrate remaining Tier 3 admin/config files

| Task | File | Lines |
|---|---|---|
| 3.1 SecuritySettings.css | 1,257 |
| 3.2 TicketBucket.css | 1,026 |
| 3.3 TeamBucket.css | 794 |
| 3.4 JobMonitorPanel.css | 766 |
| 3.5 ReportsHub.css | 765 |
| 3.6 BotSettings.css | 753 |
| 3.7 TicketConfig.css | 750 |
| 3.8 BotSessions.css | 656 |
| 3.9 RolesList.css | 949 |
| 3.10 DepartmentsList.css | 915 |
| 3.11 TeamsPage.css | 863 |
| 3.12 EditTicket.css | 1,037 |

### Phase 4: Auth & Utility Pages (Day 6)
**Goal:** Migrate authentication and utility pages

| Task | File | Lines |
|---|---|---|
| 4.1 ResetPassword.css | 465 |
| 4.2 ForgotPassword.css | 349 |
| 4.3 PasswordExpiry.css | 275 |
| 4.4 EmailApproval.css | 169 |
| 4.5 NotFound.css | 252 |
| 4.6 SkeletonLoader.css | 63 |
| 4.7 Toast.css | 179 |

### Phase 5: Tier 2 Cleanup (Day 7)
**Goal:** Fix partial compliance in Tier 2 files

| Task | File | Issue |
|---|---|---|
| 5.1 EmailQueue.css | Remove legacy `.dark` class usage |
| 5.2 OutageAdmin.css | Add dark mode overrides |
| 5.3 MyApprovals.css | Complete token migration |
| 5.4 AttachmentPreviewModal.css | Review and fix |
| 5.5 TicketRating.css | Review and fix |
| 5.6 RoleModals.css | Review and fix |
| 5.7 DepartmentModals.css | Review and fix |
| 5.8 UserModals.css | Review and fix |
| 5.9 WhatsAppSettings.css | Review and fix |
| 5.10 AIAssistant.css | Review and fix |

### Phase 6: Inline Style Extraction (Day 8)
**Goal:** Move heavy inline styles to CSS classes

| Component | style= Count | Action |
|---|---|---|
| Settings.jsx | 83 | Extract to Settings.css |
| AIAssistPanel.jsx | 55 | Extract to AIAssistant.css |
| SnippetsSettings.jsx | 55 | Create SnippetsSettings.css |
| OutageAdminTemplates.jsx | 53 | Extract to OutageAdmin.css |
| IncidentManagement.jsx | 50 | Create IncidentManagement.css |
| OutagePublish.jsx | 47 | Extract to OutageAdmin.css |
| EmailDetailModal.jsx | 44 | Extract to EmailQueue.css |
| DynamicTicketFormSections.jsx | 35 | Create or extract to CSS |

### Phase 7: Remove Per-Page Token Aliases (Day 9)
**Goal:** Eliminate redundant `--db-*`, `--td-*`, `--s-*`, `--pf-*` aliases

Currently Tier 1 files define local aliases:
```css
/* Dashboard.css */
--db-primary: var(--nx-primary);
--db-shadow: var(--nx-shadow);
```

This is redundant. Replace all `var(--db-primary)` → `var(--nx-primary)` across the file and delete the alias declarations. This removes ~10-20 lines per file and simplifies maintenance.

### Phase 8: Final Polish & QA (Day 10)
| Task | Description |
|---|---|
| 8.1 Visual regression testing | Compare every page light vs dark mode |
| 8.2 Responsive audit | Check all breakpoints (480, 768, 1024, 1280px) |
| 8.3 Accessibility check | Contrast ratios, focus indicators, reduced motion |
| 8.4 Remove unused CSS | Identify dead selectors |
| 8.5 Performance | Check bundle size, eliminate duplicates |
| 8.6 Documentation | Update component guidelines |

---

## Part 5: Modern UI/UX Enhancements

### 5.1 Dark/Light Mode Toggle (Phase 1 deliverable)
- **Sun/Moon** icon toggle in Header
- Smooth transition: `transition: background-color 0.3s, color 0.3s, border-color 0.3s`
- System preference auto-detection on first visit
- Persisted to localStorage
- Add `body { transition: background-color 0.3s ease; }` for smooth page transition

### 5.2 Glassmorphism Cards (selective use)
Apply to Login, Reset Password, and modal overlays:
```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
[data-theme='dark'] .glass-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### 5.3 Micro-Interactions
- **Button press:** `transform: scale(0.98)` on `:active`
- **Card hover:** subtle `translateY(-2px)` + shadow elevation
- **Focus rings:** `var(--nx-focus-ring)` for accessibility
- **Loading skeleton:** shimmer animation (already exists in SkeletonLoader.css)
- **Page transitions:** fade-in on route change (optional)

### 5.4 Consistent Status Badges
Replace inconsistent badge styling across pages with unified classes:
```css
.nx-badge { height: 22px; padding: 0 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
.nx-badge-success { background: var(--nx-success-light); color: var(--nx-success); }
.nx-badge-warning { background: var(--nx-warning-light); color: var(--nx-warning); }
.nx-badge-danger  { background: var(--nx-danger-light);  color: var(--nx-danger); }
.nx-badge-info    { background: var(--nx-info-light);    color: var(--nx-info); }
```

### 5.5 Standardized Data Tables
- Consistent header height: 40px
- Row height: 48px (comfortable clicking)
- Hover: `var(--nx-surface-hover)`
- Sticky header on scroll
- Alternating row backgrounds (optional, togglable)

### 5.6 Modern Form Controls
- Input height: 38px (standardized)
- Focus: blue border + subtle ring
- Error: red border + red ring
- Placeholder: `var(--nx-muted)`
- Label: `var(--nx-font-sm)`, `var(--nx-weight-semibold)`, `var(--nx-text-secondary)`
- Required indicator: red asterisk

### 5.7 Sidebar Improvements
- Smooth collapse animation (72px collapsed width)
- Active item: left accent bar (3px indigo)
- Hover: subtle background with rounded corners
- Section dividers between nav groups
- Collapse to icons-only mode on narrow screens

### 5.8 Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Part 6: Metrics & Success Criteria

| Metric | Current | Target |
|---|---|---|
| Files using `--nx-*` tokens | ~12/47 (25%) | 47/47 (100%) |
| Files with dark mode support | ~12/47 (25%) | 47/47 (100%) |
| Hardcoded `#667eea` occurrences | ~20+ | 0 |
| Off-scale border-radius values | 4+ different | 0 |
| Button height variants | 4+ (30-42px) | 3 (sm/md/lg) |
| Page title font variants | 4+ (22-28px) | 1 (`--nx-font-2xl`) |
| Components with >20 inline styles | 10 | 0 |
| Color contrast (WCAG AA) | Unknown | All pass |

---

## Part 7: File-by-File Impact Summary

### Total Work Estimate

| Phase | Files | Total Lines | Complexity |
|---|---|---|---|
| Phase 1: Foundation | 4 files + 1 new | ~180 new lines | Medium |
| Phase 2: Core Pages | 6 files | ~5,557 lines to review | High |
| Phase 3: Admin Pages | 12 files | ~10,536 lines to review | High |
| Phase 4: Auth/Utility | 7 files | ~1,752 lines to review | Low |
| Phase 5: Tier 2 Cleanup | 10 files | ~5,344 lines to review | Medium |
| Phase 6: Inline Styles | 8 components | ~460 inline styles | Medium |
| Phase 7: Remove Aliases | ~10 files | Delete ~200 lines | Low |
| Phase 8: QA & Polish | All | Testing only | Medium |

### Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Visual regression in existing pages | Medium | Phase-by-phase commits, screenshot comparison |
| Dark mode contrast issues | Medium | Test with WCAG contrast checker |
| Inline style extraction breaks layout | Low | Keep inline styles that are truly dynamic |
| Token alias removal breaks fallbacks | Low | Search-and-replace, per-file testing |

---

## Appendix A: Color Replacement Map

| Old Value | Replacement |
|---|---|
| `#667eea` | `var(--nx-primary)` |
| `#764ba2` | `var(--nx-purple)` |
| `#5568d3` | `var(--nx-primary-hover)` |
| `#f8f9fa` | `var(--nx-bg)` |
| `#f1f5f9` | `var(--nx-bg)` |
| `#f8fafc` | `var(--nx-surface-hover)` |
| `#ffffff` / `white` | `var(--nx-surface)` |
| `#1a202c` / `#0f172a` | `var(--nx-text)` |
| `#1e293b` | `var(--nx-text)` or sidebar bg |
| `#64748b` / `#475569` | `var(--nx-text-secondary)` |
| `#94a3b8` | `var(--nx-muted)` |
| `#9ca3af` | `var(--nx-muted)` |
| `#6b7280` | `var(--nx-text-secondary)` |
| `#e2e8f0` | `var(--nx-border)` |
| `#cbd5e1` | `var(--nx-border-strong)` |
| `#d1d5db` | `var(--nx-border)` |
| `#dc2626` / `#ef4444` | `var(--nx-danger)` |
| `#fee2e2` | `var(--nx-danger-light)` |
| `#10b981` | `var(--nx-success)` |
| `#ecfdf5` | `var(--nx-success-light)` |
| `#f59e0b` | `var(--nx-warning)` |
| `#fffbeb` | `var(--nx-warning-light)` |
| `#3b82f6` | `var(--nx-info)` |
| `#8b5cf6` | `var(--nx-purple)` |

## Appendix B: Border Radius Normalization

| Current | Action |
|---|---|
| `6px` | → `var(--nx-radius-xs)` (4px) or `var(--nx-radius-sm)` (8px) |
| `10px` | → `var(--nx-radius)` (12px) or `var(--nx-radius-sm)` (8px) |
| `14px` | → `var(--nx-radius)` (12px) or `var(--nx-radius-lg)` (16px) |
| `20px` | → `var(--nx-radius-lg)` (16px) |
| `50%` | → `var(--nx-radius-round)` for circles |

## Appendix C: Transition Normalization

| Current | Replacement |
|---|---|
| `0.15s ease` | `var(--nx-ease)` (0.2s ease) |
| `0.2s ease` | `var(--nx-ease)` ✅ already correct |
| `0.25s cubic-bezier(...)` | `var(--nx-ease-spring)` ✅ already correct |
| `0.3s ease` | `var(--nx-ease)` |
| `0.3s ease-out` | `var(--nx-ease)` |
| `0.4s ease-out` | `var(--nx-ease-spring)` |
