// ============================================
// NEXUS SUPPORT - HELP CENTER
// WORKING VERSION - All Syntax Errors Fixed
// Developer: Suvadip Panja  
// Date: February 1, 2026
// Status: PRODUCTION READY ✅
// ============================================

export const helpContent = {
  categories: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      color: '#3b82f6',
      description: 'Quick start guides and system overview',
      articleCount: 6
    },
    {
      id: 'tickets',
      title: 'Ticket Management',
      icon: '🎫',
      color: '#8b5cf6',
      description: 'Creating, managing, and resolving support tickets',
      articleCount: 10
    },
    {
      id: 'sla',
      title: 'SLA & Escalation',
      icon: '⏱️',
      color: '#f59e0b',
      description: 'Service level agreements and auto-escalation',
      articleCount: 3
    },
    {
      id: 'users',
      title: 'Users & Roles',
      icon: '👥',
      color: '#10b981',
      description: 'Managing users, departments, and permissions',
      articleCount: 4
    },
    {
      id: 'admin',
      title: 'Administration',
      icon: '⚙️',
      color: '#ef4444',
      description: 'System settings, email, backup, and configuration',
      articleCount: 5
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      color: '#06b6d4',
      description: 'Common issues and step-by-step solutions',
      articleCount: 6
    }
  ],

  articles: [
    {
      id: 'quick-start',
      category: 'getting-started',
      title: 'Quick Start Guide',
      description: 'Get started with Nexus Support in 10 minutes',
      difficulty: 'Easy',
      readTime: '10 min',
      views: 4521,
      helpful: 98,
      icon: '⚡',
      content: "# Quick Start Guide\n\nWelcome to Nexus Support - your IT helpdesk solution!\n\n## Step 1: Login (2 min)\n\nNavigate to your Nexus Support URL and login with:\n- Username or email\n- Password\n- 2FA code (if enabled)\n\n## Step 2: Create Your First Ticket (3 min)\n\nClick \"New Ticket\" button and fill in:\n\n**Subject:** Be specific about the issue\n- ❌ Bad: \"Computer problem\"\n- ✅ Good: \"Cannot access shared drive on Windows 10\"\n\n**Priority:**\n- 🔴 Critical: Business stopped (4h resolution)\n- 🟠 High: Major issue (8h resolution)\n- 🟡 Medium: Work affected (24h resolution)\n- 🟢 Low: Minor issue (48h resolution)\n\n**Description:** Include:\n- What you were doing\n- What happened\n- Error messages (copy exactly)\n- When it started\n- What you've tried\n\n**Attachments:** (Optional)\n- Up to 5 files, 10MB each\n- Screenshots highly recommended\n\n## Step 3: Track Your Tickets (2 min)\n\nNavigate to \"My Tickets\" to see:\n- 🟢 Open: Just created\n- 🔵 Assigned: Engineer assigned\n- 🟡 In Progress: Being worked on\n- 🟠 Pending: Waiting for your response\n- ✅ Resolved: Fixed, awaiting confirmation\n- 🔒 Closed: Complete\n\n## Step 4: Communicate (2 min)\n\nAdd comments to:\n- Provide updates\n- Answer questions\n- Test solutions\n- Confirm resolution\n\n## Step 5: Your Profile (1 min)\n\nUpdate your:\n- Contact information\n- Department\n- Notification preferences\n- Profile picture\n\n## Quick Tips\n\n✅ Be specific in ticket titles\n✅ Include screenshots\n✅ Respond to \"Pending\" immediately\n✅ Use correct priority\n✅ Close tickets when done\n\n## SLA Response Times\n\n- 🔴 Critical: 1h response, 4h resolution\n- 🟠 High: 2h response, 8h resolution\n- 🟡 Medium: 4h response, 24h resolution\n- 🟢 Low: 8h response, 48h resolution\n\nAll times in business hours (Mon-Fri, 9AM-6PM IST).\n\n## Need Help?\n\n- Press Ctrl+K for quick search\n- Browse help categories\n- Contact support team\n- Check FAQs\n\nWelcome to Nexus Support! 🎉",
      relatedArticles: ['dashboard-overview', 'create-ticket', 'ticket-priorities'],
      tags: ['quick start', 'beginner', 'tutorial']
    },

    {
      id: 'dashboard-overview',
      category: 'getting-started',
      title: 'Dashboard Overview',
      description: 'Understanding your dashboard metrics and charts',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 3245,
      helpful: 96,
      icon: '📊',
      content: "# Dashboard Overview\n\nYour dashboard shows key metrics at a glance.\n\n## Top Statistics Cards\n\n**Open Tickets**\n- Total tickets waiting for action\n- Click to view all open tickets\n\n**In Progress**\n- Tickets currently being worked\n- Shows active work\n\n**Resolved Today**\n- Tickets closed today\n- Tracks daily productivity\n\n**Avg Response Time**\n- Average first response time\n- Key service metric\n\n## Priority Breakdown Chart\n\nVisual pie chart showing:\n- 🔴 Critical (red)\n- 🟠 High (orange)\n- 🟡 Medium (yellow)\n- 🟢 Low (green)\n\n## Recent Activity\n\nShows last 10 actions:\n- New tickets\n- Status changes\n- Comments\n- Assignments\n- Resolutions\n\n## Quick Access\n\n- My Tickets\n- Notifications\n- Create Ticket\n- Analytics\n\n## Auto-Refresh\n\nDashboard updates every 30 seconds automatically.\n\n## Mobile Responsive\n\nFull functionality on mobile devices with touch-friendly interface.",
      relatedArticles: ['quick-start', 'analytics', 'notifications'],
      tags: ['dashboard', 'overview', 'metrics']
    },

    {
      id: 'create-ticket',
      category: 'tickets',
      title: 'Creating Effective Tickets',
      description: 'How to create tickets that get resolved quickly',
      difficulty: 'Easy',
      readTime: '8 min',
      views: 5234,
      helpful: 97,
      icon: '✍️',
      content: "# Creating Effective Tickets\n\nWell-written tickets get resolved faster!\n\n## Why Good Tickets Matter\n\n**Well-written tickets:**\n- Get assigned faster\n- Receive accurate solutions\n- Resolved within SLA\n- Less back-and-forth\n\n## Required Fields\n\n**Subject (Required)**\n\nBe specific! Include:\n- What's affected\n- Type of issue\n- Error code if any\n\nExamples:\n- ❌ \"Help!\"\n- ❌ \"Computer not working\"\n- ✅ \"Cannot access shared drive after Windows update\"\n- ✅ \"Outlook freezing when opening PDF attachments\"\n\n**Description (Required)**\n\nInclude all details:\n\n1. What you were trying to do\n2. What actually happened\n3. Error messages (exact text)\n4. When it started\n5. What you've tried\n6. Business impact\n\n**Priority (Required)**\n\nChoose based on impact:\n- 🔴 Critical: Business stopped\n- 🟠 High: Major functionality broken\n- 🟡 Medium: Work affected\n- 🟢 Low: Minor issue\n\n**Category (Required)**\n\nSelect most relevant:\n- Hardware\n- Software\n- Network\n- Access\n- Email\n- Other\n\n**Department (Optional)**\n\nSelect your department for faster routing.\n\n## Attach Files\n\nSupported formats:\n- PDF, DOC, DOCX\n- XLS, XLSX\n- JPG, PNG, GIF\n- TXT, LOG, CSV\n- ZIP, RAR\n\nLimits:\n- Max 5 files per ticket\n- Max 10MB per file\n\n## Screenshot Tips\n\n**Windows:**\n- Full screen: PrintScreen key\n- Window: Alt+PrintScreen\n- Selection: Win+Shift+S\n\n**Mac:**\n- Full screen: Cmd+Shift+3\n- Selection: Cmd+Shift+4\n- Window: Cmd+Shift+4, then Space\n\nSave as PNG for best quality.\n\n## What to Include\n\n✅ Exact error messages\n✅ Screenshots\n✅ Steps to reproduce\n✅ System information\n✅ What you've tried\n✅ Business impact\n\n## Common Mistakes\n\n❌ Vague descriptions\n❌ Wrong priority\n❌ Multiple issues in one ticket\n❌ No follow-up\n❌ Missing screenshots\n\n## After Submission\n\nYou'll receive:\n- Confirmation email\n- Ticket number (e.g., TKT-001234)\n- Estimated response time\n\nTrack in \"My Tickets\" section.\n\n## Example Perfect Ticket\n\n**Subject:**\n\"Outlook crashes when opening PDF - Error 0x80070005\"\n\n**Description:**\nWhat I was doing: Opening PDF attachment from customer email\n\nWhat happened: Outlook freezes 10-15 seconds then crashes\n\nError message: \"Microsoft Outlook has stopped working\"\nEvent Viewer: Error 0x80070005\n\nWhen started: This morning after Windows updates\n\nWhat I tried:\n- Restarted Outlook (3x) - didn't help\n- Rebooted computer - didn't help\n- Different PDFs - all crash\n- Saved PDF, opened in Adobe - works fine\n\nBusiness impact:\nCannot read customer contracts via email\n5 urgent contracts waiting\n\n**Priority:** High\n**Category:** Software\n**Attachments:** screenshot_error.png, event_log.txt\n\nThis is perfect! ✅",
      relatedArticles: ['ticket-priorities', 'attach-files', 'ticket-status'],
      tags: ['create', 'ticket', 'new', 'best practices']
    },

    {
      id: 'ticket-priorities',
      category: 'tickets',
      title: 'Understanding Ticket Priorities',
      description: 'How to choose the right priority level',
      difficulty: 'Easy',
      readTime: '7 min',
      views: 5423,
      helpful: 97,
      icon: '🎯',
      content: "# Ticket Priorities & SLA\n\nChoose the right priority for appropriate response times.\n\n## Priority Levels\n\n### 🔴 Critical Priority\n\n**SLA:** 1h response, 4h resolution\n\n**Use when:**\n- Entire system down\n- Business completely stopped\n- Security breach\n- Data loss\n- Multiple users cannot work\n\n**Examples:**\n- Production database down\n- Website completely offline\n- Email system down company-wide\n- Security breach in customer portal\n\n**What happens:**\n- Immediate assignment\n- Senior engineer\n- Manager notified\n- Updates every 30 min\n- Auto-escalates if not resolved in 4h\n\n### 🟠 High Priority\n\n**SLA:** 2h response, 8h resolution\n\n**Use when:**\n- Major functionality broken\n- Multiple users affected\n- Critical with workaround\n- Time-sensitive\n\n**Examples:**\n- Cannot print invoices\n- VPN failing for remote workers\n- Key report not generating\n- Customer portal login broken\n\n**What happens:**\n- Assigned within 30 min\n- Work begins within 2h\n- Updates every 2h\n- Workaround if possible\n- Auto-escalates if not resolved in 8h\n\n### 🟡 Medium Priority\n\n**SLA:** 4h response, 24h resolution\n\n**Use when:**\n- Single user affected\n- Work impacted but manageable\n- Minor functionality issue\n- Non-urgent\n\n**Examples:**\n- Computer running slowly\n- Printer jamming occasionally\n- Cannot access one file\n- Software feature odd behavior\n\n**What happens:**\n- Assigned during business hours\n- Engineer reviews within 4h\n- Resolution within 24h\n- Updates at milestones\n- Auto-escalates if not resolved in 24h\n\n### 🟢 Low Priority\n\n**SLA:** 8h response, 48h resolution\n\n**Use when:**\n- Minor annoyance\n- Enhancement request\n- Information question\n- Nice-to-have\n\n**Examples:**\n- Install optional software\n- How-to question\n- Cosmetic UI issue\n- Feature suggestion\n\n**What happens:**\n- Queued in workflow\n- Engineer when available\n- May be batched\n- Updates at key points\n- No auto-escalation\n\n## SLA Calculation\n\n**Business Hours (Default):**\n- Mon-Fri: 9AM-6PM IST\n- Weekends excluded\n- Holidays excluded\n- Timer pauses outside hours\n\n**Example:**\nHigh priority created Friday 3PM\n- Friday 3-6PM = 3 hours\n- Weekend = paused\n- Monday 9AM-2PM = 5 hours\n- Total = 8 hours\n- Due: Monday 2PM\n\n**Pending Status:**\nTimer PAUSES when waiting for your response!\n\n## Warning System\n\n**80% Warning:**\n- Yellow badge on ticket\n- Email to engineer\n- Dashboard notification\n\n**100% Breach:**\n- Red breach indicator\n- Status changes to \"Escalated\"\n- Emails to all stakeholders\n- Manager reviews\n\n## Decision Tree\n\n**Is business completely stopped?**\n- YES → 🔴 Critical\n- NO → Continue\n\n**Are multiple people unable to work?**\n- YES → 🟠 High\n- NO → Continue\n\n**Is your work significantly impacted?**\n- YES → 🟡 Medium\n- NO → 🟢 Low\n\n## Best Practices\n\n✅ Choose based on business impact\n✅ Be honest about priority\n✅ Explain your choice\n✅ Update if changes\n✅ Trust the process\n\n❌ Don't mark everything Critical\n❌ Don't change without reason\n❌ Don't create duplicates\n❌ Don't ignore \"Pending\"\n\n## Common Questions\n\n**Q: Can I have multiple Critical tickets?**\nA: Yes, but each must truly be critical.\n\n**Q: What if I disagree with priority?**\nA: Comment explaining impact. Manager will review.\n\n**Q: Do weekends count?**\nA: No (business hours mode). Admin can enable 24/7.\n\n**Q: What if engineer is sick?**\nA: Ticket reassigned. SLA continues counting.\n\nRemember: Priority = Business impact, not personal urgency! 🎯",
      relatedArticles: ['create-ticket', 'sla-explained', 'auto-escalation'],
      tags: ['priority', 'sla', 'critical', 'escalation']
    },

    {
      id: 'ticket-status',
      category: 'tickets',
      title: 'Ticket Status Explained',
      description: 'What each ticket status means',
      difficulty: 'Easy',
      readTime: '6 min',
      views: 3982,
      helpful: 95,
      icon: '🔄',
      content: "# Ticket Status Workflow\n\nUnderstanding statuses helps you know what to expect.\n\n## All Statuses\n\n### 🟢 Open\n**Meaning:** Just created, waiting assignment\n**Duration:** 15 min - 2 hours\n**Your action:** Wait for assignment\n**Next:** Usually \"Assigned\"\n\n### 🔵 Assigned\n**Meaning:** Engineer assigned\n**Duration:** Minutes to hours\n**Your action:** Wait for first response\n**Next:** Usually \"In Progress\"\n\n### 🟡 In Progress\n**Meaning:** Engineer actively working\n**Duration:** Varies by complexity\n**Your action:** Monitor for questions\n**Next:** \"Resolved\" or \"Pending\"\n\n### 🟠 Pending (⚠️ ACTION REQUIRED)\n**Meaning:** Waiting for YOUR response\n**Duration:** Should be hours, not days\n**Your action:** RESPOND IMMEDIATELY\n**Important:** SLA timer PAUSED\n**Next:** \"In Progress\" after you respond\n\n### ✅ Resolved\n**Meaning:** Engineer believes fixed\n**Duration:** 24-48h before auto-close\n**Your action:** Test and confirm or reopen\n**Next:** \"Closed\" or back to \"In Progress\"\n\n### 🔒 Closed\n**Meaning:** Ticket complete\n**Your action:** Can reopen within 30 days\n**Final:** Archived for reporting\n\n### 🚨 Escalated\n**Meaning:** SLA breached, escalated to management\n**Your action:** Continue cooperation\n**Next:** Back to \"In Progress\" with priority\n\n## Status Flow\n\n**Typical path:**\nOpen → Assigned → In Progress → Resolved → Closed\n\n**With info needed:**\nOpen → Assigned → In Progress → Pending → In Progress → Resolved → Closed\n\n**With SLA breach:**\nOpen → Assigned → In Progress → Escalated → In Progress → Resolved → Closed\n\n## Time Expectations\n\n**Critical Priority:**\n- Open: < 15 min\n- Assigned: < 15 min\n- In Progress: 1-3 hours\n- Total: < 4 hours\n\n**High Priority:**\n- Open: < 30 min\n- Assigned: < 1 hour\n- In Progress: 2-6 hours\n- Total: < 8 hours\n\n**Medium Priority:**\n- Open: < 2 hours\n- Assigned: < 4 hours\n- In Progress: 4-20 hours\n- Total: < 24 hours\n\n**Low Priority:**\n- Open: < 4 hours\n- Assigned: < 8 hours\n- In Progress: 8-40 hours\n- Total: < 48 hours\n\n## Email Notifications\n\nYou receive emails when:\n- Ticket created\n- Status changes\n- Assigned to engineer\n- Comment added\n- Escalated\n- Resolved\n- Auto-closed\n\nConfigure in Profile → Notifications\n\n## Common Questions\n\n**Q: Been \"In Progress\" for 2 days normal?**\nA: Depends on priority and complexity. Check comments for updates.\n\n**Q: Difference between Resolved and Closed?**\nA: Resolved = engineer thinks fixed. Closed = confirmed and complete.\n\n**Q: Can I change status?**\nA: No, only engineers. You can comment if seems wrong.\n\n**Q: How long does Pending last?**\nA: Should be brief. SLA paused, so respond quickly!\n\n**Q: Didn't respond to Resolved?**\nA: Auto-closes after 48h. Reopen if needed.\n\n## Tips\n\n💡 Respond to \"Pending\" immediately\n💡 Confirm resolutions quickly\n💡 Provide complete info upfront\n💡 Check status regularly\n💡 Communicate changes\n\nRemember: Status tells your ticket's story! 📊",
      relatedArticles: ['create-ticket', 'ticket-priorities', 'notifications'],
      tags: ['status', 'workflow', 'pending', 'resolved']
    },

    {
      id: 'attach-files',
      category: 'tickets',
      title: 'Attaching Files',
      description: 'How to attach files and screenshots',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 2876,
      helpful: 94,
      icon: '📎',
      content: "# Attaching Files to Tickets\n\nScreenshots and logs help engineers resolve issues faster.\n\n## Supported File Types\n\n**Documents:**\n- PDF (.pdf)\n- Word (.doc, .docx)\n- Excel (.xls, .xlsx)\n- Text (.txt, .log, .csv)\n\n**Images:**\n- JPEG (.jpg, .jpeg)\n- PNG (.png)\n- GIF (.gif)\n- BMP (.bmp)\n\n**Archives:**\n- ZIP (.zip)\n- RAR (.rar)\n- 7-Zip (.7z)\n\n**Blocked (Security):**\n- Executables (.exe, .bat, .cmd)\n- Scripts (.js, .vbs, .ps1)\n- System files (.dll, .sys)\n\nWorkaround: ZIP blocked files first\n\n## Size Limits\n\n**Per File:** Maximum 10 MB\n**Per Ticket:** Maximum 5 files\n**Total:** Maximum 50 MB\n\n## How to Attach\n\n**When Creating Ticket:**\n1. Fill ticket details\n2. Scroll to \"Attachments\"\n3. Click \"Upload\" or drag files\n4. Wait for progress bar\n5. See checkmark when done\n6. Submit ticket\n\n**On Existing Ticket:**\n1. Open ticket\n2. Go to \"Attachments\" tab\n3. Click \"Upload Files\"\n4. Select files\n5. Wait for upload\n\n## Taking Screenshots\n\n**Windows:**\n- Full screen: PrintScreen key\n- Window: Alt+PrintScreen\n- Selection: Win+Shift+S\n\n**Mac:**\n- Full screen: Cmd+Shift+3\n- Selection: Cmd+Shift+4\n- Window: Cmd+Shift+4, Space\n\n**Best format:** PNG for clarity\n\n## What to Screenshot\n\n✅ Full error messages\n✅ Error codes\n✅ Window title bars\n✅ Relevant context\n✅ System state\n\n❌ Blurry phone photos\n❌ Partial errors\n❌ No context\n❌ Too dark/bright\n\n## Sensitive Information\n\n**Before attaching, remove:**\n- Passwords\n- API keys\n- Personal info (SSN, etc.)\n- Credit card numbers\n- Confidential data\n\n**How to redact:**\n- Use Paint/Preview to black out\n- Use blur tools\n- Crop sensitive areas\n- Edit text files\n\n## Troubleshooting\n\n**File Too Large:**\n- Compress as ZIP\n- Resize images\n- Split large files\n- Use cloud storage link\n\n**File Type Not Supported:**\n- Check extension\n- ZIP the file\n- Convert to PDF\n- Contact admin\n\n**Upload Stuck:**\n- Check internet\n- Try smaller files\n- Clear browser cache\n- Try different browser\n- Disable VPN\n\n## Security\n\n**All files:**\n- Scanned for viruses\n- Encrypted at rest\n- Daily backups\n- Access controlled\n\n**Who can view:**\n- Ticket participants\n- Assigned engineer\n- Department manager\n- System admins\n\n**Retention:**\n- Kept with ticket\n- 30 days in backup\n- Deleted on request\n\n## Best Practices\n\n✅ Attach when creating ticket\n✅ Use clear filenames\n✅ Screenshot error messages\n✅ Include log files\n✅ Redact sensitive info\n✅ Use PNG format\n\n❌ Don't attach executables\n❌ Don't use phone photos\n❌ Don't upload huge files\n❌ Don't include passwords\n❌ Don't forget to attach\n\nRemember: Good attachments = Faster resolution! 📎",
      relatedArticles: ['create-ticket', 'troubleshoot-upload', 'security'],
      tags: ['attachments', 'files', 'upload', 'screenshots']
    }
  ],

  faqs: [
    {
      id: 'faq-create',
      category: 'general',
      question: 'How do I create a new ticket?',
      answer: 'Click "New Ticket" button (top right) or go to Tickets → Create. Fill in required fields: Subject (be specific), Description (detailed), Priority (based on impact), and Category. Attach files if needed (up to 5 files, 10MB each). Submit and you will receive confirmation email with ticket number.'
    },
    {
      id: 'faq-response',
      category: 'general',
      question: 'How long until I get a response?',
      answer: 'Response times: Critical (1h), High (2h), Medium (4h), Low (8h). Resolution times: Critical (4h), High (8h), Medium (24h), Low (48h). All times based on business hours (Mon-Fri, 9AM-6PM IST).'
    },
    {
      id: 'faq-track',
      category: 'general',
      question: 'How do I track my tickets?',
      answer: 'Navigate to "My Tickets" in sidebar. You will see all your tickets with current status. Click any ticket for details, comments, and history. Email notifications sent for all updates.'
    },
    {
      id: 'faq-priority',
      category: 'tickets',
      question: 'Which priority should I choose?',
      answer: 'Critical = business stopped (4h), High = major issue (8h), Medium = work affected (24h), Low = minor issue (48h). Choose based on business impact, not personal urgency. When in doubt, choose Medium - engineers can adjust.'
    },
    {
      id: 'faq-pending',
      category: 'tickets',
      question: 'What does "Pending" status mean?',
      answer: 'Pending means engineer needs information from YOU. Check latest comment for what is needed. Important: SLA timer PAUSES while Pending, so respond quickly to resume progress on your ticket.'
    },
    {
      id: 'faq-escalation',
      category: 'tickets',
      question: 'What is auto-escalation?',
      answer: 'If ticket is not resolved within SLA time, it auto-escalates to department manager. Manager reviews, may reassign, and ensures resolution. All stakeholders receive notification. Prevents tickets from being forgotten.'
    },
    {
      id: 'faq-attachments',
      category: 'tickets',
      question: 'What files can I attach?',
      answer: 'Supported: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG, PNG, GIF), Text (TXT, LOG), Archives (ZIP, RAR). Maximum 5 files per ticket, 10MB each. Executables (.exe, .bat) blocked for security. Screenshots highly encouraged!'
    },
    {
      id: 'faq-reopen',
      category: 'tickets',
      question: 'Can I reopen a closed ticket?',
      answer: 'Yes! If issue returns within 30 days, open closed ticket and click "Reopen". Add comment explaining why. Ticket returns to Open status. After 30 days, create new ticket and reference old number.'
    },
    {
      id: 'faq-sla-calc',
      category: 'sla',
      question: 'How is SLA calculated?',
      answer: 'SLA counts only business hours (Mon-Fri 9AM-6PM IST) by default. Timer pauses outside hours, weekends, and when in "Pending" status. Example: High priority (8h) created Friday 3PM reaches Monday 2PM (3h Friday + weekend pause + 5h Monday).'
    },
    {
      id: 'faq-password',
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'On login page, click "Forgot Password". Enter email, check inbox for reset link (valid 1 hour). Create new password (min 8 chars with uppercase, lowercase, number, special character). Cannot reuse last 5 passwords.'
    },
    {
      id: 'faq-2fa',
      category: 'account',
      question: 'How do I enable 2FA?',
      answer: 'Profile → Security → Two-Factor Authentication. Choose Email (codes via email) or Authenticator App (Google/Microsoft Authenticator). Follow setup wizard, save 10 backup codes securely, enable. Verify on each login from new devices.'
    },
    {
      id: 'faq-roles',
      category: 'users',
      question: 'What are the user roles?',
      answer: 'Admin: Full access. Manager: Department oversight, user management, analytics. Engineer: Assigned tickets, technical work. User: Create and track own tickets. Custom roles can be created with specific permissions.'
    },
    {
      id: 'faq-departments',
      category: 'users',
      question: 'What are departments for?',
      answer: 'Departments organize users and tickets for better routing. Each has manager who oversees tickets. Selecting department when creating ticket routes to that team. Departments have own analytics.'
    },
    {
      id: 'faq-no-email',
      category: 'notifications',
      question: 'Why no email notifications?',
      answer: 'Check: (1) Profile → Notifications enabled, (2) Spam/junk folder, (3) Add noreply@company.com to contacts, (4) Verify email correct, (5) Ask admin if SMTP configured. Test: Settings → Email → Send Test Email.'
    },
    {
      id: 'faq-backup',
      category: 'admin',
      question: 'How do I backup the system?',
      answer: 'Admin only: Settings → Backup → Create Backup Now. Creates ZIP with database and files. Download and store securely. Can schedule automatic backups (daily/weekly). Retained 30 days (configurable).'
    },
    {
      id: 'faq-cant-login',
      category: 'troubleshooting',
      question: 'Cannot login - what to do?',
      answer: 'Check: (1) Username/password correct (Caps Lock off), (2) Account not locked (wait 30min or contact admin), (3) Clear browser cache, (4) Try different browser, (5) Use "Forgot Password", (6) Contact admin if disabled.'
    },
    {
      id: 'faq-upload-failed',
      category: 'troubleshooting',
      question: 'Why does file upload fail?',
      answer: 'Common causes: (1) File too large (max 10MB), (2) Unsupported format (ZIP it first), (3) Internet issue, (4) Browser cache (clear it), (5) Too many files (max 5). Try: smaller files, different browser, one at a time.'
    },
    {
      id: 'faq-mobile',
      category: 'general',
      question: 'Is there a mobile app?',
      answer: 'Currently accessible via mobile browsers with responsive design. Interface adapts to phone/tablet screens. Dedicated mobile app planned for future. You can add web app to home screen for app-like experience.'
    },
    {
      id: 'faq-browsers',
      category: 'general',
      question: 'Which browsers supported?',
      answer: 'Best on: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Keep browser updated for best experience. Mobile: iOS Safari, Android Chrome supported. Internet Explorer NOT supported.'
    },
    {
      id: 'faq-ticket-number',
      category: 'tickets',
      question: 'What does ticket number mean?',
      answer: 'Format: TKT-XXXXXX (e.g., TKT-001234). "TKT" prefix identifies as ticket. Six-digit number is sequential and unique. Use when emailing support, calling helpdesk, referencing related tickets, or searching.'
    }
  ],

  shortcuts: [
    { key: 'Ctrl + K', description: 'Quick search help', mac: 'Cmd + K' },
    { key: 'Ctrl + N', description: 'Create new ticket', mac: 'Cmd + N' },
    { key: 'Ctrl + /', description: 'Show shortcuts', mac: 'Cmd + /' },
    { key: 'Ctrl + Enter', description: 'Submit form/comment', mac: 'Cmd + Enter' },
    { key: 'Ctrl + S', description: 'Save (editing)', mac: 'Cmd + S' },
    { key: 'Esc', description: 'Close modal/cancel', mac: 'Esc' },
    { key: 'Alt + 1-9', description: 'Navigate tabs', mac: 'Opt + 1-9' },
    { key: '?', description: 'Show help', mac: '?' }
  ],

  quickLinks: [
    {
      title: 'Create Ticket',
      description: 'Submit new support request',
      icon: '➕',
      action: 'create-ticket',
      color: '#3b82f6'
    },
    {
      title: 'My Tickets',
      description: 'View your tickets',
      icon: '📋',
      action: 'my-tickets',
      color: '#8b5cf6'
    },
    {
      title: 'Check Status',
      description: 'Track ticket progress',
      icon: '🔍',
      action: 'my-tickets',
      color: '#10b981'
    },
    {
      title: 'Contact Support',
      description: 'Get direct help',
      icon: '💬',
      action: 'contact-support',
      color: '#f59e0b'
    }
  ],

  popularSearches: [
    'How to create ticket',
    'Ticket priorities',
    'Reset password',
    'SLA response times',
    'Attach files',
    'Enable 2FA',
    'Auto-escalation',
    'Email notifications',
    'Backup system',
    'Pending status'
  ]
};

export default helpContent;