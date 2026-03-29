// ============================================
// NEXUS SUPPORT — HELP CENTER KNOWLEDGE BASE
// Comprehensive IT help content
// ============================================

export const helpContent = {
  categories: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      color: '#3b82f6',
      description: 'Quick start guides and system overview',
      articleCount: 3
    },
    {
      id: 'tickets',
      title: 'Ticket Management',
      icon: '🎫',
      color: '#8b5cf6',
      description: 'Creating, managing, and resolving support tickets',
      articleCount: 4
    },
    {
      id: 'sla',
      title: 'SLA & Escalation',
      icon: '⏱️',
      color: '#f59e0b',
      description: 'Service level agreements and auto-escalation rules',
      articleCount: 1
    },
    {
      id: 'users',
      title: 'Users & Roles',
      icon: '👥',
      color: '#10b981',
      description: 'Managing users, departments, and permissions',
      articleCount: 1
    },
    {
      id: 'admin',
      title: 'Administration',
      icon: '⚙️',
      color: '#ef4444',
      description: 'System settings, email, backup, and configuration',
      articleCount: 1
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      color: '#06b6d4',
      description: 'Step-by-step solutions for common IT problems',
      articleCount: 5
    }
  ],

  articles: [
    // ── Getting Started ──
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
      content: "# Quick Start Guide\n\nWelcome to Nexus Support — your IT helpdesk solution!\n\n## Step 1: Login (2 min)\n\nNavigate to your Nexus Support URL and login with:\n- Username or email\n- Password\n- 2FA code (if enabled)\n\n## Step 2: Create Your First Ticket (3 min)\n\nClick \"New Ticket\" button and fill in:\n\n**Subject:** Be specific about the issue\n- ❌ Bad: \"Computer problem\"\n- ✅ Good: \"Cannot access shared drive on Windows 10\"\n\n**Priority:**\n- 🔴 Critical: Business stopped (4h resolution)\n- 🟠 High: Major issue (8h resolution)\n- 🟡 Medium: Work affected (24h resolution)\n- 🟢 Low: Minor issue (48h resolution)\n\n**Description:** Include what you were doing, what happened, error messages, when it started, and what you've tried.\n\n**Attachments:** Up to 5 files, 10MB each. Screenshots highly recommended.\n\n## Step 3: Track Your Tickets\n\nNavigate to \"My Tickets\" to see status:\n- 🟢 Open — Just created\n- 🔵 Assigned — Engineer assigned\n- 🟡 In Progress — Being worked on\n- 🟠 Pending — Waiting for your response\n- ✅ Resolved — Fixed, awaiting confirmation\n- 🔒 Closed — Complete\n\n## Step 4: Communicate\n\nAdd comments to provide updates, answer questions, test solutions, and confirm resolution.\n\n## Quick Tips\n\n✅ Be specific in ticket titles\n✅ Include screenshots\n✅ Respond to \"Pending\" immediately\n✅ Use correct priority\n✅ Close tickets when done",
      relatedArticles: ['dashboard-overview', 'create-ticket', 'ticket-priorities'],
      tags: ['quick start', 'beginner', 'tutorial', 'getting started']
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
      content: "# Dashboard Overview\n\nYour dashboard shows key metrics at a glance.\n\n## Top Statistics Cards\n\n**Open Tickets** — Total tickets waiting for action\n**In Progress** — Tickets currently being worked on\n**Resolved Today** — Tickets closed today\n**Avg Response Time** — Average first response time\n\n## Priority Breakdown Chart\n\nVisual pie chart showing tickets by priority:\n- 🔴 Critical (red)\n- 🟠 High (orange)\n- 🟡 Medium (yellow)\n- 🟢 Low (green)\n\n## Recent Activity\n\nShows last 10 actions: new tickets, status changes, comments, assignments, and resolutions.\n\n## Auto-Refresh\n\nDashboard updates every 30 seconds automatically.\n\n## Mobile Responsive\n\nFull functionality on mobile devices with touch-friendly interface.",
      relatedArticles: ['quick-start', 'ticket-status'],
      tags: ['dashboard', 'overview', 'metrics', 'charts']
    },
    {
      id: 'navigation-guide',
      category: 'getting-started',
      title: 'Navigation & Features Guide',
      description: 'Learn the sidebar, shortcuts, and key features',
      difficulty: 'Easy',
      readTime: '6 min',
      views: 2100,
      helpful: 94,
      icon: '🧭',
      content: "# Navigation Guide\n\n## Sidebar Menu\n\nThe sidebar provides access to all features:\n- **Dashboard** — Overview and statistics\n- **My Tickets** — Your submitted tickets\n- **All Tickets** — Browse all tickets (agents/admins)\n- **Create Ticket** — Submit new request\n- **Analytics** — Performance metrics and charts\n- **Users** — User management (admin)\n- **Settings** — System configuration (admin)\n- **Help Center** — This page!\n\n## Keyboard Shortcuts\n\n- **Ctrl+K** — Quick search\n- **Ctrl+N** — New ticket\n- **Esc** — Close modal/dialog\n\n## Notifications\n\nClick the 🔔 bell icon (top right) to see alerts for ticket updates, assignments, and SLA warnings.\n\n## Profile Settings\n\nClick your avatar (top right) to access:\n- Profile information\n- Notification preferences\n- Security settings (2FA)\n- Theme toggle (light/dark mode)\n\n## Search\n\nUse the global search bar to find tickets by number, subject, or description.",
      relatedArticles: ['quick-start', 'dashboard-overview'],
      tags: ['navigation', 'sidebar', 'shortcuts', 'features']
    },

    // ── Tickets ──
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
      content: "# Creating Effective Tickets\n\nWell-written tickets get resolved faster!\n\n## Required Fields\n\n**Subject** — Be specific! Include what's affected and the type of issue.\n- ❌ \"Help!\"\n- ✅ \"Cannot access shared drive after Windows update\"\n\n**Description** — Include:\n1. What you were trying to do\n2. What actually happened\n3. Error messages (exact text)\n4. When it started\n5. What you've tried\n6. Business impact\n\n**Priority** — Based on business impact:\n- 🔴 Critical: Business stopped\n- 🟠 High: Major functionality broken\n- 🟡 Medium: Work affected but manageable\n- 🟢 Low: Minor issue or request\n\n**Category** — Select most relevant: Hardware, Software, Network, Access, Email, Other\n\n## Attach Files\n\nSupported: PDF, DOC, XLS, JPG, PNG, GIF, TXT, LOG, ZIP\nLimits: Max 5 files, 10MB each\n\n## Screenshot Tips\n\n**Windows:** Win+Shift+S for selection\n**Mac:** Cmd+Shift+4 for selection\n\n## Example Perfect Ticket\n\n**Subject:** \"Outlook crashes when opening PDF — Error 0x80070005\"\n\n**Description:**\nWhat I was doing: Opening PDF attachment from email\nWhat happened: Outlook freezes then crashes\nError: \"Microsoft Outlook has stopped working\" — Error 0x80070005\nStarted: This morning after Windows updates\nTried: Restarted Outlook 3x, rebooted computer\nImpact: Cannot read customer contracts — 5 urgent contracts waiting\n\n**Priority:** High\n**Attachments:** screenshot_error.png, event_log.txt\n\nThis gets resolved fast! ✅",
      relatedArticles: ['ticket-priorities', 'ticket-status', 'attach-files'],
      tags: ['create', 'ticket', 'new', 'best practices']
    },
    {
      id: 'ticket-priorities',
      category: 'tickets',
      title: 'Understanding Ticket Priorities',
      description: 'How to choose the right priority level and SLA times',
      difficulty: 'Easy',
      readTime: '7 min',
      views: 5423,
      helpful: 97,
      icon: '🎯',
      content: "# Ticket Priorities & SLA\n\n## Priority Levels\n\n### 🔴 Critical\n**SLA:** 1h response, 4h resolution\n**Use when:** Entire system down, business stopped, security breach, data loss\n**What happens:** Immediate assignment, senior engineer, manager notified\n\n### 🟠 High\n**SLA:** 2h response, 8h resolution\n**Use when:** Major functionality broken, multiple users affected, time-sensitive\n**What happens:** Assigned within 30 min, workaround provided if possible\n\n### 🟡 Medium\n**SLA:** 4h response, 24h resolution\n**Use when:** Single user affected, work impacted but manageable\n**What happens:** Assigned during business hours, resolution within 24h\n\n### 🟢 Low\n**SLA:** 8h response, 48h resolution\n**Use when:** Minor annoyance, enhancement request, how-to question\n**What happens:** Queued, may be batched with similar requests\n\n## SLA Calculation\n\n**Business Hours:** Mon-Fri, 9AM-6PM IST\n- Weekends excluded\n- Holidays excluded\n- Timer pauses when status is \"Pending\"\n\n## Decision Tree\n\nBusiness completely stopped? → 🔴 Critical\nMultiple people can't work? → 🟠 High\nYour work significantly impacted? → 🟡 Medium\nMinor or nice-to-have? → 🟢 Low\n\n## Best Practices\n\n✅ Choose based on business impact, not personal urgency\n✅ Be honest about severity\n❌ Don't mark everything as Critical\n❌ Don't create duplicate tickets",
      relatedArticles: ['create-ticket', 'ticket-status', 'sla-explained'],
      tags: ['priority', 'sla', 'critical', 'escalation', 'response time']
    },
    {
      id: 'ticket-status',
      category: 'tickets',
      title: 'Ticket Status Explained',
      description: 'What each ticket status means and what to expect',
      difficulty: 'Easy',
      readTime: '6 min',
      views: 3982,
      helpful: 95,
      icon: '🔄',
      content: "# Ticket Status Workflow\n\n## All Statuses\n\n### 🟢 Open\nJust created, waiting for assignment. Duration: 15 min — 2 hours.\n\n### 🔵 Assigned\nEngineer assigned to your ticket. First response coming soon.\n\n### 🟡 In Progress\nEngineer actively working on it. Monitor for questions.\n\n### 🟠 Pending ⚠️ ACTION REQUIRED\nWaiting for YOUR response! SLA timer is PAUSED. Respond quickly!\n\n### ✅ Resolved\nEngineer believes it's fixed. Test and confirm, or reopen.\nAuto-closes after 48h if no response.\n\n### 🔒 Closed\nTicket complete and archived. Can reopen within 30 days.\n\n### 🚨 Escalated\nSLA breached — management involved. Higher priority attention.\n\n## Typical Flow\n\nOpen → Assigned → In Progress → Resolved → Closed\n\n## Tips\n\n✅ Respond to \"Pending\" immediately — SLA is paused waiting for you\n✅ Confirm resolutions quickly\n✅ Provide complete info upfront to avoid back-and-forth",
      relatedArticles: ['create-ticket', 'ticket-priorities'],
      tags: ['status', 'workflow', 'pending', 'resolved', 'closed']
    },
    {
      id: 'attach-files',
      category: 'tickets',
      title: 'Attaching Files & Screenshots',
      description: 'How to attach files and take effective screenshots',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 2876,
      helpful: 94,
      icon: '📎',
      content: "# Attaching Files to Tickets\n\n## Supported File Types\n\n**Documents:** PDF, DOC, DOCX, XLS, XLSX, TXT, LOG, CSV\n**Images:** JPG, PNG, GIF, BMP\n**Archives:** ZIP, RAR, 7Z\n**Blocked (Security):** EXE, BAT, CMD, JS, VBS, PS1, DLL\n\n## Size Limits\n\nPer file: 10 MB maximum\nPer ticket: 5 files maximum\n\n## Taking Screenshots\n\n**Windows:**\n- Full screen: PrintScreen\n- Active window: Alt+PrintScreen\n- Selection: Win+Shift+S (recommended)\n\n**Mac:**\n- Full screen: Cmd+Shift+3\n- Selection: Cmd+Shift+4\n- Window: Cmd+Shift+4, then Space\n\n## What to Screenshot\n\n✅ Full error messages and codes\n✅ Window title bars for context\n✅ Relevant system state\n✅ Before/after comparisons\n\n❌ Don't use blurry phone photos\n❌ Don't capture sensitive passwords\n\n## Troubleshooting Uploads\n\n- **File too large:** Compress as ZIP, or resize images\n- **Type not supported:** ZIP the file first\n- **Upload stuck:** Clear browser cache, try different browser",
      relatedArticles: ['create-ticket'],
      tags: ['attachments', 'files', 'upload', 'screenshots']
    },

    // ── SLA ──
    {
      id: 'sla-explained',
      category: 'sla',
      title: 'SLA & Auto-Escalation',
      description: 'How SLA tracking and automatic escalation works',
      difficulty: 'Medium',
      readTime: '8 min',
      views: 2340,
      helpful: 93,
      icon: '⏱️',
      content: "# SLA & Auto-Escalation\n\n## What is SLA?\n\nService Level Agreement defines maximum response and resolution times for each priority level.\n\n## SLA Targets\n\n- 🔴 Critical: 1h response, 4h resolution\n- 🟠 High: 2h response, 8h resolution\n- 🟡 Medium: 4h response, 24h resolution\n- 🟢 Low: 8h response, 48h resolution\n\n## How SLA is Calculated\n\n**Business hours only:** Mon-Fri, 9AM-6PM IST\n- Timer starts when ticket is created\n- Timer PAUSES outside business hours, weekends, holidays\n- Timer PAUSES when ticket status is \"Pending\" (waiting for customer)\n- Timer RESUMES when ticket is back \"In Progress\"\n\n## Warning System\n\n**At 80%:** Yellow warning badge, email to engineer\n**At 100%:** RED breach indicator, auto-escalation triggered\n\n## Auto-Escalation\n\nWhen SLA breaches:\n1. Status changes to \"Escalated\"\n2. Notification sent to department manager\n3. All stakeholders alerted\n4. Manager reviews and may reassign\n5. Escalated tickets get priority attention\n\n## Tips to Avoid SLA Breach\n\n✅ Set correct priority from the start\n✅ Respond to \"Pending\" status immediately\n✅ Provide complete information upfront\n✅ Include screenshots and error details",
      relatedArticles: ['ticket-priorities', 'ticket-status'],
      tags: ['sla', 'escalation', 'auto-escalation', 'response time', 'breach']
    },

    // ── Users ──
    {
      id: 'roles-permissions',
      category: 'users',
      title: 'User Roles & Permissions',
      description: 'Understanding the different user roles and access levels',
      difficulty: 'Medium',
      readTime: '6 min',
      views: 1890,
      helpful: 92,
      icon: '👥',
      content: "# User Roles & Permissions\n\n## Role Types\n\n### 🛡️ Administrator\nFull system access including:\n- User management (create, edit, disable)\n- System settings and configuration\n- Email templates and notifications\n- Backup and security settings\n- All ticket access\n- Analytics and reports\n\n### 📋 Manager\n- Department oversight\n- User management (own department)\n- Analytics and reports\n- Ticket escalations\n- Approval workflows\n\n### 🔧 Engineer / Agent\n- Assigned ticket management\n- Create and comment on tickets\n- View department tickets\n- Technical resolution work\n\n### 👤 Standard User\n- Create and track own tickets\n- Add comments and attachments\n- View personal ticket history\n- Profile management\n\n## Custom Roles\n\nAdmins can create custom roles with specific permissions for specialized access needs.\n\n## Department Access\n\nDepartments organize users and control ticket routing:\n- Each department has a manager\n- Tickets route to the appropriate department\n- Department-level analytics available",
      relatedArticles: ['quick-start'],
      tags: ['roles', 'permissions', 'admin', 'manager', 'agent', 'user']
    },

    // ── Admin ──
    {
      id: 'admin-settings',
      category: 'admin',
      title: 'System Administration',
      description: 'Configure system settings, email, and backups',
      difficulty: 'Advanced',
      readTime: '12 min',
      views: 1240,
      helpful: 90,
      icon: '⚙️',
      content: "# System Administration\n\n## System Settings\n\nAccess via **Settings** in the sidebar (admin only).\n\n### General Settings\n- Company name and branding\n- Time zone and business hours\n- Default ticket settings\n- Auto-close configuration\n\n### Email Configuration\n- SMTP server settings\n- Email templates (customizable)\n- Notification preferences\n- Test email functionality\n\n### Security Settings\n- Password policies (length, complexity, expiry)\n- Two-factor authentication enforcement\n- Session timeout\n- Account lockout thresholds\n- IP restrictions\n\n## Backup & Recovery\n\n**Create Backup:** Settings → Backup → Create Backup Now\n- Creates ZIP with database and files\n- Download and store securely\n- Schedule automatic backups (daily/weekly)\n- Retained for 30 days (configurable)\n\n**Restore:** Contact system administrator with backup file\n\n## User Management\n\n- Create/edit/disable user accounts\n- Assign roles and departments\n- Reset passwords\n- Enable/disable 2FA\n- View user activity logs",
      relatedArticles: ['roles-permissions'],
      tags: ['admin', 'settings', 'configuration', 'backup', 'email', 'security']
    },

    // ── Troubleshooting ──
    {
      id: 'slow-computer',
      category: 'troubleshooting',
      title: 'Slow Computer Fix',
      description: 'Step-by-step guide to speed up your PC or laptop',
      difficulty: 'Easy',
      readTime: '6 min',
      views: 4120,
      helpful: 95,
      icon: '🐢',
      content: "# Fix a Slow Computer\n\n## Quick Fixes (Try First)\n\n1. **Restart your computer** — Fixes most temporary issues\n2. **Close unnecessary programs** — Check Task Manager (Ctrl+Shift+Esc)\n3. **Close extra browser tabs** — Too many tabs consume RAM\n\n## Intermediate Steps\n\n4. **Check disk space** — Need at least 10% free\n   Open File Explorer → Right-click C: → Properties\n5. **Run Disk Cleanup** — Search \"Disk Cleanup\" in Start Menu\n6. **Disable startup programs** — Task Manager → Startup tab → Disable unnecessary items\n7. **Check for Windows updates** — Settings → Update & Security\n\n## Advanced Steps\n\n8. **Run antivirus scan** — Malware can severely impact performance\n9. **Check RAM usage** — Task Manager → Performance tab\n   - If consistently above 85%, you may need more RAM\n10. **Check for overheating** — Feel the bottom of laptop, listen for fans\n    - Clean dust from vents\n    - Use on hard, flat surface\n\n## When to Create a Ticket\n\nCreate a ticket if:\n- Problem persists after all steps above\n- RAM is maxed but no obvious cause\n- Frequent freezing or crashes\n- Computer is more than 4 years old\n\nInclude: Computer model, RAM info, disk space info, which specific apps are slow",
      relatedArticles: ['blue-screen', 'network-issue'],
      tags: ['slow', 'computer', 'performance', 'speed', 'lag', 'freeze']
    },
    {
      id: 'network-issue',
      category: 'troubleshooting',
      title: 'Network & WiFi Issues',
      description: 'Troubleshoot internet, WiFi, and VPN connectivity',
      difficulty: 'Easy',
      readTime: '7 min',
      views: 3850,
      helpful: 94,
      icon: '📡',
      content: "# Network & WiFi Troubleshooting\n\n## Step 1 — Check Basics\n\n- Is WiFi turned on? Check taskbar icon\n- Is Airplane mode OFF?\n- Can other devices connect to the same network?\n\n## Step 2 — Quick Fixes\n\n- Toggle WiFi off and on again\n- Disconnect and reconnect to the network\n- Restart your computer\n- \"Forget\" the network and reconnect with password\n\n## Step 3 — Network Reset\n\nOpen Command Prompt as Administrator and run:\n- ipconfig /release\n- ipconfig /renew\n- ipconfig /flushdns\n- netsh winsock reset\n\n## Step 4 — Hardware\n\n- Restart your router/modem (unplug for 30 seconds)\n- Check Ethernet cable if using wired connection\n- Try a different port or cable\n- Move closer to the WiFi router\n\n## VPN-Specific Issues\n\n- Disconnect and reconnect to VPN\n- Verify VPN credentials\n- Try a different VPN server\n- Disable/re-enable your network adapter\n- Check if VPN client needs an update\n\n## When to Create a Ticket\n\n- Network is down for multiple people\n- VPN won't connect after all troubleshooting\n- Intermittent disconnections throughout the day\n- Need access to a new network resource",
      relatedArticles: ['slow-computer', 'file-access'],
      tags: ['network', 'wifi', 'internet', 'vpn', 'connection', 'offline']
    },
    {
      id: 'email-problems',
      category: 'troubleshooting',
      title: 'Email & Outlook Problems',
      description: 'Fix sending, receiving, and Outlook crash issues',
      difficulty: 'Easy',
      readTime: '6 min',
      views: 3200,
      helpful: 93,
      icon: '📧',
      content: "# Email & Outlook Troubleshooting\n\n## Can't Send or Receive\n\n1. Check internet connection\n2. Restart Outlook\n3. Click **Send/Receive** → **Send/Receive All Folders**\n4. Check **Outbox** for stuck emails\n5. Check mailbox isn't full (limit usually 50GB)\n\n## Outlook Crashing\n\n1. Start in **Safe Mode**: Hold Ctrl while opening Outlook\n2. If it works in Safe Mode, disable add-ins:\n   File → Options → Add-ins → Manage → Disable all\n3. Repair Office: Settings → Apps → Microsoft Office → Modify → Repair\n4. Create new Outlook profile if persistent\n\n## Missing Emails\n\n- Check **Junk/Spam** folder\n- Check **Deleted Items**\n- Check **Focused Inbox** vs **Other** tab\n- Review email **Rules**: File → Manage Rules\n- Search by sender or subject\n\n## Calendar Issues\n\n- Ensure calendar is checked in sidebar\n- Verify correct date and time zone\n- Remove and re-add shared calendars\n\n## Out of Office\n\n1. File → Automatic Replies\n2. Set date range\n3. Write your message\n4. Enable for internal and/or external contacts",
      relatedArticles: ['slow-computer', 'create-ticket'],
      tags: ['email', 'outlook', 'mail', 'calendar', 'send', 'receive']
    },
    {
      id: 'printer-fix',
      category: 'troubleshooting',
      title: 'Printer Troubleshooting',
      description: 'Fix printer offline, paper jam, and print quality issues',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 2700,
      helpful: 92,
      icon: '🖨️',
      content: "# Printer Troubleshooting\n\n## Printer Not Responding\n\n1. Check printer is powered ON and has paper\n2. Check USB cable or WiFi connection\n3. Restart the printer\n4. Go to **Settings → Devices → Printers & Scanners**\n5. Set your printer as **Default**\n6. Right-click → **Troubleshoot**\n\n## Printer Shows \"Offline\"\n\n1. Settings → Devices → Printers & Scanners\n2. Click your printer → **Open print queue**\n3. Click **Printer** menu → Uncheck **\"Use Printer Offline\"**\n4. Cancel all pending print jobs and try again\n\n## Paper Jam\n\n1. Turn off printer\n2. Open all access doors/trays\n3. Gently pull jammed paper in direction of travel\n4. Check for small torn pieces\n5. Close all doors and power on\n\n## Print Quality Issues\n\n- Run printer head cleaning (printer settings)\n- Replace low/empty ink or toner cartridges\n- Use correct paper type settings\n- Print alignment/test page\n- Clean scanner glass if copy quality is poor\n\n## Install New Printer\n\nCreate a support ticket with:\n- Printer make and model\n- Location where it will be used\n- Who needs access",
      relatedArticles: ['create-ticket'],
      tags: ['printer', 'print', 'offline', 'paper jam', 'quality']
    },
    {
      id: 'blue-screen',
      category: 'troubleshooting',
      title: 'Blue Screen (BSOD) Recovery',
      description: 'What to do when your computer shows a blue screen error',
      difficulty: 'Medium',
      readTime: '7 min',
      views: 2450,
      helpful: 91,
      icon: '💻',
      content: "# Blue Screen of Death (BSOD)\n\n## Immediate Steps\n\n1. **Note the error code** on the blue screen (e.g., DRIVER_IRQL_NOT_LESS_OR_EQUAL)\n2. **Take a photo** of the screen with your phone\n3. Let the computer restart on its own\n\n## If Computer Restarts Normally\n\n1. **Save your work** immediately\n2. Check **Event Viewer** for details:\n   - Search \"Event Viewer\" → Windows Logs → System\n   - Look for \"Critical\" level events\n3. Run **Windows Update** — driver fixes often resolve BSOD\n4. Think about recent changes (new software, drivers, hardware)\n\n## If Computer Keeps Crashing\n\n1. Boot into **Safe Mode**:\n   - Hold Shift + click Restart\n   - Troubleshoot → Advanced → Startup Settings → Safe Mode\n2. Uninstall recently installed software or drivers\n3. Open Command Prompt (Admin) and run:\n   - sfc /scannow\n   - DISM /Online /Cleanup-Image /RestoreHealth\n\n## ⚠️ Create a Critical Ticket If:\n\n- Blue screen happens repeatedly\n- Computer won't boot at all\n- Important data is at risk\n- Error mentions hardware failure\n\nInclude: photo of blue screen, error code, what you were doing when it happened, and whether it's repeating",
      relatedArticles: ['slow-computer', 'create-ticket'],
      tags: ['blue screen', 'bsod', 'crash', 'boot', 'error', 'restart']
    }
  ],

  faqs: [
    // ── General ──
    {
      id: 'faq-create',
      category: 'general',
      question: 'How do I create a new ticket?',
      answer: 'Click "New Ticket" button (top right) or go to Tickets → Create. Fill in required fields: Subject (be specific), Description (detailed), Priority (based on impact), and Category. Attach files if needed (up to 5 files, 10MB each). Submit and you\'ll receive a confirmation email with your ticket number.'
    },
    {
      id: 'faq-response',
      category: 'general',
      question: 'How long until I get a response?',
      answer: 'Response times depend on priority: Critical (1 hour), High (2 hours), Medium (4 hours), Low (8 hours). Resolution times: Critical (4h), High (8h), Medium (24h), Low (48h). All times are based on business hours (Mon-Fri, 9AM-6PM IST). Weekends and holidays are excluded.'
    },
    {
      id: 'faq-track',
      category: 'general',
      question: 'How do I track my tickets?',
      answer: 'Navigate to "My Tickets" in the sidebar. You\'ll see all your tickets with current status. Click any ticket for full details, comments, and history. You also receive email notifications for all status changes.'
    },
    {
      id: 'faq-mobile',
      category: 'general',
      question: 'Is there a mobile app?',
      answer: 'The system is fully accessible via mobile browsers with responsive design. The interface adapts to phone and tablet screens. You can add the web app to your home screen for an app-like experience. A dedicated mobile app is planned for the future.'
    },
    {
      id: 'faq-browsers',
      category: 'general',
      question: 'Which browsers are supported?',
      answer: 'Best experience on: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Keep your browser updated for the best experience. Mobile: iOS Safari and Android Chrome are supported. Internet Explorer is NOT supported.'
    },

    // ── Tickets ──
    {
      id: 'faq-priority',
      category: 'tickets',
      question: 'Which priority should I choose?',
      answer: 'Choose based on business impact: Critical = business stopped (4h resolution), High = major issue (8h), Medium = work affected (24h), Low = minor issue (48h). When in doubt, choose Medium — engineers can adjust if needed. Don\'t mark everything as Critical.'
    },
    {
      id: 'faq-pending',
      category: 'tickets',
      question: 'What does "Pending" status mean?',
      answer: 'Pending means the engineer needs information from YOU. Check the latest comment for what\'s needed. Important: The SLA timer PAUSES while the ticket is Pending, so respond quickly to resume progress on your ticket.'
    },
    {
      id: 'faq-escalation',
      category: 'tickets',
      question: 'What happens when a ticket is escalated?',
      answer: 'If a ticket isn\'t resolved within SLA time, it auto-escalates to the department manager. The manager reviews the ticket, may reassign it, and ensures resolution with priority attention. All stakeholders receive notifications. This prevents tickets from being forgotten.'
    },
    {
      id: 'faq-reopen',
      category: 'tickets',
      question: 'Can I reopen a closed ticket?',
      answer: 'Yes! If the issue returns within 30 days, open the closed ticket and click "Reopen". Add a comment explaining why it needs to be reopened. After 30 days, create a new ticket and reference the old ticket number.'
    },
    {
      id: 'faq-attachments',
      category: 'tickets',
      question: 'What files can I attach to tickets?',
      answer: 'Supported formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG, PNG, GIF), Text (TXT, LOG), Archives (ZIP, RAR). Maximum 5 files per ticket, 10MB each. Executables (.exe, .bat) are blocked for security. Screenshots are highly encouraged for faster resolution!'
    },
    {
      id: 'faq-ticket-number',
      category: 'tickets',
      question: 'What does the ticket number mean?',
      answer: 'Ticket numbers follow the format TKT-YYYYMMDD-XXXX (e.g., TKT-20260222-0001). The prefix identifies it as a ticket, followed by the date and a sequential number. Use this number when emailing support, calling the helpdesk, or referencing related tickets.'
    },

    // ── Account ──
    {
      id: 'faq-password',
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'On the login page, click "Forgot Password". Enter your email, then check your inbox for a reset link (valid for 1 hour). Create a new password that\'s at least 8 characters with uppercase, lowercase, number, and special character. You cannot reuse your last 5 passwords.'
    },
    {
      id: 'faq-2fa',
      category: 'account',
      question: 'How do I set up Two-Factor Authentication?',
      answer: 'Go to Profile → Security → Two-Factor Authentication. Choose Email (codes via email) or Authenticator App (Google/Microsoft Authenticator). Follow the setup wizard, save your 10 backup codes securely, and enable. You\'ll need to verify on each login from new devices.'
    },
    {
      id: 'faq-cant-login',
      category: 'account',
      question: 'I can\'t log in — what should I do?',
      answer: 'Check: (1) Username and password are correct (Caps Lock off!), (2) Account isn\'t locked — wait 30 minutes or contact admin, (3) Clear browser cache and cookies, (4) Try a different browser, (5) Use "Forgot Password" to reset, (6) Contact your system administrator if account is disabled.'
    },

    // ── Notifications ──
    {
      id: 'faq-no-email',
      category: 'notifications',
      question: 'Why am I not receiving email notifications?',
      answer: 'Check: (1) Profile → Notification Preferences are enabled, (2) Check your spam/junk folder, (3) Add noreply@company.com to your contacts, (4) Verify your email address is correct in your profile, (5) Ask admin if SMTP is configured. You can test with: Settings → Email → Send Test Email.'
    },

    // ── SLA ──
    {
      id: 'faq-sla-calc',
      category: 'sla',
      question: 'How is SLA time calculated?',
      answer: 'SLA counts only business hours (Mon-Fri, 9AM-6PM IST) by default. The timer pauses outside business hours, on weekends/holidays, and when the ticket is in "Pending" status. Example: A High priority ticket (8h SLA) created Friday at 3PM uses 3 hours Friday, pauses over the weekend, then continues Monday at 9AM — making it due by Monday 2PM.'
    },

    // ── Admin ──
    {
      id: 'faq-backup',
      category: 'admin',
      question: 'How do I backup the system?',
      answer: 'Admin only: Go to Settings → Backup → Create Backup Now. This creates a ZIP file with database and file backups. Download and store securely. You can schedule automatic backups (daily/weekly). Backups are retained for 30 days (configurable in settings).'
    },

    // ── Troubleshooting ──
    {
      id: 'faq-upload-failed',
      category: 'troubleshooting',
      question: 'Why does my file upload fail?',
      answer: 'Common causes: (1) File is too large — maximum 10MB per file, (2) Unsupported file format — try zipping it first, (3) Internet connection unstable, (4) Browser cache issue — clear cache and retry, (5) Too many files — maximum 5 per ticket. Try: smaller files, different browser, or upload one at a time.'
    },
    {
      id: 'faq-slow-system',
      category: 'troubleshooting',
      question: 'The helpdesk system is loading slowly — what should I do?',
      answer: 'Try: (1) Refresh the page (F5 or Ctrl+R), (2) Clear browser cache (Ctrl+Shift+Delete), (3) Try a different browser, (4) Check your internet connection, (5) Disable browser extensions that might interfere, (6) Try an incognito/private window. If the issue persists for multiple users, contact your admin.'
    }
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
    'Create ticket',
    'Reset password',
    'Ticket priorities',
    'SLA response times',
    'Slow computer',
    'WiFi not working',
    'Outlook problems',
    'Attach files',
    'Enable 2FA',
    'Printer offline'
  ],

  shortcuts: [
    { key: 'Ctrl + K', description: 'Quick search', mac: 'Cmd + K' },
    { key: 'Ctrl + N', description: 'New ticket', mac: 'Cmd + N' },
    { key: 'Esc', description: 'Close modal', mac: 'Esc' }
  ]
};

export default helpContent;
