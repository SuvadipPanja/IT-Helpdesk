// ============================================
// HELP CENTER CONTENT
// All help articles, FAQs, guides, and tutorials
// Developer: Suvadip Panja
// Date: January 31, 2026
// ============================================

export const helpContent = {
  // ============================================
  // CATEGORIES
  // ============================================
  categories: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      color: '#3b82f6',
      description: 'Learn the basics and get up to speed quickly',
      articleCount: 8
    },
    {
      id: 'tickets',
      title: 'Tickets',
      icon: '🎫',
      color: '#8b5cf6',
      description: 'Everything about creating and managing tickets',
      articleCount: 12
    },
    {
      id: 'users',
      title: 'User Management',
      icon: '👥',
      color: '#10b981',
      description: 'Managing users, roles, and permissions',
      articleCount: 10
    },
    {
      id: 'administration',
      title: 'Administration',
      icon: '⚙️',
      color: '#f59e0b',
      description: 'System settings and configuration',
      articleCount: 15
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      color: '#ef4444',
      description: 'Fix common issues and errors',
      articleCount: 9
    },
    {
      id: 'advanced',
      title: 'Advanced',
      icon: '🎯',
      color: '#06b6d4',
      description: 'Advanced features and integrations',
      articleCount: 7
    }
  ],

  // ============================================
  // ARTICLES
  // ============================================
  articles: [
    // GETTING STARTED
    {
      id: 'quick-start',
      category: 'getting-started',
      title: 'Quick Start Guide',
      description: 'Get started with Nexus Support in 5 minutes',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 2543,
      helpful: 98,
      icon: '⚡',
      content: `
# Quick Start Guide

Welcome to **Nexus Support**! This guide will help you get started in just 5 minutes.

## Step 1: Understanding the Dashboard
When you first log in, you'll see your dashboard with:
- **Ticket Statistics**: Overview of open, pending, and resolved tickets
- **Recent Activity**: Latest updates and actions
- **Quick Actions**: Fast access to common tasks

## Step 2: Create Your First Ticket
1. Click the **"New Ticket"** button in the top navigation
2. Fill in the required details:
   - Title (be specific!)
   - Description (provide details)
   - Priority (Low, Medium, High, Critical)
   - Category (select the appropriate category)
3. Attach files if needed (up to 10MB)
4. Click **"Create Ticket"**

## Step 3: Track Your Tickets
- Navigate to **"My Tickets"** in the sidebar
- View all tickets you've created or are assigned to
- Use filters to find specific tickets
- Click any ticket to view details and add comments

## Step 4: Update Your Profile
1. Click your avatar in the top right
2. Select **"Profile"**
3. Update your information and upload a profile picture
4. Save changes

## Tips for Success
✅ Be specific in ticket titles
✅ Provide detailed descriptions
✅ Attach relevant files or screenshots
✅ Check your email for notifications
✅ Update tickets with new information

That's it! You're ready to use Nexus Support effectively.
      `,
      relatedArticles: ['create-ticket', 'manage-profile', 'dashboard-overview'],
      tags: ['quick start', 'beginner', 'tutorial']
    },
    {
      id: 'dashboard-overview',
      category: 'getting-started',
      title: 'Dashboard Overview',
      description: 'Understanding your dashboard and key metrics',
      difficulty: 'Easy',
      readTime: '3 min',
      views: 1876,
      helpful: 95,
      icon: '📊',
      content: `
# Dashboard Overview

Your dashboard is your command center. Let's explore what each section means.

## Statistics Cards

### Open Tickets
The number of tickets currently waiting for resolution. Click to view all open tickets.

### In Progress
Tickets actively being worked on by engineers. These are your priority items.

### Resolved Today
Tickets successfully resolved today. Track daily productivity here.

### Response Time
Average time to first response. Lower is better!

## Recent Activity
See the latest actions:
- New tickets created
- Status changes
- Comments added
- Assignments made

## Priority Breakdown
Visual chart showing tickets by priority:
- 🔴 Critical: Immediate attention needed
- 🟠 High: Important, resolve soon
- 🟡 Medium: Normal priority
- 🟢 Low: Can wait

## Quick Actions
One-click access to:
- Create new ticket
- View my tickets
- Check notifications
- Access settings

## Tips
💡 Refresh the dashboard regularly for latest updates
💡 Use filters to focus on specific ticket types
💡 Click any statistic to see detailed breakdown
      `,
      relatedArticles: ['quick-start', 'ticket-filters'],
      tags: ['dashboard', 'overview', 'metrics']
    },

    // TICKETS
    {
      id: 'create-ticket',
      category: 'tickets',
      title: 'Creating a Ticket',
      description: 'Step-by-step guide to creating effective tickets',
      difficulty: 'Easy',
      readTime: '4 min',
      views: 3421,
      helpful: 97,
      icon: '➕',
      video: '/videos/create-ticket.mp4',
      content: `
# How to Create a Ticket

Creating clear, detailed tickets helps you get faster resolutions.

## Required Information

### Title
Be specific and descriptive:
- ❌ Bad: "Computer problem"
- ✅ Good: "Unable to access shared drive on Windows 10"

### Description
Include these details:
- What you were trying to do
- What actually happened
- Steps to reproduce the issue
- Any error messages
- Screenshots (if applicable)

### Priority
Choose the right priority level:
- **Critical**: System down, business stopped
- **High**: Major feature not working
- **Medium**: Issue affecting work but workaround exists
- **Low**: Minor issue or enhancement request

### Category
Select the appropriate category:
- Hardware
- Software
- Network
- Access
- Email
- Other

## Attaching Files
You can attach:
- Screenshots (PNG, JPG)
- Documents (PDF, DOCX)
- Log files (TXT, LOG)
- Maximum 10MB per file
- Multiple files allowed

## Best Practices
✅ One issue per ticket
✅ Include step-by-step reproduction
✅ Attach relevant screenshots
✅ Choose correct priority
✅ Add comments with updates

## After Creating
Once created, you'll receive:
- Email confirmation
- Ticket number
- Link to track progress
- Estimated response time

You can then:
- Track status in "My Tickets"
- Add comments
- Upload additional files
- Close ticket when resolved
      `,
      relatedArticles: ['ticket-priority', 'ticket-status', 'attach-files'],
      tags: ['create', 'ticket', 'new', 'submit']
    },
    {
      id: 'ticket-status',
      category: 'tickets',
      title: 'Understanding Ticket Status',
      description: 'Learn what each ticket status means',
      difficulty: 'Easy',
      readTime: '3 min',
      views: 2156,
      helpful: 94,
      icon: '📊',
      content: `
# Ticket Status Guide

Understanding ticket statuses helps you know where your request stands.

## Status Types

### 🟢 Open
- Ticket just created
- Waiting for assignment
- Not yet being worked on
- Typical wait: 1-2 hours

### 🔵 Assigned
- Engineer assigned to ticket
- Review in progress
- Investigation started
- Typical wait: 2-4 hours

### 🟡 In Progress
- Actively being worked on
- Engineer is resolving issue
- May need your input
- Check for updates regularly

### 🟠 Pending
- Waiting for information from you
- Need approval or clarification
- On hold for external dependency
- **Action required from your side**

### ✅ Resolved
- Issue fixed
- Solution provided
- Awaiting your confirmation
- Will auto-close in 48 hours

### 🔒 Closed
- Ticket completed
- Issue resolved and confirmed
- No further action needed
- Can be reopened if needed

## Status Flow
\`\`\`
Open → Assigned → In Progress → Resolved → Closed
                       ↓
                   Pending (if info needed)
\`\`\`

## What You Can Do

### When Status is Open
- Wait for assignment (usually within 1 hour)
- Add more information if you remember anything

### When Status is Assigned
- Check for engineer's initial assessment
- Respond quickly to any questions

### When Status is In Progress
- Monitor for updates
- Test solutions provided
- Provide feedback

### When Status is Pending
- **Take action immediately**
- Provide requested information
- Ticket won't progress until you respond

### When Status is Resolved
- Test the solution
- Confirm it works
- Close ticket or reopen if issue persists

## Tips
💡 Check email notifications for status changes
💡 Respond quickly to avoid delays
💡 Add comments to provide updates
💡 Close tickets when satisfied
      `,
      relatedArticles: ['create-ticket', 'ticket-priority', 'notifications'],
      tags: ['status', 'workflow', 'lifecycle']
    },

    // USER MANAGEMENT
    {
      id: 'manage-profile',
      category: 'users',
      title: 'Managing Your Profile',
      description: 'Update your profile information and preferences',
      difficulty: 'Easy',
      readTime: '2 min',
      views: 1654,
      helpful: 92,
      icon: '👤',
      content: `
# Managing Your Profile

Keep your profile up-to-date for better communication.

## Accessing Your Profile
1. Click your avatar in the top right corner
2. Select **"Profile"** from the dropdown
3. You'll see your profile page

## Profile Information

### Personal Details
- **Full Name**: Your display name
- **Email**: Primary contact email
- **Phone**: Optional contact number
- **Department**: Your department/team
- **Role**: Your position

### Profile Picture
1. Click the camera icon on your avatar
2. Select an image (JPG, PNG)
3. Crop if needed
4. Save changes

### Password
1. Go to Profile → Security tab
2. Click "Change Password"
3. Enter current password
4. Enter new password (min 8 characters)
5. Confirm new password
6. Save changes

## Notification Preferences
Control what notifications you receive:
- Email notifications
- Ticket updates
- Assignment alerts
- System announcements

## Tips
✅ Use a professional photo
✅ Keep email up-to-date
✅ Set up notification preferences
✅ Update password regularly
      `,
      relatedArticles: ['account-security', 'notifications', 'password-reset'],
      tags: ['profile', 'account', 'settings']
    },

    // ADMINISTRATION
    {
      id: 'email-setup',
      category: 'administration',
      title: 'Email Configuration',
      description: 'Set up email notifications and SMTP settings',
      difficulty: 'Advanced',
      readTime: '10 min',
      views: 892,
      helpful: 89,
      icon: '📧',
      content: `
# Email Configuration Guide

Configure email settings for notifications.

## SMTP Settings

### Required Information
- SMTP Host (e.g., smtp.gmail.com)
- SMTP Port (usually 587 or 465)
- Username (email address)
- Password (app password recommended)
- Encryption (TLS/SSL)

### Gmail Configuration
\`\`\`
Host: smtp.gmail.com
Port: 587
Encryption: TLS
Username: your-email@gmail.com
Password: [App Password]
\`\`\`

### Office 365 Configuration
\`\`\`
Host: smtp.office365.com
Port: 587
Encryption: TLS
Username: your-email@company.com
Password: [Your Password]
\`\`\`

## Testing Email
1. Go to Settings → Email & SMTP
2. Enter your SMTP details
3. Click **"Test Connection"**
4. Enter test email address
5. Send test email
6. Check inbox for test message

## Common Issues

### Authentication Failed
- Check username and password
- Use app-specific password for Gmail
- Enable "Less secure apps" if needed

### Connection Timeout
- Verify SMTP host and port
- Check firewall settings
- Try different port (587 vs 465)

### Emails Not Sending
- Verify SMTP settings saved
- Check email queue
- Review error logs

## Email Notifications
Configure which events trigger emails:
- New ticket created
- Ticket assigned
- Status changed
- Comment added
- Ticket resolved

## Tips
✅ Use app-specific passwords
✅ Test before deploying
✅ Monitor email queue
✅ Set appropriate notification triggers
      `,
      relatedArticles: ['notifications', 'troubleshoot-email', 'system-settings'],
      tags: ['email', 'smtp', 'configuration', 'admin']
    },
    {
      id: 'backup-restore',
      category: 'administration',
      title: 'Backup & Restore',
      description: 'Create and manage system backups',
      difficulty: 'Advanced',
      readTime: '8 min',
      views: 1243,
      helpful: 96,
      icon: '💾',
      content: `
# Backup & Restore Guide

Learn how to backup and restore your system data.

## Creating Backups

### Manual Backup
1. Go to Settings → Backup
2. Click **"Create Backup Now"**
3. Wait for completion (usually 1-2 minutes)
4. Backup will appear in history

### Automatic Backups
Configure scheduled backups:
1. Settings → Backup → Configuration
2. Enable automatic backups
3. Set schedule (daily, weekly, monthly)
4. Set retention period
5. Save settings

## What's Included
Backups contain:
- ✅ Database (all tickets, users, settings)
- ✅ Uploaded files (attachments)
- ✅ System configuration
- ✅ User data
- ✅ Metadata

## Downloading Backups
1. Settings → Backup → History
2. Find the backup you want
3. Click the download icon (↓)
4. ZIP file will download (typically 15-30 MB)

## Backup Contains
\`\`\`
BACKUP_20260131123045.zip
├── BACKUP_20260131123045.bak  (Database)
├── files/                      (Uploaded files)
│   └── [all attachments]
└── metadata.json               (Backup info)
\`\`\`

## Restoring from Backup

### Database Restore
1. Open SQL Server Management Studio
2. Right-click Databases → Restore Database
3. Select backup file (.bak)
4. Click OK to restore
5. Wait for completion

### Files Restore
1. Extract ZIP file
2. Copy files/ folder
3. Paste to backend/uploads/
4. Restart application

## Best Practices
✅ Schedule daily automatic backups
✅ Download critical backups locally
✅ Test restore process periodically
✅ Keep 30 days of backups
✅ Store backups securely

## Backup Settings
- **Retention Period**: Days to keep backups (default: 30)
- **Auto Cleanup**: Remove old backups automatically
- **Compression**: Reduce backup size
- **Email Notifications**: Get notified when backups complete

## Troubleshooting

### Backup Fails
- Check disk space
- Verify database permissions
- Review error logs

### Download Not Working
- Clear browser cache
- Try different browser
- Check file permissions

### Restore Issues
- Verify backup file integrity
- Check SQL Server version compatibility
- Ensure sufficient disk space

## Storage Requirements
- Database: ~10-20 MB
- Files: Varies (based on attachments)
- Total: Usually 15-50 MB per backup
- Recommended free space: 5 GB

## Tips
💡 Create backup before major changes
💡 Test restore process quarterly
💡 Keep recent backups downloadable
💡 Monitor backup completion notifications
      `,
      relatedArticles: ['system-settings', 'troubleshooting', 'admin-guide'],
      tags: ['backup', 'restore', 'recovery', 'admin']
    },

    // TROUBLESHOOTING
    {
      id: 'cant-login',
      category: 'troubleshooting',
      title: 'Cannot Login',
      description: 'Fix login issues and access problems',
      difficulty: 'Easy',
      readTime: '5 min',
      views: 2341,
      helpful: 91,
      icon: '🔒',
      content: `
# Cannot Login - Troubleshooting

Having trouble logging in? Let's fix it!

## Common Causes

### 1. Incorrect Password
**Symptoms:**
- "Invalid credentials" error
- "Wrong username or password"

**Solutions:**
- Double-check your password
- Check Caps Lock is off
- Try password reset
- Copy-paste password (avoid typos)

### 2. Account Locked
**Symptoms:**
- "Account locked" message
- Multiple failed attempts

**Solutions:**
- Wait 30 minutes for auto-unlock
- Contact administrator to unlock
- Reset password after unlock

### 3. Account Disabled
**Symptoms:**
- "Account is inactive" message
- Cannot access system

**Solutions:**
- Contact your administrator
- Account may need activation
- Check email for activation link

### 4. Browser Issues
**Symptoms:**
- Page doesn't load
- Stuck on login screen
- Buttons don't work

**Solutions:**
- Clear browser cache and cookies
- Try incognito/private mode
- Try different browser
- Update your browser

### 5. Network Issues
**Symptoms:**
- "Cannot connect to server"
- Page timeout
- Slow loading

**Solutions:**
- Check internet connection
- Try accessing other websites
- Disable VPN temporarily
- Contact IT for network issues

## Step-by-Step Troubleshooting

### Step 1: Verify Credentials
1. Make sure username is correct
2. Check password (Caps Lock off)
3. Copy-paste if possible
4. Try password reset if unsure

### Step 2: Clear Browser Data
1. Open browser settings
2. Clear browsing data
3. Select "Cookies" and "Cached images"
4. Clear data
5. Close and reopen browser
6. Try logging in again

### Step 3: Try Different Browser
1. Download Chrome/Firefox/Edge
2. Open system URL
3. Try logging in
4. If successful, issue is browser-specific

### Step 4: Check Account Status
1. Have administrator check your account
2. Verify account is active
3. Confirm email address is correct
4. Check role assignments

### Step 5: Password Reset
1. Click "Forgot Password?" link
2. Enter your email address
3. Check email for reset link
4. Create new password
5. Try logging in

## Password Reset Process
\`\`\`
1. Click "Forgot Password"
   ↓
2. Enter email address
   ↓
3. Check email inbox
   ↓
4. Click reset link
   ↓
5. Create new password
   ↓
6. Confirm password
   ↓
7. Login with new password
\`\`\`

## Still Can't Login?

### Contact Support
If nothing works:
1. Contact your system administrator
2. Provide these details:
   - Your username/email
   - Error message (screenshot)
   - Browser and version
   - What you've tried
   - When it started

### Temporary Workaround
- Ask colleague to create ticket for you
- Use different device
- Access from different network

## Prevention Tips
✅ Save password in secure password manager
✅ Enable "Remember me" on trusted devices
✅ Keep browser updated
✅ Note down username exactly
✅ Set up password recovery email

## Security Notes
- Never share your password
- Use strong, unique passwords
- Enable two-factor authentication if available
- Log out from shared computers
- Change password if compromised
      `,
      relatedArticles: ['password-reset', 'account-security', 'contact-support'],
      tags: ['login', 'troubleshoot', 'access', 'password']
    },
    {
      id: 'email-not-working',
      category: 'troubleshooting',
      title: 'Email Notifications Not Working',
      description: 'Fix email notification issues',
      difficulty: 'Medium',
      readTime: '6 min',
      views: 1523,
      helpful: 88,
      icon: '📧',
      content: `
# Email Notifications Not Working

Not receiving email notifications? Let's troubleshoot!

## Check These First

### 1. Notification Settings
**Verify your settings:**
1. Go to Profile → Notifications
2. Check "Email Notifications" is enabled
3. Verify email address is correct
4. Ensure relevant notification types are enabled

### 2. Spam/Junk Folder
**Check spam:**
- Look in spam/junk folder
- Mark emails as "Not Spam"
- Add sender to contacts
- Check email filters

### 3. Email Whitelist
**Add to whitelist:**
- Add noreply@yourcompany.com
- Add admin@yourcompany.com
- Configure email filters to allow these addresses

## System Administrator Checks

### SMTP Configuration
**Verify settings:**
1. Settings → Email & SMTP
2. Test connection
3. Send test email
4. Check error logs

### Email Queue
**Check queue:**
1. Settings → Email & SMTP
2. View email queue
3. Check for failed emails
4. Retry sending if needed

## Common Issues

### Gmail Not Receiving
**Solutions:**
- Enable "Less secure apps"
- Use app-specific password
- Check Gmail filters
- Verify inbox isn't full

### Office 365 Issues
**Solutions:**
- Check blocked senders list
- Verify SMTP settings
- Check Exchange rules
- Contact IT admin

### Corporate Email Blocks
**Solutions:**
- Contact IT department
- Request whitelist approval
- Provide sender email addresses
- Check firewall rules

## Testing Email Delivery

### Send Test Email
1. Settings → Email & SMTP
2. Enter your email
3. Click "Send Test Email"
4. Wait 2-3 minutes
5. Check inbox (and spam)

### What to Check
- Did email arrive?
- How long did it take?
- Is formatting correct?
- Are links working?

## Notification Types

### Available Notifications
- New ticket created
- Ticket assigned to you
- Status changed
- Comment added
- Ticket resolved
- Ticket closed
- Mention in comment

### Configure Notifications
1. Profile → Notifications
2. Enable/disable each type
3. Set email preferences
4. Save changes

## Email Troubleshooting Steps

### Step 1: Verify Email Address
\`\`\`
Profile → Settings → Email
Check spelling
Verify domain
Test with alternate email
\`\`\`

### Step 2: Check System Logs
\`\`\`
Settings → System → Logs
Filter by "email"
Look for errors
Note error codes
\`\`\`

### Step 3: Test SMTP
\`\`\`
Settings → Email → Test
Enter email
Send test
Check delivery
\`\`\`

### Step 4: Contact Admin
If nothing works:
- Contact system administrator
- Provide error messages
- Share troubleshooting steps tried
- Request manual email test

## Prevention Tips
✅ Keep email address updated
✅ Regularly check spam folder
✅ Whitelist system emails
✅ Test notifications after setup
✅ Monitor email queue

## Advanced Troubleshooting
- Check DNS records (SPF, DKIM)
- Verify email server logs
- Test with different email provider
- Check network firewall rules
- Review email authentication settings
      `,
      relatedArticles: ['email-setup', 'notifications', 'contact-support'],
      tags: ['email', 'notifications', 'troubleshoot', 'smtp']
    }
  ],

  // ============================================
  // FAQS
  // ============================================
  faqs: [
    {
      id: 'faq-1',
      category: 'general',
      question: 'How do I create a new ticket?',
      answer: 'Click the "New Ticket" button in the top navigation bar, fill in the required details (title, description, priority, category), attach any relevant files, and click "Create Ticket". You\'ll receive a confirmation email with your ticket number.'
    },
    {
      id: 'faq-2',
      category: 'general',
      question: 'How long does it take to get a response?',
      answer: 'Response times depend on priority: Critical issues receive immediate attention (within 1 hour), High priority within 4 hours, Medium within 24 hours, and Low priority within 48 hours. You\'ll receive email notifications for all updates.'
    },
    {
      id: 'faq-3',
      category: 'general',
      question: 'Can I track my ticket status?',
      answer: 'Yes! Go to "My Tickets" in the sidebar to see all your tickets. Each ticket shows its current status (Open, Assigned, In Progress, Resolved, Closed). Click any ticket to view detailed history and add comments.'
    },
    {
      id: 'faq-4',
      category: 'tickets',
      question: 'What file types can I attach?',
      answer: 'You can attach common file types including images (PNG, JPG, GIF), documents (PDF, DOCX, XLSX), and text files (TXT, LOG). Maximum file size is 10MB per file, and you can attach multiple files to a single ticket.'
    },
    {
      id: 'faq-5',
      category: 'tickets',
      question: 'Can I reopen a closed ticket?',
      answer: 'Yes! If your issue isn\'t fully resolved, click the "Reopen" button on the closed ticket. Add a comment explaining why you need to reopen it. The ticket will return to "Open" status and be reassigned for review.'
    },
    {
      id: 'faq-6',
      category: 'tickets',
      question: 'How do I change ticket priority?',
      answer: 'Only administrators and managers can change ticket priority. If you believe your ticket needs a different priority, add a comment explaining why, and tag your manager or administrator. They can adjust the priority accordingly.'
    },
    {
      id: 'faq-7',
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'Click "Forgot Password?" on the login page, enter your email address, and you\'ll receive a password reset link. Click the link, create a new password (minimum 8 characters with uppercase, lowercase, and numbers), and confirm it.'
    },
    {
      id: 'faq-8',
      category: 'account',
      question: 'Can I change my email address?',
      answer: 'Contact your system administrator to change your email address. For security reasons, users cannot change their own email addresses. Provide your new email address and reason for the change.'
    },
    {
      id: 'faq-9',
      category: 'notifications',
      question: 'Why am I not receiving email notifications?',
      answer: 'Check your notification settings in Profile → Notifications. Ensure email notifications are enabled. Also check your spam/junk folder and add system emails to your whitelist. If issues persist, contact your administrator to verify SMTP settings.'
    },
    {
      id: 'faq-10',
      category: 'notifications',
      question: 'Can I customize which notifications I receive?',
      answer: 'Yes! Go to Profile → Notifications and enable/disable specific notification types: new tickets, assignments, status changes, comments, and resolutions. You can also choose to receive daily digest emails instead of immediate notifications.'
    },
    {
      id: 'faq-11',
      category: 'technical',
      question: 'Which browsers are supported?',
      answer: 'Nexus Support works best on modern browsers: Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. For the best experience, keep your browser updated. Mobile browsers are also supported on iOS and Android devices.'
    },
    {
      id: 'faq-12',
      category: 'technical',
      question: 'Is there a mobile app?',
      answer: 'Currently, Nexus Support is accessible via mobile browsers (responsive design). A dedicated mobile app is planned for future release. You can add the web app to your home screen for app-like experience on mobile devices.'
    }
  ],

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  shortcuts: [
    { key: 'Ctrl + K', description: 'Quick search', mac: 'Cmd + K' },
    { key: 'Ctrl + N', description: 'New ticket', mac: 'Cmd + N' },
    { key: 'Ctrl + /', description: 'Show shortcuts', mac: 'Cmd + /' },
    { key: 'Ctrl + B', description: 'View backups', mac: 'Cmd + B' },
    { key: 'Ctrl + ,', description: 'Settings', mac: 'Cmd + ,' },
    { key: 'Ctrl + H', description: 'Help center', mac: 'Cmd + H' },
    { key: 'Esc', description: 'Close modal', mac: 'Esc' },
    { key: '?', description: 'Show help', mac: '?' }
  ],

  // ============================================
  // QUICK LINKS
  // ============================================
  quickLinks: [
    {
      title: 'Create Ticket',
      description: 'Submit a new support request',
      icon: '➕',
      action: 'create-ticket',
      color: '#3b82f6'
    },
    {
      title: 'My Tickets',
      description: 'View your submitted tickets',
      icon: '📋',
      action: 'my-tickets',
      color: '#8b5cf6'
    },
    {
      title: 'System Status',
      description: 'Check system health',
      icon: '🔍',
      action: 'system-status',
      color: '#10b981'
    },
    {
      title: 'Contact Support',
      description: 'Get help from our team',
      icon: '💬',
      action: 'contact-support',
      color: '#f59e0b'
    }
  ],

  // ============================================
  // POPULAR SEARCHES
  // ============================================
  popularSearches: [
    'Create ticket',
    'Reset password',
    'Email not working',
    'Change priority',
    'Download backup',
    'User permissions',
    'SLA settings',
    'Notification settings'
  ]
};

export default helpContent;