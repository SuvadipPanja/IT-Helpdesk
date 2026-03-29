// ============================================================
// TICKET FORM SCHEMAS
// Per-category guidance: hints, subject templates, tips
// Keyed by category_code from /api/v1/system/categories
// ============================================================

const TEMPLATE_FALLBACK_LABELS = {
  requester_name: 'Requester Name',
  username: 'Username',
  location_name: 'Location',
  department_name: 'Department',
  process_name: 'Process',
  client_name: 'Client',
  printer_name: 'Printer',
  device_type: 'Device',
  app_name: 'Application',
  software_name: 'Software',
  system_name: 'System',
  resource_name: 'Resource',
  topic_name: 'Topic',
  feature_name: 'Feature',
  application_name: 'Application',
  task_name: 'Task',
  drive_path: 'Shared Drive',
  recipient_address: 'Recipient',
  sender_domain: 'Sender Domain',
  new_employee_name: 'New Employee',
  asset_tag: 'Asset Tag',
};

export const TICKET_FORM_SCHEMAS = {
  HARDWARE: {
    icon: '🖥️',
    hints: [
      'Please have your device\'s asset tag number ready (usually a sticker on the device).',
      'Note the exact error message or describe what the device is doing.',
      'Indicate if this is affecting work urgently or can wait.',
    ],
    subjectTemplates: [
      { id: 'hardware-computer-power', label: 'Computer not turning on', template: 'Computer not turning on - {{requester_name}}/{{location_name}}' },
      { id: 'hardware-printer', label: 'Printer not printing', template: 'Printer not printing - {{printer_name}}/{{location_name}}' },
      { id: 'hardware-monitor', label: 'Monitor display issue', template: 'Monitor display issue - {{location_name}}' },
      { id: 'hardware-peripherals', label: 'Keyboard/mouse not working', template: 'Keyboard/mouse not working - {{location_name}}' },
      { id: 'hardware-upgrade', label: 'Hardware upgrade request', template: 'Hardware upgrade request - {{device_type}}' },
    ],
    checklist: [
      'Have you tried restarting the device?',
      'Have you checked all cable connections?',
      'Is the issue limited to this one device?',
    ],
  },

  SOFTWARE: {
    icon: '💻',
    hints: [
      'Note the exact error message shown on screen.',
      'Include the software name and version if known.',
      'Describe what steps you were taking when the error occurred.',
    ],
    subjectTemplates: [
      { id: 'software-crash', label: 'Application crashing', template: 'Application crashing - {{app_name}}' },
      { id: 'software-install', label: 'Cannot install software', template: 'Cannot install software - {{software_name}}' },
      { id: 'software-license', label: 'Software license issue', template: 'Software license issue - {{software_name}}' },
      { id: 'software-slow', label: 'Application running slowly', template: 'Application running slowly - {{app_name}}' },
      { id: 'software-open', label: 'Software not opening', template: 'Software not opening - {{app_name}}' },
    ],
    checklist: [
      'Have you tried restarting the application?',
      'Have you tried restarting your computer?',
      'Is anyone else in your team affected?',
    ],
  },

  NETWORK: {
    icon: '🌐',
    hints: [
      'Specify your location (building, floor, room number).',
      'Indicate if you are using wired or wireless network.',
      'Note if the issue started after any recent changes.',
    ],
    subjectTemplates: [
      { id: 'network-internet', label: 'No internet', template: 'No internet - {{location_name}}' },
      { id: 'network-wifi', label: 'WiFi connection dropping', template: 'WiFi connection dropping - {{location_name}}' },
      { id: 'network-vpn', label: 'VPN not connecting', template: 'VPN not connecting - {{requester_name}}' },
      { id: 'network-slow', label: 'Slow network speed', template: 'Slow network speed - {{location_name}}' },
      { id: 'network-drive', label: 'Cannot access shared drive', template: 'Cannot access shared drive - {{drive_path}}' },
    ],
    checklist: [
      'Can you access any websites at all?',
      'Are other devices on the same network affected?',
      'Have you tried disconnecting and reconnecting?',
    ],
  },

  ACCESS: {
    icon: '🔑',
    hints: [
      'For password resets, ensure you are near your registered device.',
      'Account lockouts are automatically cleared after 30 minutes.',
      'For new access requests, manager approval may be required.',
    ],
    subjectTemplates: [
      { id: 'access-password-reset', label: 'Password reset request', template: 'Password reset request - {{username}}' },
      { id: 'access-lockout', label: 'Account locked out', template: 'Account locked out - {{username}}/{{system_name}}' },
      { id: 'access-new-system', label: 'New system access request', template: 'New system access request - {{system_name}}' },
      { id: 'access-permission', label: 'Access permission issue', template: 'Access permission issue - {{resource_name}}' },
      { id: 'access-remove-user', label: 'Remove access for departed employee', template: 'Remove access for departed employee - {{username}}' },
    ],
    checklist: [
      'Are you using the correct username format?',
      'Is Caps Lock turned off?',
      'Have you waited 30 minutes after an account lockout?',
    ],
  },

  NEW_REQUEST: {
    icon: '📦',
    hints: [
      'New hardware/software requests require manager approval.',
      'Include justification for the request to speed up approval.',
      'Standard requests are fulfilled within 48 hours after approval.',
    ],
    subjectTemplates: [
      { id: 'request-laptop', label: 'New laptop request', template: 'New laptop request - {{requester_name}}/{{department_name}}' },
      { id: 'request-license', label: 'Software license request', template: 'Software license request - {{software_name}}' },
      { id: 'request-peripheral', label: 'New peripheral request', template: 'New peripheral request - {{device_type}}' },
      { id: 'request-user-setup', label: 'New user account setup', template: 'New user account setup - {{new_employee_name}}' },
      { id: 'request-mobile', label: 'Mobile device request', template: 'Mobile device request - {{requester_name}}' },
    ],
    checklist: [
      'Has your manager approved this request?',
      'Is there a business justification for the request?',
      'What is the required by date?',
    ],
  },

  EMAIL: {
    icon: '📧',
    hints: [
      'Note whether the issue affects sending, receiving, or both.',
      'Include example sender/recipient email addresses if relevant.',
      'For Outlook issues, note if the issue occurs in webmail too.',
    ],
    subjectTemplates: [
      { id: 'email-send-receive', label: 'Cannot send/receive emails', template: 'Cannot send/receive emails - {{requester_name}}' },
      { id: 'email-spam', label: 'Emails going to spam/junk', template: 'Emails going to spam/junk - {{sender_domain}}' },
      { id: 'email-delivery', label: 'Email not delivered to recipient', template: 'Email not delivered to recipient - {{recipient_address}}' },
      { id: 'email-outlook', label: 'Outlook not opening or crashing', template: 'Outlook not opening or crashing - {{requester_name}}' },
      { id: 'email-signature', label: 'Email signature issue', template: 'Email signature issue - {{requester_name}}' },
    ],
    checklist: [
      'Does the issue occur in webmail (OWA) as well?',
      'Are specific senders or all senders affected?',
      'When did the issue first start?',
    ],
  },

  SECURITY: {
    icon: '🔒',
    hints: [
      'Security incidents are HIGH priority — expect a response within 2 hours.',
      'Do not delete suspicious emails — forward them to IT first.',
      'If you suspect a data breach, stop using the affected system immediately.',
    ],
    subjectTemplates: [
      { id: 'security-phishing', label: 'Suspicious email received', template: 'Suspicious email received - possible phishing - {{requester_name}}' },
      { id: 'security-malware', label: 'Possible malware / virus detected', template: 'Possible malware / virus detected - {{device_type}}' },
      { id: 'security-access', label: 'Unauthorized access attempt detected', template: 'Unauthorized access attempt detected - {{system_name}}' },
      { id: 'security-breach', label: 'Data breach / leak concern', template: 'Data breach / leak concern - {{location_name}}' },
      { id: 'security-device', label: 'Suspicious device found on premises', template: 'Suspicious device found on premises - {{location_name}}' },
    ],
    checklist: [
      'Have you stopped using the affected system?',
      'Have you noted the time and nature of the incident?',
      'Have you informed your manager?',
    ],
    urgent: true,
  },

  PERFORMANCE: {
    icon: '⚡',
    hints: [
      'Note which specific applications or processes are slow.',
      'Indicate when the slowness started and if it\'s intermittent.',
      'Check if other users in your area are also experiencing slowness.',
    ],
    subjectTemplates: [
      { id: 'performance-device', label: 'Computer running very slowly', template: 'Computer running very slowly - {{requester_name}}' },
      { id: 'performance-app', label: 'Slow application', template: 'Slow application - {{app_name}}' },
      { id: 'performance-freezing', label: 'System freezing/hanging', template: 'System freezing/hanging - {{task_name}}' },
      { id: 'performance-high-usage', label: 'High CPU or memory usage', template: 'High CPU or memory usage - {{device_type}}' },
      { id: 'performance-startup', label: 'Slow startup / boot time', template: 'Slow startup / boot time - {{device_type}}' },
    ],
    checklist: [
      'Are specific applications affected or the entire system?',
      'Did the issue start after any updates or changes?',
      'Is the disk nearly full? (Check Storage in Settings)',
    ],
  },

  TRAINING: {
    icon: '📚',
    hints: [
      'Training requests are processed within 1 week.',
      'Group training sessions can be arranged for teams of 3 or more.',
      'Include the specific topics or features you need help with.',
    ],
    subjectTemplates: [
      { id: 'training-software', label: 'Training request', template: 'Training request - {{software_name}}' },
      { id: 'training-group', label: 'Group training session', template: 'Group training session - {{topic_name}}' },
      { id: 'training-howto', label: 'How to use', template: 'How to use - {{feature_name}}' },
      { id: 'training-onboarding', label: 'Onboarding training for new team member', template: 'Onboarding training for new team member - {{new_employee_name}}' },
    ],
    checklist: [
      'Is this for an individual or a team?',
      'What is your current experience level with this software?',
      'Do you have a preferred date/time for the training?',
    ],
  },

  OTHER: {
    icon: '📋',
    hints: [
      'Please describe your issue in as much detail as possible.',
      'If possible, categorize your issue — it helps the right team respond faster.',
      'Include any error messages, screenshots, or relevant details.',
    ],
    subjectTemplates: [
      { id: 'other-general', label: 'General IT request', template: 'General IT request - {{topic_name}}' },
      { id: 'other-query', label: 'IT query', template: 'IT query - {{topic_name}}' },
    ],
    checklist: [],
  },
};

const TEMPLATE_VAR_REGEX = /{{\s*([a-z0-9_]+)\s*}}/gi;

export function getTemplateFallbackLabel(variableName) {
  return TEMPLATE_FALLBACK_LABELS[variableName] || variableName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getResolvedTemplateVariables(template, context = {}) {
  const resolved = {};
  const source = String(template || '');
  let match;
  while ((match = TEMPLATE_VAR_REGEX.exec(source)) !== null) {
    const variableName = String(match[1] || '').trim();
    if (!variableName || resolved[variableName]) continue;
    const value = context[variableName];
    resolved[variableName] = value !== undefined && value !== null && String(value).trim()
      ? String(value).trim()
      : getTemplateFallbackLabel(variableName);
  }
  TEMPLATE_VAR_REGEX.lastIndex = 0;
  return resolved;
}

export function resolveGuidanceTemplate(template, context = {}) {
  const resolvedVariables = getResolvedTemplateVariables(template, context);
  return String(template || '')
    .replace(TEMPLATE_VAR_REGEX, (_, variableName) => resolvedVariables[String(variableName || '').trim()] || getTemplateFallbackLabel(String(variableName || '').trim()))
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

/**
 * Get schema for a category. Falls back to OTHER.
 */
export function getCategorySchema(categoryCode) {
  return TICKET_FORM_SCHEMAS[categoryCode] || TICKET_FORM_SCHEMAS.OTHER;
}
