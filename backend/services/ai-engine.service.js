// ============================================
// SMART NLP AI ENGINE — IT Support Assistant
// TF-IDF scoring, synonym expansion, fuzzy matching,
// entity extraction, context tracking, 100+ IT topics
// ============================================

const settingsService = require('./settings.service');

/**
 * ─── SYNONYM MAP ───
 * Maps common variations/typos to canonical terms.
 */
const SYNONYMS = {
  // General
  pc: 'computer', laptop: 'computer', desktop: 'computer', workstation: 'computer', machine: 'computer',
  comp: 'computer', lappy: 'computer', notebook: 'computer',
  pwd: 'password', pass: 'password', passwd: 'password', passcode: 'password',
  net: 'network', wifi: 'network', 'wi-fi': 'network', lan: 'network', ethernet: 'network',
  inet: 'internet', broadband: 'internet', web: 'internet', online: 'internet',
  mail: 'email', emails: 'email', 'e-mail': 'email', outlook: 'email', thunderbird: 'email', gmail: 'email',
  print: 'printer', printing: 'printer', printers: 'printer',
  app: 'application', apps: 'application', program: 'application', software: 'application',
  tool: 'application', programs: 'application',
  vpn: 'vpn', 'virtual private network': 'vpn',
  '2fa': 'two-factor', mfa: 'two-factor', otp: 'two-factor', totp: 'two-factor',
  authenticator: 'two-factor',
  bsod: 'blue-screen', bluescreen: 'blue-screen', 'blue screen': 'blue-screen',
  monitor: 'display', screen: 'display', screens: 'display',
  hdd: 'hard-drive', ssd: 'hard-drive', disk: 'hard-drive', 'hard disk': 'hard-drive',
  ram: 'memory', 'random access memory': 'memory',
  mic: 'microphone', mike: 'microphone',
  kb: 'keyboard', keys: 'keyboard',
  os: 'operating-system', windows: 'operating-system', linux: 'operating-system', macos: 'operating-system',
  slow: 'performance', lag: 'performance', laggy: 'performance', sluggish: 'performance',
  freeze: 'performance', freezing: 'performance', hang: 'performance', hanging: 'performance',
  crash: 'crash', crashing: 'crash', crashed: 'crash',
  err: 'error', errors: 'error', bug: 'error', bugs: 'error', issue: 'error', issues: 'error',
  prob: 'problem', probs: 'problem', problems: 'problem',
  fix: 'solve', repair: 'solve', resolve: 'solve', troubleshoot: 'solve',
  help: 'assist', helping: 'assist', support: 'assist',
  install: 'installation', installing: 'installation', uninstall: 'installation',
  reinstall: 'installation', setup: 'installation', 'set up': 'installation',
  update: 'update', updating: 'update', upgrade: 'update', upgrading: 'update', patch: 'update',
  backup: 'backup', backups: 'backup', 'back up': 'backup', restore: 'backup',
  virus: 'malware', malware: 'malware', trojan: 'malware', ransomware: 'malware',
  spyware: 'malware', adware: 'malware', antivirus: 'malware', phishing: 'malware',
  share: 'sharing', shared: 'sharing', sharing: 'sharing',
  permission: 'permissions', perms: 'permissions', access: 'permissions', rights: 'permissions',
  admin: 'administrator', 'admin rights': 'administrator',
  creds: 'credentials', credential: 'credentials', login: 'credentials', signin: 'credentials',
  'sign in': 'credentials', logon: 'credentials', 'log on': 'credentials',
  cert: 'certificate', certs: 'certificate', ssl: 'certificate', tls: 'certificate',
  vpn: 'vpn', proxy: 'proxy', firewall: 'firewall',
  domain: 'active-directory', ad: 'active-directory', ldap: 'active-directory',
  dns: 'dns', dhcp: 'dhcp',
  usb: 'usb', pendrive: 'usb', 'flash drive': 'usb', thumb: 'usb',
  cam: 'camera', webcam: 'camera',
  teams: 'teams', zoom: 'zoom', meet: 'meet', skype: 'skype',
  excel: 'excel', word: 'word', powerpoint: 'powerpoint', ppt: 'powerpoint',
  onedrive: 'onedrive', sharepoint: 'sharepoint', gdrive: 'google-drive',
  ticket: 'ticket', tickets: 'ticket', request: 'ticket',
  sla: 'sla', 'service level': 'sla', escalation: 'escalation', escalate: 'escalation',
};

/**
 * ─── STOP WORDS ───
 * Common words to ignore in scoring.
 */
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'its',
  'they', 'them', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'also', 'get', 'got',
  'could', 'would', 'shall', 'may', 'might', 'must', 'need', 'please', 'want',
  'like', 'able', 'unable', 'cannot', 'cant', "can't", "won't", "don't", "doesn't",
  'im', "i'm", "i've", 'ive', 'try', 'trying', 'tried'
]);

/**
 * ─── KNOWLEDGE BASE ───
 * Comprehensive IT support corpus.
 * Each entry has: id, category, keywords (weighted), question patterns, answer, followUp
 */
const KNOWLEDGE_BASE = [
  // ╔════════════════════════════════════════════╗
  // ║  ACCOUNT & AUTH                            ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'password-reset',
    category: 'account',
    keywords: ['password', 'reset', 'forgot', 'change', 'credentials', 'locked', 'unlock', 'expire', 'expired'],
    patterns: ['reset password', 'forgot password', 'change password', 'password expired', 'locked out', 'account locked', 'cant login', 'cannot login', 'wrong password', 'password not working', 'how to change my password', 'i forgot my password', 'password help', 'help with password', 'password issue', 'password problem'],
    answer: `Here's how to reset your password:\n\n**Step 1:** Go to the login page and click **"Forgot Password"**.\n**Step 2:** Enter your registered email address.\n**Step 3:** Check your inbox (and spam folder) for the reset link.\n**Step 4:** Click the link (valid for {{password_reset_token_expiry_hours}} hour(s)) and set a new password.\n\n**Password Requirements:**\n• Minimum {{password_min_length}} characters\n• At least 1 uppercase letter, 1 lowercase, 1 number, 1 special character\n• Cannot reuse your last {{password_history_count}} passwords\n\n**Account Locked?**\nAfter {{lockout_attempts}} failed attempts, your account is locked for {{lockout_duration_minutes}} minutes. Wait or contact an admin to unlock it manually.`,
    followUp: ['How do I enable 2FA?', 'My account is still locked', 'Create a ticket']
  },
  {
    id: 'two-factor-auth',
    category: 'security',
    keywords: ['two-factor', 'two factor', '2fa', 'mfa', 'authenticator', 'verification', 'otp', 'security code', 'backup codes'],
    patterns: ['setup 2fa', 'enable two factor', 'authenticator app', 'verification code not working', 'lost 2fa', 'disable 2fa', 'backup codes', 'how to set up two factor', 'mfa not working'],
    answer: `**Two-Factor Authentication (2FA) Setup:**\n\n1. Go to **Profile → Security → Two-Factor Authentication**\n2. Choose your method:\n   • 📧 **Email** — Code sent to your email each login\n   • 📱 **Authenticator App** — Google/Microsoft Authenticator (more secure)\n3. Follow the setup wizard\n4. **Save your 10 backup codes** in a safe place\n5. Verify and enable\n\n**Lost Access to 2FA?**\n• Use one of your **backup codes** to login\n• If no backup codes → Contact admin to disable 2FA on your account\n\n**Tips:**\n• Authenticator app is more secure than email\n• Never share your codes with anyone\n• Each backup code can only be used once`,
    followUp: ['Lost my 2FA access', 'How to disable 2FA', 'Password reset']
  },
  {
    id: 'account-locked',
    category: 'account',
    keywords: ['locked', 'lockout', 'lock', 'blocked', 'disabled', 'suspended', 'deactivated', 'account'],
    patterns: ['account locked', 'account blocked', 'account disabled', 'account suspended', 'why is my account locked', 'how to unlock account', 'cant access account', 'too many failed attempts'],
    answer: `**Account Locked? Here's what to do:**\n\n**Why accounts get locked:**\n• {{lockout_attempts}} failed login attempts → Auto-lock for {{lockout_duration_minutes}} minutes\n• Admin manually disabled the account\n• Password expired (not reset within grace period)\n• Security policy violation detected\n\n**How to unlock:**\n1. **Wait {{lockout_duration_minutes}} minutes** — Auto-unlock after lockout period\n2. **Reset your password** — Use "Forgot Password" on login page\n3. **Contact your administrator** — They can unlock immediately\n4. **Create a ticket** — If admin isn't available\n\n**Prevention:**\n• Use a password manager to avoid typos\n• Enable 2FA for extra security\n• Change password before it expires (you'll get email reminders)`,
    followUp: ['Reset my password', 'Enable 2FA', 'Contact admin']
  },
  {
    id: 'login-issues',
    category: 'account',
    keywords: ['login', 'signin', 'sign in', 'log in', 'logon', 'credentials', 'authentication', 'session'],
    patterns: ['cant login', 'cannot sign in', 'login failed', 'login not working', 'session expired', 'keeps logging me out', 'invalid credentials', 'authentication failed', 'sso not working', 'single sign on'],
    answer: `**Login Troubleshooting:**\n\n**Basic Checks:**\n1. Verify your **username/email** is correct (case-sensitive)\n2. Check **Caps Lock** is off\n3. Try **copy-pasting** your password from a text file\n4. Clear browser **cache and cookies**\n5. Try a **private/incognito** window\n6. Try a **different browser**\n\n**Session Expired:**\n• Sessions expire after {{session_timeout_minutes}} minutes of inactivity\n• Just login again — your work is usually saved\n\n**SSO/Single Sign-On Issues:**\n• Make sure you're on the company network or VPN\n• Clear browser cookies for the SSO domain\n• Try logging into the SSO portal directly first\n\n**Still can't login?**\n• Your account may be locked ({{lockout_attempts}} failed attempts → {{lockout_duration_minutes}} min lock)\n• Your password may have expired\n• Try "Forgot Password" to reset`,
    followUp: ['Reset password', 'Account locked', 'VPN issues']
  },
  // ╔════════════════════════════════════════════╗
  // ║  COMPUTER & PERFORMANCE                    ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'slow-computer',
    category: 'troubleshooting',
    keywords: ['performance', 'slow', 'lag', 'freeze', 'hang', 'unresponsive', 'speed', 'computer', 'startup'],
    patterns: ['computer slow', 'pc slow', 'laptop slow', 'running slow', 'very slow', 'too slow', 'takes forever', 'computer hanging', 'computer freezing', 'not responding', 'system slow', 'everything is slow', 'slow startup', 'takes long to boot', 'computer help', 'help with computer', 'pc help', 'laptop help'],
    answer: `**Speed Up Your Computer — Step by Step:**\n\n**Quick Fixes (try first):**\n1. 🔄 **Restart your computer** — Fixes 80% of issues\n2. ❌ **Close unnecessary programs** — Ctrl+Shift+Esc → End Task\n3. 🌐 **Close browser tabs** — Each tab uses RAM\n\n**Intermediate Steps:**\n4. 💾 **Check disk space** — Keep at least 15% free (C: drive → Properties)\n5. 🧹 **Run Disk Cleanup** — Search "Disk Cleanup" in Start\n6. 🚫 **Disable startup programs** — Task Manager → Startup tab → Disable non-essential\n7. 📊 **Check for resource hogs** — Task Manager → Sort by CPU/Memory\n\n**Advanced:**\n8. 🛡️ **Scan for malware** — Run full antivirus scan\n9. 🔄 **Windows Update** — Settings → Update & Security\n10. 🖥️ **Check temperatures** — Overheating throttles CPU\n11. 📉 **Defragment HDD** (NOT SSD) — Search "Defragment"\n\n**Hardware indicators (needs IT):**\n• Disk at 100% constantly → May need SSD upgrade\n• RAM always maxed → May need more RAM\n• CPU always high → May need hardware replacement\n\n**If none of these work**, create a ticket with:\n• Computer model & age\n• RAM and disk space info (Task Manager → Performance)\n• What specifically is slow`,
    followUp: ['Check disk space', 'Remove startup programs', 'Create a ticket']
  },
  {
    id: 'blue-screen',
    category: 'troubleshooting',
    keywords: ['blue-screen', 'bsod', 'crash', 'stop error', 'system crash', 'boot', 'restart loop', 'wont boot', 'wont start'],
    patterns: ['blue screen', 'blue screen of death', 'bsod error', 'computer crashed', 'system crashed', 'keeps crashing', 'crash loop', 'restart loop', 'wont boot', 'wont start', 'boot failure', 'startup repair', 'computer wont turn on', 'stop error', 'kernel panic'],
    answer: `**Blue Screen / System Crash Fix:**\n\n**Immediate Steps:**\n1. 📝 **Note the error code** (e.g., KERNEL_DATA_INPAGE_ERROR, IRQL_NOT_LESS_OR_EQUAL)\n2. 📸 **Photo the screen** with your phone before it restarts\n3. Let it restart naturally\n\n**If it boots normally:**\n1. Save all open work immediately\n2. Check **Event Viewer**: Start → "Event Viewer" → Windows Logs → System → look for "Critical"\n3. Run **Windows Update** — many BSODs are driver-related\n4. Check recent **driver updates or software changes**\n5. Run: \`sfc /scannow\` in Admin Command Prompt\n6. Run: \`DISM /Online /Cleanup-Image /RestoreHealth\`\n\n**If stuck in crash loop:**\n1. Hold Shift while clicking Restart → "Troubleshoot" → "Advanced"\n2. Try **Safe Mode** → Uninstall recent software/drivers\n3. Try **System Restore** to a working restore point\n4. Run **Startup Repair**\n\n**Common BSOD causes:**\n• Bad driver update → Roll back the driver\n• RAM failure → Run Windows Memory Diagnostic\n• Overheating → Check fans and vents\n• Disk failure → Run \`chkdsk /f /r\`\n\n⚠️ **Create a Critical ticket if it happens repeatedly or you can't boot.**`,
    followUp: ['Computer wont start', 'Run memory diagnostic', 'Create a critical ticket']
  },
  {
    id: 'computer-wont-start',
    category: 'troubleshooting',
    keywords: ['start', 'boot', 'power', 'turn on', 'black screen', 'no display', 'dead', 'computer'],
    patterns: ['computer wont start', 'computer wont turn on', 'laptop wont start', 'black screen', 'no display', 'power button not working', 'no power', 'dead computer', 'nothing on screen', 'blank screen on boot'],
    answer: `**Computer Won't Start — Troubleshooting:**\n\n**No power at all (no lights, no fans):**\n1. Check power cable is firmly plugged in (both ends)\n2. Try a different power outlet\n3. For laptops: Remove battery, hold power 30 sec, reinsert, try again\n4. Check power strip/surge protector is on\n5. Try a different power cable if available\n\n**Power on but black screen:**\n1. Check monitor cable connection (both ends)\n2. Try a different monitor/display\n3. Press a key / move mouse — might be in sleep mode\n4. External monitor: Try Fn + display key (F4/F5/F7 varies)\n5. Listen for beep codes — indicates hardware issue\n\n**Shows logo then dies/loops:**\n1. Force shutdown: Hold power 10 seconds\n2. Start → Immediately press F8/F11 for Recovery\n3. Try Safe Mode\n4. Run Startup Repair\n5. Try System Restore\n\n⚠️ **Do NOT try to open/repair hardware yourself** — create a ticket for hardware issues.`,
    followUp: ['Blue screen errors', 'Data recovery', 'Create a ticket']
  },
  {
    id: 'overheating',
    category: 'troubleshooting',
    keywords: ['hot', 'heat', 'overheat', 'temperature', 'fan', 'noisy', 'loud', 'thermal'],
    patterns: ['computer overheating', 'laptop very hot', 'fan running loud', 'fan noise', 'overheating', 'too hot', 'thermal throttling', 'cpu temperature high', 'fan wont stop'],
    answer: `**Computer Overheating Solutions:**\n\n**Immediate:**\n1. 🛑 Save work and shut down if extremely hot\n2. Place on a **hard, flat surface** (not bed/pillow/carpet)\n3. Check that **vents are not blocked**\n\n**Short-term fixes:**\n4. 🧹 **Clean dust from vents** with compressed air\n5. ❌ **Close heavy programs** (games, video editing, etc.)\n6. 📊 **Check Task Manager** for programs using high CPU\n7. ⚡ Change **Power Plan** to "Balanced" (not "High Performance")\n\n**Long-term fixes:**\n8. 🔧 **Internal cleaning** — Dust buildup on heatsink/fan (IT can do this)\n9. 💻 **Laptop cooling pad** — Helps a lot for laptops\n10. 🔄 **Replace thermal paste** — If >3 years old (IT task)\n11. 📋 **Check BIOS** fan settings\n\n**Warning signs that need IT support:**\n• Sudden shutdowns without warning\n• CPU temperature above 90°C consistently\n• Fan making grinding noises\n• Burning smell (immediate shutdown required!)`,
    followUp: ['Computer slow', 'Fan making noise', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  NETWORK & CONNECTIVITY                    ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'network-issues',
    category: 'network',
    keywords: ['network', 'internet', 'wifi', 'connection', 'disconnect', 'no internet', 'connectivity', 'wireless'],
    patterns: ['no internet', 'wifi not working', 'cant connect to wifi', 'internet not working', 'network disconnected', 'no network connection', 'wifi keeps dropping', 'internet slow', 'connection dropped', 'limited connectivity', 'no wifi', 'wifi down', 'network help', 'help with network', 'wifi help', 'internet help'],
    answer: `**Network Troubleshooting — Step by Step:**\n\n**Step 1 — Basic checks:**\n• Is WiFi turned on? (Check taskbar icon)\n• Is Airplane mode OFF?\n• Can OTHER devices connect? (helps isolate the issue)\n\n**Step 2 — Quick fixes:**\n• Toggle WiFi off → wait 10 sec → on\n• "Forget" the network → Reconnect with password\n• Restart your computer\n\n**Step 3 — Network reset:**\nOpen **Command Prompt as Admin** and run:\n\`\`\`\nipconfig /release\nipconfig /renew\nipconfig /flushdns\nnetsh winsock reset\n\`\`\`\nRestart after running these.\n\n**Step 4 — Hardware:**\n• Restart router/modem (unplug 30 seconds)\n• Try Ethernet cable (bypasses WiFi issues)\n• Check for physical damage to cables\n\n**Step 5 — Driver:**\n• Device Manager → Network Adapters → Update driver\n• Or: Right-click adapter → Disable → Enable\n\n**WiFi specific:**\n• Move closer to the access point\n• Check if 5GHz vs 2.4GHz makes a difference\n• Too many devices on same network can cause slowness`,
    followUp: ['VPN issues', 'DNS problems', 'Create a ticket']
  },
  {
    id: 'vpn-issues',
    category: 'network',
    keywords: ['vpn', 'remote', 'connect', 'tunnel', 'cisco', 'anyconnect', 'globalprotect', 'wireguard'],
    patterns: ['vpn not connecting', 'vpn disconnects', 'vpn slow', 'cant connect to vpn', 'vpn error', 'remote access not working', 'vpn keeps dropping', 'vpn timeout', 'unable to establish vpn'],
    answer: `**VPN Troubleshooting:**\n\n**Basic Fixes:**\n1. Check your **internet connection** works first (try google.com)\n2. **Close and reopen** the VPN client\n3. **Restart your computer**\n4. Check VPN **credentials** — password may have changed\n5. Try a **different VPN server** if available\n\n**Common VPN Errors:**\n\n**"Connection timed out":**\n• Firewall may be blocking VPN\n• Try a different network (hotel/coffee shop WiFi might block VPN)\n• Disable third-party firewall temporarily\n\n**"Authentication failed":**\n• Reset your VPN password (may be separate from main password)\n• Check if your 2FA code is current\n• Ensure your account has VPN access (check with admin)\n\n**"Connected but can't access resources":**\n• DNS issue: Try \`ipconfig /flushdns\`\n• Try accessing by IP address instead of hostname\n• Split tunnel vs full tunnel — ask IT which applies\n\n**VPN Slow:**\n• Try a closer VPN server\n• Switch from WiFi to Ethernet\n• Close bandwidth-heavy apps (video streaming)`,
    followUp: ['Network issues', 'DNS problems', 'Create a ticket']
  },
  {
    id: 'dns-issues',
    category: 'network',
    keywords: ['dns', 'domain', 'resolve', 'name resolution', 'nslookup', 'website not loading'],
    patterns: ['dns not working', 'dns error', 'cant resolve hostname', 'website not loading', 'dns_probe_finished', 'server not found', 'name not resolved', 'nxdomain', 'dns timeout'],
    answer: `**DNS Troubleshooting:**\n\n**Quick Fix — Flush DNS:**\nOpen Command Prompt as Admin:\n\`\`\`\nipconfig /flushdns\nipconfig /registerdns\n\`\`\`\n\n**Change DNS Server (temporary):**\n1. Settings → Network → Change adapter options\n2. Right-click your connection → Properties\n3. IPv4 → Properties → "Use the following DNS"\n4. Try:\n   • Google: 8.8.8.8 / 8.8.4.4\n   • Cloudflare: 1.1.1.1 / 1.0.0.1\n\n**Test DNS:**\n\`\`\`\nnslookup google.com\nnslookup yourcompany.com\n\`\`\`\n\n**If internal-only sites fail:**\n• You might need VPN to access internal DNS\n• Check with IT for correct internal DNS server addresses\n• May be a company DNS server outage — check with others\n\n**Browser-specific:**\n• Clear browser cache & cookies\n• Try incognito mode\n• Disable browser DNS-over-HTTPS temporarily`,
    followUp: ['Network issues', 'VPN issues', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  PRINTER                                   ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'printer-issues',
    category: 'hardware',
    keywords: ['printer', 'print', 'printing', 'paper', 'jam', 'toner', 'ink', 'scanner', 'scan'],
    patterns: ['printer not working', 'cant print', 'printer offline', 'paper jam', 'print queue stuck', 'printer not found', 'add printer', 'install printer', 'print quality bad', 'scanner not working', 'printer error', 'printer help', 'help with printer', 'printing help'],
    answer: `**Printer Troubleshooting:**\n\n**Printer Not Responding:**\n1. Check printer is **powered on** and has paper/ink\n2. Check cable/WiFi connection\n3. Restart the printer (off 30 sec, then on)\n4. Settings → Devices → Printers → Set as **Default**\n5. Right-click printer → **Troubleshoot**\n\n**Printer Shows Offline:**\n1. Settings → Devices → Printers\n2. Click printer → **Open queue**\n3. Printer menu → Uncheck **"Use Printer Offline"**\n4. Cancel all stuck print jobs\n5. Try printing again\n\n**Print Queue Stuck:**\n1. Open Services (Win+R → services.msc)\n2. Find "Print Spooler" → **Stop**\n3. Go to \`C:\\Windows\\System32\\spool\\PRINTERS\` → Delete all files\n4. Start "Print Spooler" again\n5. Try printing\n\n**Paper Jam:**\n1. Turn off printer\n2. Open all access doors\n3. Gently pull paper in direction of paper path\n4. Check for small torn pieces\n5. Close doors, turn on, test\n\n**Print Quality Problems:**\n• Run head cleaning from printer menu\n• Replace low ink/toner\n• Check paper type settings match actual paper`,
    followUp: ['Add a new printer', 'Scanner issues', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  EMAIL                                     ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'email-issues',
    category: 'email',
    keywords: ['email', 'outlook', 'inbox', 'send', 'receive', 'attachment', 'calendar', 'signature', 'spam', 'junk'],
    patterns: ['email not working', 'outlook not working', 'cant send email', 'cant receive email', 'email stuck in outbox', 'outlook crashing', 'outlook slow', 'email not received', 'missing emails', 'email bounced', 'out of office setup', 'email signature', 'email help', 'help with email', 'outlook help'],
    answer: `**Email / Outlook Troubleshooting:**\n\n**Can't Send/Receive:**\n1. Check internet connection\n2. Click **Send/Receive All Folders** (or press F9)\n3. Check **Outbox** for stuck emails (over 25MB = stuck)\n4. Restart Outlook\n5. Check mailbox isn't full (go to File → Info → see size)\n\n**Outlook Crashing:**\n1. Open in **Safe Mode**: Hold Ctrl while clicking Outlook\n2. Disable add-ins: File → Options → Add-ins → Manage\n3. Repair Office: Settings → Apps → Office → Modify → Repair\n4. Create new Outlook profile: Control Panel → Mail → Show Profiles\n\n**Missing Emails:**\n• Check **Junk/Spam** folder\n• Check **Deleted Items**\n• Check **Focused vs Other** inbox (toggle at top)\n• Check **Rules**: File → Manage Rules (auto-moving?)\n• Search by sender or subject in search bar\n\n**Out of Office:**\nFile → Automatic Replies → Set your message and dates\n\n**Email Signature:**\nFile → Options → Mail → Signatures → Create/edit\n\n**Large Attachments:**\n• Outlook limit: usually 25MB\n• Use OneDrive/SharePoint link for larger files\n• Compress files before attaching`,
    followUp: ['Outlook crashing', 'Setup email signature', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  SOFTWARE & APPS                           ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'software-install',
    category: 'software',
    keywords: ['installation', 'install', 'software', 'application', 'download', 'license', 'activate', 'program'],
    patterns: ['install software', 'how to install', 'software installation', 'cant install', 'need software', 'request software', 'install application', 'download program', 'software license', 'activation failed', 'trial expired'],
    answer: `**Software Installation Guide:**\n\n**Company-Approved Software (self-service):**\n1. Open **Software Center** (search in Start menu)\n2. Browse or search for the application\n3. Click **Install** — it installs automatically\n\n**Software NOT in Software Center:**\n1. Create a support ticket with:\n   • Software name and version\n   • Business justification\n   • Your manager's approval\n2. IT reviews for licensing, security, and compatibility\n3. Typical approval: 1-2 business days\n4. IT installs remotely or provides installer\n\n**License/Activation Issues:**\n• Note the exact error message\n• Check if license = per-user or per-machine\n• IT can reactivate or reassign licenses\n• For Microsoft 365: Sign out → Sign back in\n\n**Can't Install (admin rights needed):**\n• Standard users can't install .exe files directly\n• Use Software Center for approved apps\n• Or create a ticket — IT can install remotely for you\n\n**Software Updates:**\n• Windows: Settings → Update & Security\n• Office: File → Account → Update Options\n• Other: Usually in Help → Check for Updates`,
    followUp: ['Request admin rights', 'Software not working', 'Create a ticket']
  },
  {
    id: 'software-not-working',
    category: 'software',
    keywords: ['application', 'not working', 'crash', 'error', 'broken', 'stopped', 'wont open', 'unresponsive'],
    patterns: ['software not working', 'app not working', 'application crashed', 'program wont open', 'app keeps crashing', 'software error', 'application error', 'program not responding', 'app freezing', 'software broken'],
    answer: `**Software Not Working — Fix Steps:**\n\n**Quick Fixes:**\n1. **Close and reopen** the application\n2. **End the process**: Ctrl+Shift+Esc → Find app → End Task → Reopen\n3. **Restart your computer** (always worth trying)\n\n**Intermediate:**\n4. **Run as Administrator**: Right-click → Run as administrator\n5. **Check for updates**: Help menu → Check for updates\n6. **Repair the installation**:\n   Settings → Apps → Find the app → Modify/Repair\n7. **Clear cache/temp files**: %AppData% and %LocalAppData% folders\n\n**Advanced:**\n8. **Reinstall**: Uninstall completely → Restart → Reinstall\n9. **Check compatibility**: Right-click .exe → Properties → Compatibility\n10. **Check Event Viewer** for error details:\n    Start → Event Viewer → Application → Look for errors\n\n**Before creating a ticket, note:**\n• Exact error message (screenshot it)\n• When it started (after an update?)\n• Does it happen every time or intermittently?\n• Have you tried other computers?`,
    followUp: ['Reinstall software', 'Error message help', 'Create a ticket']
  },
  {
    id: 'microsoft-office',
    category: 'software',
    keywords: ['office', 'excel', 'word', 'powerpoint', 'microsoft', '365', 'ppt', 'spreadsheet', 'document'],
    patterns: ['excel not working', 'word crashed', 'powerpoint wont open', 'office error', 'office activation', 'office 365 issues', 'excel formula', 'word formatting', 'ppt not saving', 'office repair', 'excel recovery'],
    answer: `**Microsoft Office Troubleshooting:**\n\n**Office Won't Open / Crashes:**\n1. Open the specific app in **Safe Mode**: Hold Ctrl while opening\n2. **Disable add-ins**: File → Options → Add-ins → Go → Uncheck all\n3. **Repair Office**:\n   Settings → Apps → Microsoft Office → Modify → Quick Repair\n   If that fails: → Online Repair (takes longer but more thorough)\n4. **Update Office**: File → Account → Update Options → Update Now\n\n**"Unlicensed Product" / Activation:**\n1. File → Account → Check sign-in status\n2. Sign out and sign back in with your company email\n3. If persistent: Clear credentials from Windows Credential Manager\n\n**Excel Recovery (Lost Work):**\n1. File → Open → Recent → "Recover Unsaved Workbooks"\n2. Check: C:\\Users\\{you}\\AppData\\Local\\Microsoft\\Office\\UnsavedFiles\n3. Enable AutoSave (top-left toggle) for OneDrive files\n\n**Word/PPT:**\n• Recover: File → Info → Manage Document → Recover\n• Slow? Disable hardware acceleration: File → Options → Advanced\n• Formatting issues? Clear formatting: Ctrl+Space`,
    followUp: ['Office activation', 'Recover lost file', 'Create a ticket']
  },
  {
    id: 'teams-zoom',
    category: 'software',
    keywords: ['teams', 'zoom', 'meeting', 'video', 'audio', 'microphone', 'camera', 'call', 'conference', 'screen share'],
    patterns: ['teams not working', 'zoom not working', 'no audio in meeting', 'camera not working', 'microphone not working', 'cant hear in meeting', 'screen share not working', 'video call issues', 'cant join meeting', 'echo in meeting', 'teams audio issues'],
    answer: `**Video Conferencing Troubleshooting (Teams/Zoom):**\n\n**No Audio:**\n1. Check if you're **muted** (mic icon)\n2. Check **correct speaker/mic** selected: Settings → Devices\n3. Check **system volume** (taskbar sound icon)\n4. Try **Leave and rejoin** the meeting\n5. Test: Settings → Devices → Make a test call\n\n**Camera Not Working:**\n1. Check camera is **not blocked** (some laptops have a physical switch/cover)\n2. Check **correct camera** selected in meeting settings\n3. Close any OTHER app using the camera (Zoom, Skype, etc.)\n4. Device Manager → Cameras → Update/Reinstall driver\n5. Check **Privacy settings**: Settings → Privacy → Camera → Allow apps\n\n**Screen Share Not Working:**\n1. Make sure you're sharing the **correct window/screen**\n2. In Teams: Check if your **role** allows screen sharing\n3. Close confidential content notifications\n4. Try sharing entire screen instead of specific window\n\n**Echo / Feedback:**\n• Use **headphones** instead of speakers\n• Mute when not speaking\n• Only ONE device in the meeting (close phone if using laptop)\n\n**General:**\n• Update the app to latest version\n• Restart the app\n• Check internet speed: speed test → need at least 1.5 Mbps up/down`,
    followUp: ['Audio not working', 'Network issues', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  SECURITY                                  ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'malware-virus',
    category: 'security',
    keywords: ['malware', 'virus', 'antivirus', 'infected', 'phishing', 'ransomware', 'suspicious', 'threat', 'security'],
    patterns: ['virus detected', 'computer infected', 'malware warning', 'suspicious email', 'phishing email', 'ransomware', 'antivirus alert', 'security threat', 'popup ads', 'browser hijacked', 'strange behavior', 'hacked'],
    answer: `**Security Threat Response:**\n\n**🚨 If you suspect infection:**\n1. **DISCONNECT from network** (unplug Ethernet / disable WiFi)\n2. **Don't click anything** suspicious\n3. **Don't enter passwords** on untrusted prompts\n4. Run a **full antivirus scan**\n5. **Create a Critical ticket IMMEDIATELY**\n\n**Suspicious Email (Phishing):**\n1. Do NOT click any links or download attachments\n2. Check sender's actual email address (hover over it)\n3. Look for: urgency, typos, generic greeting, suspicious URL\n4. Report: Forward to your IT security team\n5. Delete the email\n\n**Popup Ads / Browser Hijacked:**\n1. Don't click the popups (especially "You're infected!" fakes)\n2. Close browser completely: Ctrl+Shift+Esc → End Task if needed\n3. Clear browser data & reset settings\n4. Check installed extensions — remove anything unknown\n5. Run antivirus scan\n\n**Ransomware:**\n1. 🛑 **IMMEDIATELY disconnect from network**\n2. **Do NOT pay the ransom**\n3. **Do NOT restart** the computer\n4. Contact IT IMMEDIATELY — this is a Critical incident\n5. IT will isolate, assess, and begin recovery from backups\n\n**Prevention:**\n• Never click links in unexpected emails\n• Verify requests for money/credentials by phone\n• Keep software updated\n• Use strong, unique passwords\n• Enable 2FA everywhere possible`,
    followUp: ['Suspicious email', 'Run antivirus', 'Create a critical ticket']
  },
  {
    id: 'data-security',
    category: 'security',
    keywords: ['data', 'encrypt', 'encryption', 'sensitive', 'confidential', 'gdpr', 'privacy', 'compliance', 'data loss'],
    patterns: ['encrypt files', 'data security', 'sensitive data', 'how to secure files', 'data loss prevention', 'gdpr compliance', 'delete sensitive data', 'data classification', 'secure file sharing'],
    answer: `**Data Security Best Practices:**\n\n**File Encryption:**\n• Windows: Right-click file → Properties → Advanced → Encrypt\n• Office files: File → Protect → Encrypt with Password\n• USB drives: Use BitLocker To Go\n\n**Secure File Sharing:**\n• Use **OneDrive/SharePoint** with permissions (not email for sensitive data)\n• Set expiration dates on sharing links\n• Use "Specific people" instead of "Anyone with the link"\n• Revoke access when no longer needed\n\n**Data Classification:**\n• 🔴 **Confidential**: Financial, HR, customer PII → Encrypted, limited access\n• 🟠 **Internal**: Business data → Access controlled\n• 🟢 **Public**: Marketing materials → Open access\n\n**Data Loss Prevention:**\n• Don't store sensitive data on personal devices\n• Don't email confidential files externally\n• Enable BitLocker on your laptop\n• Back up to company OneDrive (auto-synced)\n• Report lost/stolen devices IMMEDIATELY\n\n**GDPR/Compliance:**\n• Only collect data you need\n• Don't share personal data without consent\n• Report data breaches within 72 hours\n• Right to be forgotten — contact Data Protection Officer`,
    followUp: ['Encrypt a file', 'Secure sharing', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  HARDWARE                                  ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'display-issues',
    category: 'hardware',
    keywords: ['display', 'monitor', 'screen', 'resolution', 'flickering', 'no display', 'dual', 'external', 'hdmi'],
    patterns: ['monitor not working', 'no display', 'screen flickering', 'resolution wrong', 'dual monitor setup', 'external monitor not detected', 'screen blank', 'display driver', 'hdmi not working', 'second monitor not working'],
    answer: `**Display / Monitor Troubleshooting:**\n\n**No Display:**\n1. Check monitor is **powered on** (LED indicator)\n2. Check cable firmly connected (both ends) — try **reseating**\n3. Try a **different cable** (HDMI, DisplayPort, USB-C)\n4. Try a **different port** on the computer\n5. For laptops: Press **Win+P** → Select display mode\n\n**External Monitor Not Detected:**\n1. **Win+P** → Select "Extend" or "Duplicate"\n2. Settings → System → Display → **"Detect"** button\n3. Update display driver: Device Manager → Display Adapters → Update\n4. Try: disconnect → restart → reconnect\n\n**Screen Flickering:**\n1. Check cable connections (loose cable = flickering)\n2. Update display driver\n3. Change refresh rate: Settings → Display → Advanced → Refresh rate\n4. Try a different cable/port\n5. Interference from nearby electronics\n\n**Resolution Wrong:**\nSettings → System → Display → Display resolution → Select recommended\n\n**Dual Monitor Setup:**\n1. Connect second monitor\n2. Win+P → Extend\n3. Settings → Display → Arrange monitors (drag to match physical layout)\n4. Set which is "Main display"`,
    followUp: ['External monitor help', 'Update display driver', 'Create a ticket']
  },
  {
    id: 'keyboard-mouse',
    category: 'hardware',
    keywords: ['keyboard', 'mouse', 'touchpad', 'trackpad', 'keys', 'cursor', 'wireless', 'bluetooth'],
    patterns: ['keyboard not working', 'mouse not working', 'keys stuck', 'touchpad not working', 'wireless mouse disconnects', 'bluetooth device not pairing', 'cursor not moving', 'keyboard typing wrong characters', 'mouse scrolling not working'],
    answer: `**Keyboard & Mouse Troubleshooting:**\n\n**Keyboard Not Working:**\n1. For wireless: Check **batteries** / charge level\n2. Check USB receiver is plugged in (or Bluetooth is on)\n3. Try a **different USB port**\n4. Check if **Num Lock / Filter Keys** is causing issues\n5. Device Manager → Keyboards → Uninstall → Restart (auto-reinstalls)\n\n**Mouse/Touchpad Not Working:**\n1. Wireless: Check batteries / receiver\n2. Clean the sensor (bottom of mouse)\n3. Try different USB port\n4. Touchpad: Check if **disabled** (Fn + touchpad key, usually F5/F7)\n5. Settings → Devices → Touchpad → Ensure enabled\n\n**Wrong Characters Typed:**\n• Check **keyboard language**: Win+Space to switch\n• Check **Num Lock** isn't on (turns right-side keys to numbers)\n• Settings → Time & Language → Language → Check keyboard layout\n\n**Bluetooth Issues:**\n1. Turn Bluetooth off/on: Settings → Devices → Bluetooth\n2. Remove device → Re-pair\n3. Update Bluetooth driver: Device Manager → Bluetooth\n4. Check device is in **pairing mode** (usually hold a button)\n\n**USB Keyboard/Mouse:**\n• Try different USB port (front vs back)\n• Test on another computer\n• Try with/without USB hub`,
    followUp: ['Bluetooth issues', 'USB not recognized', 'Create a ticket']
  },
  {
    id: 'usb-storage',
    category: 'hardware',
    keywords: ['usb', 'pendrive', 'flash drive', 'external drive', 'storage', 'hard drive', 'disk'],
    patterns: ['usb not recognized', 'usb not detected', 'external drive not showing', 'usb not working', 'cant access usb', 'usb device not recognized', 'format usb', 'disk not showing in file explorer'],
    answer: `**USB / External Storage Troubleshooting:**\n\n**USB Not Recognized:**\n1. Try a **different USB port** (especially try rear ports on desktop)\n2. Try on a **different computer** (determine if drive or port issue)\n3. Try a different **cable** (for external drives)\n4. Device Manager → Universal Serial Bus → Check for ⚠️ errors\n5. Action → "Scan for hardware changes"\n\n**USB Shows Up But Can't Access:**\n1. Open **Disk Management**: Right-click Start → Disk Management\n2. Find the drive → Check if it needs a **drive letter**:\n   Right-click → Change Drive Letter → Add\n3. If it says "RAW" → Data may be corrupted\n4. If it says "Unallocated" → May need formatting (⚠️ erases data)\n\n**Company Policy Note:**\n• Some organizations **block USB drives** for security\n• If blocked, use OneDrive/SharePoint for file transfer\n• Talk to admin if you need USB access for work\n\n**Safe Removal:**\n• Always **"Safely Remove Hardware"** before unplugging\n• Taskbar → USB icon → Eject\n• Prevents data corruption`,
    followUp: ['File recovery', 'Storage full', 'Create a ticket']
  },
  {
    id: 'audio-issues',
    category: 'hardware',
    keywords: ['audio', 'sound', 'speaker', 'headphone', 'microphone', 'volume', 'mute', 'no sound'],
    patterns: ['no sound', 'audio not working', 'speakers not working', 'headphones not working', 'microphone not working', 'no audio', 'sound too low', 'audio crackling', 'cant hear anything', 'sound driver'],
    answer: `**Audio Troubleshooting:**\n\n**No Sound:**\n1. Check **volume** isn't muted (taskbar speaker icon)\n2. Right-click speaker → **Open Sound settings** → Check output device\n3. Select correct **output** (speakers/headphones)\n4. Check **physical connections** (cables plugged in correctly?)\n5. Try a different audio jack or USB port\n\n**Headphones Detected But No Sound:**\n1. Right-click speaker → Sound → **Playback** tab\n2. Make sure headphones are set as **Default Device**\n3. Right-click → Properties → Levels → Check volume isn't zero\n\n**Microphone Not Working:**\n1. Settings → Privacy → Microphone → **Allow access**\n2. Sound settings → **Input** → Select correct mic\n3. Check mic isn't muted (physical mute button?)\n4. Right-click speaker → Sound → **Recording** tab → Set default\n\n**Audio Driver:**\n1. Device Manager → Sound, video and game controllers\n2. Right-click audio device → **Update driver**\n3. Or: Uninstall → Restart (auto-reinstalls)\n\n**Crackling / Distortion:**\n• Check cable connections\n• Update audio driver\n• Change sample rate: Sound → Properties → Advanced → Format`,
    followUp: ['Microphone setup', 'Update drivers', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  FILE & ACCESS                             ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'file-access',
    category: 'access',
    keywords: ['permissions', 'access', 'denied', 'unauthorized', 'shared', 'drive', 'folder', 'file', 'onedrive', 'sharepoint'],
    patterns: ['access denied', 'cant access file', 'cant access folder', 'permission denied', 'shared drive not working', 'need access to folder', 'request access', 'unauthorized access', 'file not found on network', 'mapped drive not working'],
    answer: `**File & Access Troubleshooting:**\n\n**"Access Denied" Error:**\n1. Check you're connected to **VPN** (if remote)\n2. Verify the path is correct\n3. Try accessing via **full path**: \`\\\\server\\share\\folder\`\n4. You may simply not have permission → Request access\n\n**Request Access:**\n1. Create a ticket with:\n   • Exact folder/file path\n   • What access you need (read/write/full)\n   • Business justification\n   • Your manager's approval\n2. The folder owner or IT will grant access\n\n**Mapped Drive Not Working:**\n1. Check **network/VPN** connection\n2. Right-click drive → Disconnect → Re-map\n3. Try direct path: Open File Explorer → type \`\\\\server\\share\`\n4. Re-map: Right-click "This PC" → Map Network Drive\n\n**OneDrive / SharePoint:**\n• Sign in with correct account (work, not personal)\n• Check OneDrive sync status (cloud icon in taskbar)\n• "Request Access" button on SharePoint (site owners approve)\n• Clear browser cache if web version issues\n\n**File Locked / In Use:**\n• Someone else has it open — coordinate with them\n• If you had it open: Close all Office apps → try again\n• Force close: IT can check who has it locked`,
    followUp: ['VPN issues', 'OneDrive sync', 'Create a ticket']
  },
  {
    id: 'data-backup-recovery',
    category: 'access',
    keywords: ['backup', 'recover', 'recovery', 'deleted', 'lost', 'restore', 'recycle', 'previous version'],
    patterns: ['recover deleted file', 'accidentally deleted', 'file recovery', 'restore file', 'lost my file', 'where did my file go', 'recycle bin empty', 'previous versions', 'backup restore', 'data recovery'],
    answer: `**Data Recovery Guide:**\n\n**Step 1 — Check Recycle Bin:**\n• Open Recycle Bin on Desktop → Find file → Right-click → **Restore**\n\n**Step 2 — Previous Versions:**\n• Navigate to the folder where the file was\n• Right-click → **Properties** → **Previous Versions** tab\n• Select a version from before deletion → Restore\n\n**Step 3 — OneDrive / SharePoint:**\n• OneDrive has its own **Recycle Bin** (web → Recycle Bin in sidebar)\n• Keeps deleted files for **93 days**\n• Version history: Right-click file → Version History → Restore\n\n**Step 4 — Office AutoRecovery:**\n• Excel/Word: File → Open → Recent → "Recover Unsaved Documents"\n• Check: \`C:\\Users\\{you}\\AppData\\Local\\Microsoft\\Office\\UnsavedFiles\`\n\n**Step 5 — IT Backup Restore:**\n• If above fails, create a ticket with:\n  • Exact file name and path\n  • Approximate date when it last existed\n  • How it was deleted (if you know)\n• IT can restore from server backups (typically kept 30-90 days)\n\n⚠️ **Time is critical** — the sooner you report, the better the chances of recovery.`,
    followUp: ['Setup auto-backup', 'OneDrive help', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  TICKETING SYSTEM                          ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'create-ticket',
    category: 'helpdesk',
    keywords: ['ticket', 'create', 'submit', 'raise', 'open', 'report', 'request', 'new ticket'],
    patterns: ['create ticket', 'new ticket', 'submit ticket', 'raise ticket', 'report issue', 'report problem', 'open ticket', 'how to create ticket', 'file a request', 'log a ticket', 'raise a request'],
    answer: `**How to Create a Support Ticket:**\n\n1. Click **"New Ticket"** button (top-right) or go to **Tickets → Create**\n2. Fill in the form:\n   • **Subject** — Be specific (e.g., "Cannot access shared drive X")\n   • **Priority** — Based on business impact:\n     🔴 Critical (business stopped) | 🟠 High | 🟡 Medium | 🟢 Low\n   • **Category** — Select the most relevant\n   • **Description** — The more detail, the faster the fix:\n     - What happened?\n     - When did it start?\n     - Any error messages? (screenshot!)\n     - What have you already tried?\n3. **Attach files** if helpful (max 5 files, 10MB each)\n4. Click **Submit**\n\n**Tips for faster resolution:**\n✅ One issue per ticket\n✅ Include screenshots of errors\n✅ Mention what you've already tried\n✅ Set priority accurately (not everything is "Critical")\n✅ Respond promptly when IT asks questions`,
    followUp: ['Priority guidelines', 'Track my ticket', 'SLA information']
  },
  {
    id: 'ticket-status',
    category: 'helpdesk',
    keywords: ['ticket', 'status', 'track', 'progress', 'where', 'my ticket', 'update', 'pending'],
    patterns: ['ticket status', 'track ticket', 'where is my ticket', 'my ticket status', 'ticket progress', 'ticket update', 'whats happening with my ticket', 'no response on ticket', 'ticket pending'],
    answer: `**Ticket Status Guide:**\n\n**Status meanings:**\n🟢 **Open** — Created, awaiting assignment\n🔵 **Assigned** — Engineer assigned to your case\n🔄 **In Progress** — Actively being worked on\n🟠 **Pending** — ⚠️ Waiting for YOUR response (SLA timer paused!)\n✅ **Resolved** — Fix applied, awaiting your confirmation\n🔒 **Closed** — Complete and archived\n🚨 **Escalated** — SLA breached, supervisors involved\n\n**To check your tickets:**\n1. Click **"My Tickets"** in the sidebar\n2. See all tickets with real-time status\n3. Click any ticket for full details & history\n4. Add comments for updates\n\n**Important:**\n• When status is **"Pending"** → Respond ASAP! The clock is paused waiting for you.\n• After **"Resolved"** → Confirm the fix works or reopen within 48 hours.\n• Tickets auto-close after 7 days if no response.\n\n**No response from IT?**\n• Add a comment to bump the ticket\n• Check priority is set correctly\n• SLA timers ensure response — escalation is automatic on breach`,
    followUp: ['SLA information', 'Reopen a ticket', 'Create a ticket']
  },
  {
    id: 'ticket-priority-sla',
    category: 'helpdesk',
    keywords: ['sla', 'priority', 'response time', 'resolution', 'urgency', 'escalation', 'breach'],
    patterns: ['sla meaning', 'what is sla', 'priority levels', 'response time', 'resolution time', 'ticket priority', 'how long to fix', 'escalation rules', 'sla breach', 'when will it be fixed', 'priority guidelines'],
    answer: `**Priority Levels & SLA:**\n\n🔴 **Critical** — Business-wide impact / system down\n   • Response: 1 hour | Resolution: 4 hours\n   • Auto-escalates to management on breach\n\n🟠 **High** — Major impact on team/department\n   • Response: 2 hours | Resolution: 8 hours\n\n🟡 **Medium** — Individual work affected but manageable\n   • Response: 4 hours | Resolution: 24 hours\n\n🟢 **Low** — Minor issue / informational request\n   • Response: 8 hours | Resolution: 48 hours\n\n**SLA Rules:**\n• Times are **business hours** only (Mon-Fri, 9 AM – 6 PM)\n• Timer **pauses** on weekends, holidays, and "Pending" status\n• Timer **resumes** when you respond to a "Pending" ticket\n• Automatic **escalation** when SLA is about to breach\n\n**Choosing Priority:**\nAsk yourself:\n• Is the whole business affected? → 🔴 Critical\n• Is my team blocked? → 🟠 High\n• Can I work around it? → 🟡 Medium\n• Just annoying? → 🟢 Low\n\n⚠️ Setting everything as "Critical" slows down real emergencies.`,
    followUp: ['Create a ticket', 'Track my ticket', 'What is escalation']
  },
  // ╔════════════════════════════════════════════╗
  // ║  MOBILE & REMOTE WORK                      ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'remote-work',
    category: 'remote',
    keywords: ['remote', 'work from home', 'wfh', 'home office', 'remote desktop', 'rdp', 'citrix'],
    patterns: ['work from home setup', 'remote desktop', 'rdp not working', 'citrix not working', 'how to work remotely', 'remote access', 'work from home issues', 'connect from home', 'virtual desktop'],
    answer: `**Remote Work Setup & Troubleshooting:**\n\n**Getting Started Remotely:**\n1. Connect to **VPN** first (required for most company resources)\n2. Open **Remote Desktop** or **Citrix** to access your work PC\n3. Use **Teams/Zoom** for meetings\n4. Files via **OneDrive/SharePoint** (auto-synced)\n\n**Remote Desktop (RDP):**\n• Open: Start → search "Remote Desktop Connection"\n• Enter your **work computer name** (ask IT if unsure)\n• Login with your **work credentials**\n• Make sure your work PC is **turned on**\n\n**RDP Not Working:**\n1. Check VPN is connected\n2. Verify PC name is correct\n3. Work PC may be off / in sleep mode\n4. Firewall might block RDP → Contact IT\n5. Try: mstsc /v:computername\n\n**Citrix:**\n• Go to your company's **Citrix portal URL**\n• Login with work credentials\n• Launch your virtual desktop/apps\n• If slow: close unnecessary local apps, check internet speed\n\n**Best Practices:**\n• Use a wired connection when possible\n• Close bandwidth-heavy apps (Netflix, etc.)\n• Lock your screen when away (Win+L)\n• Use company tools for file sharing (not personal email/USB)`,
    followUp: ['VPN issues', 'Network problems', 'Create a ticket']
  },
  {
    id: 'mobile-device',
    category: 'remote',
    keywords: ['mobile', 'phone', 'tablet', 'iphone', 'android', 'mobile email', 'mdm', 'intune'],
    patterns: ['setup email on phone', 'mobile device management', 'company phone setup', 'intune enrollment', 'mobile email not working', 'sync email on phone', 'mobile security', 'byod'],
    answer: `**Mobile Device Setup:**\n\n**Company Email on Phone:**\n1. Open **Settings → Accounts** (or Mail app)\n2. Add Account → **Exchange/Microsoft 365**\n3. Enter your **work email** and **password**\n4. Accept security policies if prompted\n5. Email, Calendar, and Contacts will sync\n\n**MDM (Mobile Device Management) — Intune:**\n• Your company may require device enrollment\n• Install **Company Portal** app (App Store/Play Store)\n• Sign in → Follow enrollment steps\n• This allows IT to push security policies, apps, and manage the device\n\n**BYOD (Bring Your Own Device):**\n• Only install Company Portal if required\n• Keep work and personal data separate\n• Use the Outlook app (not built-in Mail) for better security\n• Enable device lock/PIN\n• Enable remote wipe capability (in case of loss)\n\n**Lost/Stolen Device:**\n1. **Immediately** contact IT → Create a critical ticket\n2. IT can remote wipe company data\n3. Change your passwords\n4. Monitor for suspicious activity`,
    followUp: ['Email setup', 'Lost device', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  WINDOWS / OS                              ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'windows-update',
    category: 'os',
    keywords: ['update', 'windows update', 'patch', 'windows', 'upgrade', 'restart pending'],
    patterns: ['windows update stuck', 'update failed', 'update not installing', 'pending restart', 'update error', 'how to update windows', 'disable updates', 'update taking too long', 'windows update error code'],
    answer: `**Windows Update Troubleshooting:**\n\n**Check for Updates:**\nSettings → Update & Security → Windows Update → Check for updates\n\n**Update Stuck / Failed:**\n1. **Restart** the computer and try again\n2. Run **Windows Update Troubleshooter**:\n   Settings → Update → Troubleshoot → Windows Update\n3. **Clear update cache**:\n   • Stop Windows Update service: \`net stop wuauserv\` (Admin CMD)\n   • Delete: \`C:\\Windows\\SoftwareDistribution\\Download\\*\`\n   • Start service: \`net start wuauserv\`\n4. Try again\n\n**Update Error Codes:**\n• Google the specific error code (e.g., 0x80070002)\n• Most have Microsoft knowledge base articles with fixes\n\n**Update Taking Too Long:**\n• DO NOT turn off during update (can corrupt Windows)\n• Some updates take 30-60 minutes\n• If stuck over 2 hours: Force restart (hold power button)\n\n**Company Managed Updates:**\n• Your IT team may control when updates install\n• "Restart pending" → Restart when convenient\n• Some updates require admin privileges — IT handles these`,
    followUp: ['Update errors', 'Restart required', 'Create a ticket']
  },
  {
    id: 'disk-space',
    category: 'os',
    keywords: ['disk', 'space', 'storage', 'full', 'clean', 'capacity', 'reclaim', 'low disk'],
    patterns: ['disk space low', 'drive full', 'no space left', 'how to free up space', 'c drive full', 'disk cleanup', 'storage almost full', 'clear disk space', 'what is taking space'],
    answer: `**Free Up Disk Space:**\n\n**Quick Space Check:**\nFile Explorer → This PC → See drive capacities\n\n**Step 1 — Disk Cleanup (built-in):**\n1. Search "Disk Cleanup" in Start\n2. Select C: drive → OK\n3. Click "Clean up system files" for more options\n4. Check: Temp files, Recycle Bin, Windows Update Cleanup\n5. OK → Delete\n\n**Step 2 — Storage Settings:**\nSettings → System → Storage\n• Turn on **Storage Sense** (auto-cleanup)\n• Click "Temporary files" → Select & Remove\n• Click "Large or unused files" → Review\n\n**Step 3 — What's Taking Space:**\n• Settings → System → Storage → Show more categories\n• Use free tool **WinDirStat** or TreeSize for visual map  \n• Common space hogs:\n  - Downloads folder (old installers)\n  - Recycle Bin (emptied via Disk Cleanup)\n  - Browser cache\n  - Temp files: %TEMP% → delete contents\n\n**Step 4 — Move Files:**\n• Move large files to OneDrive/SharePoint\n• Use "Files On-Demand" in OneDrive (keeps files in cloud)\n\n**Need more space?** IT can provide additional storage or SSD upgrade.`,
    followUp: ['Enable Storage Sense', 'Move files to cloud', 'Create a ticket']
  },
  // ╔════════════════════════════════════════════╗
  // ║  GENERAL / GREETINGS                       ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'greeting',
    category: 'general',
    keywords: ['hello', 'hi', 'hey', 'morning', 'afternoon', 'evening', 'greetings'],
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi there', 'hey there', 'hello there'],
    answer: `Hello! 👋 I'm your **IT Support AI Assistant**. I can help with a wide range of technical topics:\n\n🔑 **Account & Security** — Password reset, 2FA, login issues, lockouts\n🖥️ **Computer Issues** — Slow PC, crashes, blue screen, overheating\n🌐 **Network** — WiFi, VPN, DNS, connectivity\n🖨️ **Hardware** — Printer, monitor, keyboard, mouse, audio, USB\n📧 **Email** — Outlook, calendar, email setup\n💿 **Software** — Installation, Office issues, Teams/Zoom\n🛡️ **Security** — Malware, phishing, data protection\n📁 **Files** — Access issues, recovery, backup\n🎫 **Tickets** — Create, track, priority, SLA\n🏠 **Remote Work** — VPN, RDP, Citrix, mobile\n💻 **Windows** — Updates, disk space, system tools\n\n**Just describe your issue in plain language** and I'll guide you step by step!\n\nOr try: "My computer is slow", "How do I reset my password?", "VPN not working"`,
    followUp: ['Password reset', 'Computer is slow', 'Network issues', 'Create a ticket']
  },
  {
    id: 'how-are-you',
    category: 'general',
    keywords: ['how', 'are', 'you', 'doing', 'feeling', 'today', 'going', 'well'],
    patterns: ['how are you', 'how are you doing', 'how do you do', 'hows it going', 'how is it going', 'you ok', 'are you ok', 'whats up', "what's up", 'how have you been', 'you good', 'are you well'],
    answer: `Doing great, thanks for asking! 😊 Always here and ready to help.\n\nWhat IT issue can I assist you with today?`,
    followUp: ['Password reset', 'Computer issues', 'Network help', 'Create a ticket']
  },
  {
    id: 'bot-name-inquiry',
    category: 'general',
    keywords: ['name', 'who', 'what', 'call', 'called'],
    patterns: ['what is your name', "what's your name", 'who are you', 'what are you called', 'tell me your name', 'your name is', 'what should i call you', 'introduce yourself'],
    answer: `I'm your **IT Support AI Assistant**! 🤖\n\nI'm here to help you with any tech issues — from password resets and network problems to software installs and ticket management.\n\nWhat can I help you with today?`,
    followUp: ['What can you do?', 'Password reset', 'Create a ticket']
  },
  {
    id: 'bot-human-inquiry',
    category: 'general',
    keywords: ['human', 'bot', 'robot', 'real', 'person', 'ai', 'artificial', 'machine', 'chatbot'],
    patterns: ['are you human', 'are you a bot', 'are you a robot', 'are you real', 'am i talking to a human', 'am i talking to ai', 'are you ai', 'real person', 'talking to a machine', 'is there a human', 'real support'],
    answer: `I'm an AI assistant — not a human, but I'm built to be as helpful as possible! 🤖\n\nIf you'd prefer to speak with a real person from the IT team:\n• **Create a support ticket** and a team member will respond\n• Check the **Help Center** for direct contact options\n\nOtherwise, I'm happy to help with most IT questions right now!`,
    followUp: ['Create a ticket', 'What can you do?', 'Help Center']
  },
  {
    id: 'thanks',
    category: 'general',
    keywords: ['thank', 'thanks', 'thx', 'appreciate', 'helpful', 'solved', 'fixed', 'working', 'perfect', 'great', 'awesome'],
    patterns: ['thank you', 'thanks', 'thx', 'that helped', 'it works now', 'problem solved', 'its fixed', 'great help', 'you are awesome', 'perfect thanks', 'awesome help'],
    answer: `You're welcome! 😊 Glad I could help!\n\nIf you run into any other technical issues, I'm always here. Just type your question.\n\n**Quick actions:**`,
    followUp: ['I have another question', 'Create a ticket', 'Help Center']
  },
  {
    id: 'goodbye',
    category: 'general',
    keywords: ['bye', 'goodbye', 'see you', 'later', 'exit', 'close', 'done', 'nothing'],
    patterns: ['bye', 'goodbye', 'see you', 'no thanks', 'im done', 'nothing else', 'thats all', 'all good', 'no more questions'],
    answer: `Goodbye! 👋 If you need IT help in the future, just click the chat button anytime.\n\nHave a great day! 🌟`,
    followUp: []
  },
  {
    id: 'what-can-you-do',
    category: 'general',
    keywords: ['what', 'can', 'do', 'capabilities', 'features', 'know', 'abilities'],
    patterns: ['what can you do', 'what do you know', 'your capabilities', 'how can you help', 'what can you help with', 'what are your features', 'tell me about yourself'],
    answer: `I'm a **Smart IT Support Assistant** powered by an NLP engine. Here's what I can do:\n\n**🧠 Natural Language Understanding:**\n• Understand your questions in everyday language\n• Handle typos and variations\n• Follow-up on related topics\n\n**📚 Knowledge Areas (35+ topics):**\n• Account & password management, MFA, Active Directory\n• Computer performance & troubleshooting\n• Network, WiFi, VPN, DNS connectivity\n• Printer, monitor, keyboard, mouse, audio, USB devices\n• Email, Outlook, Calendar, shared mailboxes\n• OneDrive, SharePoint, file sync & sharing\n• Microsoft 365 activation & licensing\n• Software installation, Office, Teams, browser issues\n• Security threats, phishing, data protection\n• File access and data recovery\n• Ticketing system guidance\n• Remote work, RDP, mobile device setup\n• Windows updates, disk space, domain issues\n• New employee / onboarding setup\n\n**🎯 For each topic I provide:**\n• Step-by-step troubleshooting guides\n• Pro tips and best practices\n• When to escalate to IT support\n• Quick action suggestions\n\nJust type your issue in your own words! 💬`,
    followUp: ['Password help', 'Computer issues', 'Network help', 'Create a ticket']
  },

  // ╔════════════════════════════════════════════╗
  // ║  EXTENDED KNOWLEDGE — HIGH-VALUE TOPICS    ║
  // ╚════════════════════════════════════════════╝
  {
    id: 'onedrive-sharepoint',
    category: 'software',
    keywords: ['onedrive', 'sharepoint', 'sync', 'cloud', 'share', 'collaborate', 'teams files', 'document library'],
    patterns: ['onedrive not syncing', 'sharepoint access denied', 'files not syncing', 'onedrive error', 'sharepoint not loading', 'sync paused', 'onedrive stuck', 'sharepoint permissions', 'how to share files on onedrive', 'cloud storage full'],
    answer: `**OneDrive & SharePoint Help:**\n\n**OneDrive Not Syncing:**\n1. Click the OneDrive cloud icon in the taskbar\n2. If sync is paused: Click "Resume syncing"\n3. Sign out and sign back in to OneDrive\n4. Restart OneDrive: Right-click icon → Close → Reopen from Start\n5. Check storage quota (Settings → Account → storage used)\n\n**Common OneDrive Sync Errors:**\n• **0x8007016A / 0x80070194** — Pause/resume sync, restart OneDrive\n• **Red X icon** — Right-click the file for specific error\n• **Sync pending** — Large files may take time; ensure internet is stable\n\n**SharePoint Access Denied:**\n• Contact the site owner or your manager for access\n• IT can provision access via your helpdesk ticket\n• Check you are logged in with the correct account\n\n**Sharing Files:**\n1. Right-click file → "Share" (OneDrive) or use the Share button (SharePoint)\n2. Enter email address and set permissions (view / edit)\n3. Click Send\n\n**Sync a SharePoint Library to OneDrive:**\nOpen SharePoint site → Click "Sync" button → Open in OneDrive`,
    followUp: ['File access issues', 'Teams file sharing', 'Create a ticket']
  },
  {
    id: 'outlook-calendar',
    category: 'email',
    keywords: ['calendar', 'meeting', 'invite', 'appointment', 'schedule', 'teams meeting', 'room booking', 'outlook calendar'],
    patterns: ['calendar not loading', 'meeting invite not received', 'cant schedule meeting', 'room not available', 'meeting declined automatically', 'calendar sync issue', 'missing meeting', 'out of office not working', 'delegate calendar access', 'free busy not showing'],
    answer: `**Outlook Calendar & Meeting Help:**\n\n**Meeting Invite Not Received:**\n• Ask the organizer to resend the invite\n• Check your Junk/Spam folder\n• Verify the organizer has your correct email address\n• Check Calendar → View → Pending invites\n\n**Calendar Not Loading / Syncing:**\n1. Restart Outlook\n2. File → Account Settings → Repair your account\n3. Remove and re-add the calendar if shared\n\n**Book a Meeting Room:**\n1. New Meeting → Scheduling Assistant → Add Rooms\n2. Type the room name and check availability\n3. Or: Calendar → Open Calendar → Rooms\n\n**Out of Office (Automatic Replies):**\nFile → Automatic Replies → Set date range and message\n\n**Delegate Calendar Access:**\nFile → Account Settings → Delegate Access → Add person → Select permissions\n\n**Teams Meeting Link Missing:**\n• New Meeting → Teams Meeting toggle ON\n• If missing: Check Calendar → Options → Add Online Meeting\n\n**Free/Busy Not Showing:**\n• May indicate a permissions or directory sync issue — create a ticket for IT to investigate`,
    followUp: ['Email issues', 'Teams problems', 'Create a ticket']
  },
  {
    id: 'active-directory',
    category: 'account',
    keywords: ['active directory', 'domain', 'ad', 'group policy', 'domain join', 'domain account', 'ldap', 'domain controller', 'gpo', 'profile', 'roaming profile'],
    patterns: ['domain join failed', 'cannot join domain', 'group policy not applying', 'active directory account', 'domain user not found', 'computer not on domain', 'domain trust failed', 'user profile corrupt', 'roaming profile error', 'ad password expired', 'sync active directory'],
    answer: `**Active Directory & Domain Issues:**\n\n**Cannot Join Domain:**\n• Ensure the computer is connected to the corporate network (LAN or VPN)\n• Verify DNS is set to the domain controller IP\n• Try with admin credentials: System → Rename this PC (advanced) → Change → Domain\n• Contact IT to verify the computer account exists in AD\n\n**Domain Login Failure:**\n• Try: DOMAIN\\username format\n• Try your email address as the username\n• If "The security database on the server does not have a computer account" → IT needs to re-add the machine to the domain\n\n**Group Policy Not Applying:**\n1. Run as admin: \`gpupdate /force\`\n2. Check with: \`gpresult /r\` (shows applied policies)\n3. If policies still not applying: Rejoin domain or contact IT\n\n**Corrupt User Profile:**\n1. Log in with a different admin account\n2. Delete the profile from: Control Panel → System → Advanced → User Profiles\n3. Restart and log back in (new profile will be created)\n\n**AD Password Expiry:**\n• Press Ctrl+Alt+Delete → Change Password\n• Or change via https://myaccount.microsoft.com (for M365)\n• Contact IT if the self-service option is unavailable`,
    followUp: ['Password reset', 'Login issues', 'Create a ticket']
  },
  {
    id: 'browser-issues',
    category: 'software',
    keywords: ['browser', 'chrome', 'edge', 'firefox', 'internet explorer', 'ie', 'websites not loading', 'extension', 'ssl', 'certificate error', 'cookies', 'cache'],
    patterns: ['website not loading', 'browser keeps crashing', 'browser not working', 'ssl certificate error', 'site cant be reached', 'browser extension problem', 'cannot access website', 'chrome crashing', 'edge not loading', 'firefox issue', 'browser slow', 'certificate warning', 'connection not private'],
    answer: `**Browser Troubleshooting:**\n\n**Website Not Loading / "Site can't be reached":**\n1. Try a different browser to isolate the issue\n2. Clear cache: Ctrl+Shift+Delete → All time → Cache + Cookies → Clear\n3. Disable browser extensions (Settings → Extensions → Disable all → retry)\n4. Check internet connectivity (try another website)\n5. Try Incognito/Private mode (Ctrl+Shift+N)\n\n**SSL / Certificate Error ("Your connection is not private"):**\n• Check your PC's date and time are correct (Settings → Time)\n• Clear SSL state: Control Panel → Internet Options → Content → Clear SSL State\n• For internal company sites: IT may need to install the root certificate\n\n**Browser Keeps Crashing:**\n1. Update the browser to the latest version\n2. Disable all extensions and test\n3. Reset browser settings: Settings → Reset settings → Restore defaults\n4. Uninstall and reinstall the browser\n\n**Company Website / Intranet Issues:**\n• The site may require Internet Explorer compatibility\n• In Edge: Settings → Default browser → Add site to IE mode\n• Contact IT for specific internal application browser requirements\n\n**Recommended Browsers:** Microsoft Edge (enterprise supported) or Google Chrome`,
    followUp: ['Clear cache steps', 'Network issues', 'Create a ticket']
  },
  {
    id: 'microsoft365-activation',
    category: 'software',
    keywords: ['microsoft 365', 'office 365', 'office activation', 'word', 'excel', 'powerpoint', 'unlicensed product', 'product activation failed', 'office license', 'm365', 'office sign in'],
    patterns: ['microsoft office not activated', 'office says unlicensed', 'office activation failed', 'product deactivated', 'office keeps asking to sign in', 'word not opening', 'excel license error', 'office 365 license expired', 'how to activate office', 'microsoft 365 sign in problem', 'office subscription expired'],
    answer: `**Microsoft 365 / Office Activation Help:**\n\n**"Unlicensed Product" or Activation Error:**\n1. Open any Office app → File → Account → Sign In\n2. Sign in with your **work email** (not personal)\n3. If already signed in: Sign out → Sign back in\n4. Check subscription status: Account → Product Information → Manage Account\n\n**Activation Failed After Reinstall:**\n1. Run Office as Administrator once\n2. Open: File → Account → Activate Product\n3. Enter your corporate email and password\n\n**Office Keeps Asking to Sign In:**\n1. Windows Credential Manager → Remove all Microsoft/Office entries\n2. Reopen Office and sign in fresh\n3. Enable "Keep me signed in"\n\n**Deactivate Extra Devices (at device limit):**\n1. Go to https://myaccount.microsoft.com\n2. Devices → Office Apps → Sign out from old devices\n\n**If Problem Persists:**\n• IT Admin can reassign the license\n• Contact IT with your employee ID and device name\n• We can also run the Microsoft Support and Recovery Assistant (SaRA) tool remotely`,
    followUp: ['Software issues', 'Email not working', 'Create a ticket']
  },
  {
    id: 'new-employee-it',
    category: 'helpdesk',
    keywords: ['new employee', 'new user', 'onboarding', 'first day', 'new hire', 'new staff', 'setup account', 'new joiner', 'it setup'],
    patterns: ['new employee setup', 'new hire it setup', 'onboarding it', 'new staff account', 'first day it', 'new joiner setup', 'account not ready', 'setup my work computer', 'what do i need for first day', 'new employee checklist'],
    answer: `**New Employee IT Setup:**\n\nWelcome! Here's what IT typically sets up for new employees:\n\n**Day 1 Checklist:**\n✅ Domain/Active Directory account\n✅ Work email address\n✅ Laptop / desktop provisioned\n✅ Microsoft 365 license assigned\n✅ VPN access (if applicable)\n✅ MFA enrolled\n✅ Required software installed\n\n**First Login Steps:**\n1. Log in with the temporary password from IT\n2. Change your password immediately (Ctrl+Alt+Delete → Change password)\n3. Set up MFA (check your email for the setup link)\n4. Set up Outlook with your work email\n5. Install required software from [Software Center / Company Portal]\n\n**If Your Account Isn't Ready:**\n• Contact your manager to confirm IT was notified of your start date\n• Create a helpdesk ticket with your employee ID, start department, and required access\n• IT will prioritise new joiners\n\n**Need Access to Specific Systems?**\nCreate a ticket with the system name and your manager's approval`,
    followUp: ['Account setup', 'Password reset', 'Software installation', 'Create a ticket']
  }
];

// Build inverse document frequency weights
const _allDocs = KNOWLEDGE_BASE.length;
const _termDocCount = {};
KNOWLEDGE_BASE.forEach(entry => {
  const allTerms = new Set([...entry.keywords, ...entry.patterns.flatMap(p => p.split(/\s+/))]);
  allTerms.forEach(t => { _termDocCount[t] = (_termDocCount[t] || 0) + 1; });
});

/**
 * ─── LEVENSHTEIN DISTANCE ───
 * For fuzzy matching / typo tolerance.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * ─── TOKENIZER ───
 * Normalize, expand synonyms, remove stop words.
 */
function tokenize(text) {
  const raw = text.toLowerCase().replace(/[^a-z0-9\s\-\/\.]/g, ' ').split(/\s+/).filter(Boolean);
  const expanded = [];
  for (const word of raw) {
    if (STOP_WORDS.has(word)) continue;
    const syn = SYNONYMS[word];
    expanded.push(syn || word);
  }
  return expanded;
}

/**
 * ─── TF-IDF SCORER ───
 * Term Frequency × Inverse Document Frequency.
 */
function tfidfScore(queryTokens, docTokens) {
  let score = 0;
  const docTermFreq = {};
  docTokens.forEach(t => { docTermFreq[t] = (docTermFreq[t] || 0) + 1; });

  for (const qt of queryTokens) {
    // Exact match
    if (docTermFreq[qt]) {
      const tf = docTermFreq[qt] / docTokens.length;
      const idf = Math.log(_allDocs / (_termDocCount[qt] || 1));
      score += tf * idf * 3; // weighted boost
    }
    // Fuzzy match (Levenshtein ≤ 2)
    for (const dt of Object.keys(docTermFreq)) {
      if (dt !== qt && dt.length > 3 && qt.length > 3) {
        const dist = levenshtein(qt, dt);
        if (dist <= 2) {
          const tf = docTermFreq[dt] / docTokens.length;
          const idf = Math.log(_allDocs / (_termDocCount[dt] || 1));
          const fuzz = 1 - dist / Math.max(qt.length, dt.length);
          score += tf * idf * fuzz * 1.5;
        }
      }
    }
  }
  return score;
}

/**
 * ─── PATTERN MATCH SCORER ───
 * Checks how well the query matches predefined intent patterns.
 */
function patternScore(query, patterns) {
  const lower = query.toLowerCase();
  let best = 0;
  for (const pattern of patterns) {
    // Exact pattern match
    if (lower === pattern) return 10;
    // Contains full pattern
    if (lower.includes(pattern)) {
      const s = (pattern.length / lower.length) * 6 + 2;
      if (s > best) best = s;
    }
    // Pattern contains query
    if (pattern.includes(lower) && lower.length > 3) {
      const s = (lower.length / pattern.length) * 4 + 1;
      if (s > best) best = s;
    }
    // Word overlap
    const pWords = pattern.split(/\s+/);
    const qWords = lower.split(/\s+/).filter(w => !STOP_WORDS.has(w));
    if (qWords.length > 0) {
      const overlap = pWords.filter(pw => qWords.some(qw => pw.includes(qw) || qw.includes(pw))).length;
      const s = (overlap / pWords.length) * 4;
      if (s > best) best = s;
    }
  }
  return best;
}

/**
 * ─── ENTITY EXTRACTION ───
 * Identifies specific technical entities in the query.
 */
function extractEntities(text) {
  const entities = [];
  const lower = text.toLowerCase();

  // Error codes (Windows)
  const errMatch = lower.match(/0x[0-9a-f]+|error\s*(?:code\s*)?(\d{3,})/i);
  if (errMatch) entities.push({ type: 'error_code', value: errMatch[0] });

  // HTTP status codes
  const httpMatch = lower.match(/\b(4[0-9]{2}|5[0-9]{2})\b/);
  if (httpMatch) entities.push({ type: 'http_status', value: httpMatch[1] });

  // Software names
  const softwareList = ['outlook', 'teams', 'zoom', 'excel', 'word', 'powerpoint', 'chrome', 'firefox', 'edge', 'onedrive', 'sharepoint', 'skype', 'slack', 'adobe', 'photoshop', 'autocad', 'visual studio', 'vscode', 'notepad', 'git', 'python', 'java', 'node'];
  for (const sw of softwareList) {
    if (lower.includes(sw)) entities.push({ type: 'software', value: sw });
  }

  // OS names
  if (lower.match(/windows\s*(10|11|7|8|server)/i)) {
    entities.push({ type: 'os', value: lower.match(/windows\s*(10|11|7|8|server)/i)[0] });
  }

  return entities;
}

/**
 * ─── MAIN QUERY PROCESSOR ───
 * Combines TF-IDF, pattern matching, entity extraction, and context.
 */
function processQuery(query, context = []) {
  if (!query || query.trim().length === 0) {
    return {
      answer: "Please type a question and I'll do my best to help you with any IT-related issue!",
      confidence: 0,
      category: 'general',
      followUp: ['Password reset', 'Computer is slow', 'Network issues', 'Create a ticket'],
      entities: [],
      matchedTopic: null
    };
  }

  const queryClean = query.trim();
  const queryTokens = tokenize(queryClean);
  const entities = extractEntities(queryClean);

  // If tokenizer removed all words (query was only stop words like "what you can do"),
  // fall back to full-text pattern matching only — skip TF-IDF entirely
  if (queryTokens.length === 0) {
    const lowerQuery = queryClean.toLowerCase();
    const patternOnly = KNOWLEDGE_BASE.map(entry => {
      const pScore = patternScore(lowerQuery, entry.patterns);
      return { entry, totalScore: pScore };
    }).filter(s => s.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore);

    if (patternOnly.length > 0 && patternOnly[0].totalScore >= 1) {
      const best = patternOnly[0];
      return {
        answer: best.entry.answer,
        confidence: Math.min(best.totalScore / 10, 0.85),
        category: best.entry.category,
        followUp: best.entry.followUp || [],
        entities,
        matchedTopic: { id: best.entry.id, category: best.entry.category }
      };
    }

    return {
      answer: "I'd love to help! Could you describe what you need assistance with? I can help with:\n\n" +
        "🔑 Password & account issues\n🖥️ Computer performance\n🌐 Network & WiFi\n🖨️ Printer problems\n" +
        "📧 Email / Outlook\n💿 Software help\n🛡️ Security & data protection\n🎫 Ticket management\n\n" +
        "Just describe your issue in plain words!",
      confidence: 0.2,
      category: 'general',
      followUp: ['Password reset', 'Computer is slow', 'Network issues', 'Create a ticket'],
      entities,
      matchedTopic: null
    };
  }

  // Score each knowledge base entry
  const scored = KNOWLEDGE_BASE.map(entry => {
    const kwTokens = tokenize(entry.keywords.join(' '));
    const patTokens = tokenize(entry.patterns.join(' '));
    const allDocTokens = [...kwTokens, ...patTokens];

    // TF-IDF score
    const tfidf = tfidfScore(queryTokens, allDocTokens);

    // Pattern match score
    const pattern = patternScore(queryClean, entry.patterns);

    // Keyword direct match bonus
    let kwBonus = 0;
    for (const qt of queryTokens) {
      if (entry.keywords.includes(qt)) kwBonus += 2;
      // Check synonyms
      for (const kw of entry.keywords) {
        if (SYNONYMS[qt] === kw || SYNONYMS[kw] === qt) kwBonus += 1.5;
      }
    }

    // Entity match bonus
    let entityBonus = 0;
    for (const entity of entities) {
      if (entity.type === 'software') {
        const entTokens = tokenize(entry.patterns.join(' ') + ' ' + entry.keywords.join(' '));
        if (entTokens.includes(entity.value)) entityBonus += 3;
      }
    }

    // Context bonus (previous conversation topic)
    let contextBonus = 0;
    if (context.length > 0) {
      const lastCtx = context[context.length - 1];
      if (lastCtx && lastCtx.category === entry.category) contextBonus += 1;
      // If they say "yes" / "more" / "explain" → give slight boost to last topic
      if (['yes', 'more', 'explain', 'details', 'elaborate', 'tell me more'].some(w => queryClean.toLowerCase().includes(w))) {
        if (lastCtx && lastCtx.id === entry.id) contextBonus += 5;
      }
    }

    const totalScore = tfidf + pattern + kwBonus + entityBonus + contextBonus;
    return { entry, totalScore, tfidf, pattern, kwBonus };
  });

  // Sort by score
  scored.sort((a, b) => b.totalScore - a.totalScore);

  const best = scored[0];
  const secondBest = scored[1];

  // Confidence calculation (0-1)
  const maxPossible = 20; // rough max score
  let confidence = Math.min(best.totalScore / maxPossible, 1);

  // If top two are very close, lower confidence
  if (secondBest && best.totalScore > 0 && (secondBest.totalScore / best.totalScore) > 0.85) {
    confidence *= 0.8;
  }

  // Minimum threshold
  if (best.totalScore < 1.5) {
    // Not confident enough — provide a helpful, empathetic fallback
    const topSuggestions = scored.slice(0, 3).filter(s => s.totalScore > 0.5).map(s => s.entry);
    let fallbackText = `Hmm, I'm not sure I have a specific guide for that — but I'm happy to help!\n\n`;

    if (entities.length > 0) {
      fallbackText += `I noticed you mentioned **${entities.map(e => e.value).join(', ')}** — let me point you in the right direction.\n\n`;
    }

    if (topSuggestions.length > 0) {
      fallbackText += `These topics might be what you're looking for:\n`;
      topSuggestions.forEach(s => { fallbackText += `• **${s.patterns?.[0] || s.id || 'Help'}**\n`; });
      fallbackText += `\nTap one of the suggestions, or rephrase your question and I'll do my best!\n`;
    } else {
      fallbackText += `Here's what I can help with:\n\n`;
      fallbackText += `🔑 Password & account issues\n🖥️ Computer performance\n🌐 Network & WiFi\n🖨️ Printer problems\n📧 Email / Outlook\n💿 Software help\n🛡️ Security & data protection\n\n`;
      fallbackText += `Try describing your issue in plain words, or **create a support ticket** to get personal help from the IT team.`;
    }

    return {
      answer: fallbackText,
      confidence: Math.max(confidence, 0.1),
      category: 'unknown',
      followUp: topSuggestions.length > 0
        ? topSuggestions.map(s => (s.patterns?.[0] || 'Help').split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '))
        : ['Password reset', 'Computer is slow', 'Network issues', 'Create a ticket'],
      entities,
      matchedTopic: null
    };
  }

  return {
    answer: best.entry.answer,
    confidence: parseFloat(confidence.toFixed(2)),
    category: best.entry.category,
    followUp: best.entry.followUp || [],
    entities,
    matchedTopic: { id: best.entry.id, category: best.entry.category }
  };
}

/**
 * ─── SESSION CONTEXT MANAGER ───
 * Keeps track of conversation for follow-up context.
 */
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session && Date.now() - session.lastActive < SESSION_TTL) {
    session.lastActive = Date.now();
    return session;
  }
  const newSession = { context: [], lastActive: Date.now() };
  sessions.set(sessionId, newSession);
  return newSession;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_TTL) sessions.delete(id);
  }
}

// Cleanup every 10 minutes
setInterval(cleanupSessions, 10 * 60 * 1000);

/**
 * ─── RESOLVE SECURITY PLACEHOLDERS ───
 * Replaces {{key}} placeholders in AI answers with live DB values.
 */
async function resolveSecurityPlaceholders(text) {
  if (!text || !text.includes('{{')) return text;
  try {
    const sec = await settingsService.getByCategory('security');
    const defaults = {
      password_min_length: '8',
      password_history_count: '5',
      lockout_attempts: '5',
      lockout_duration_minutes: '30',
      password_reset_token_expiry_hours: '1',
      session_timeout_minutes: '30',
      otp_expiry_minutes: '5',
      resend_otp_cooldown_seconds: '60'
    };
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => sec[key] || defaults[key] || key);
  } catch {
    // Fallback: strip placeholders with best-effort defaults
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => key);
  }
}

/**
 * ─── EXPORTED PROCESSOR ───
 */
async function handleChat(sessionId, message) {
  const session = getSession(sessionId);
  const result = processQuery(message, session.context);

  // Resolve any security placeholders in the answer
  result.answer = await resolveSecurityPlaceholders(result.answer);

  // Add to context for follow-up
  if (result.matchedTopic) {
    session.context.push(result.matchedTopic);
    // Keep context window small
    if (session.context.length > 5) session.context.shift();
  }

  return result;
}

module.exports = {
  handleChat,
  processQuery,
  resolveSecurityPlaceholders,
  tokenize,
  extractEntities,
  KNOWLEDGE_BASE
};
