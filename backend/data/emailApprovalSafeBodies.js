/**
 * Approval workflow email bodies — no emoji (email clients often show ? instead).
 * Used by migration runner to UPDATE existing DB templates.
 */

const TICKET_APPROVAL_REQUESTED = {
  subject: 'Approval Required: Ticket #{{ticket_number}} — {{subject}}',
  body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#f59e0b,#b45309);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">Approval Required</h1>
    <p style="color:#fef3c7;margin:6px 0 0;font-size:14px">{{system_name}}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Dear {{approver_name}},</p>
    <p style="color:#374151;font-size:15px">An engineer has raised an approval request for a ticket and has selected you as the approver. The SLA timer is <strong>paused</strong> until you take action.</p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px">Ticket Number:</td><td style="padding:6px 0;font-weight:700;color:#111827">#{{ticket_number}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Subject:</td><td style="padding:6px 0;color:#111827">{{subject}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Priority:</td><td style="padding:6px 0;color:#111827">{{priority}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Department:</td><td style="padding:6px 0;color:#111827">{{department}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Requested by:</td><td style="padding:6px 0;color:#111827">{{engineer_name}} (Engineer)</td></tr>
      </table>
    </div>
    <div style="background:#f9fafb;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#92400e">Reason for Approval:</p>
      <p style="margin:0;color:#374151;white-space:pre-wrap">{{approval_note}}</p>
    </div>
    <p style="color:#6b7280;font-size:14px"><strong style="color:#b45309">Note:</strong> The SLA clock for this ticket is <strong>paused</strong> until you approve or reject this request.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto">
      <tr>
        <td style="padding:6px">
          <a href="{{approval_email_url_approve}}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Approve</a>
        </td>
        <td style="padding:6px">
          <a href="{{approval_email_url_reject}}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Reject</a>
        </td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0 0 16px">Web: opens a secure page to confirm (recommended; avoids mail scanners mis-clicking).</p>
    {{approval_reply_by_email_html}}
    <div style="text-align:center;margin:12px 0">
      <a href="{{ticket_url}}" style="color:#b45309;font-weight:600;font-size:14px">Or open the ticket in {{system_name}}</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">
      You received this because you were selected as the approver for this ticket.<br>
      This is an automated notification from {{system_name}}.
    </p>
  </div>
</div>`,
};

const TICKET_APPROVAL_APPROVED = {
  subject: 'Approved: Ticket #{{ticket_number}} — {{subject}}',
  body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#059669,#065f46);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">Approval Granted</h1>
    <p style="color:#d1fae5;margin:6px 0 0;font-size:14px">{{system_name}}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Dear {{recipient_name}},</p>
    <p style="color:#374151;font-size:15px">The approval request for ticket <strong>#{{ticket_number}}</strong> has been <strong style="color:#059669">APPROVED</strong> by {{approver_name}}. The SLA timer has been resumed.</p>
    <div style="background:#f0fdf4;border:1px solid #6ee7b7;border-radius:8px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px">Ticket Number:</td><td style="padding:6px 0;font-weight:700;color:#111827">#{{ticket_number}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Subject:</td><td style="padding:6px 0;color:#111827">{{subject}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Approved by:</td><td style="padding:6px 0;color:#059669;font-weight:600">{{approver_name}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Approved at:</td><td style="padding:6px 0;color:#111827">{{decided_at}}</td></tr>
      </table>
    </div>
    <div style="background:#f9fafb;border-left:4px solid #059669;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#065f46">Approver Note:</p>
      <p style="margin:0;color:#374151;white-space:pre-wrap">{{decision_note}}</p>
    </div>
    <div style="text-align:center;margin:28px 0">
      <a href="{{ticket_url}}" style="background:#059669;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">View Ticket</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">This is an automated notification from {{system_name}}.</p>
  </div>
</div>`,
};

const TICKET_APPROVAL_REJECTED = {
  subject: 'Rejected: Ticket #{{ticket_number}} — {{subject}}',
  body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">Approval Rejected</h1>
    <p style="color:#fecaca;margin:6px 0 0;font-size:14px">{{system_name}}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Dear {{engineer_name}},</p>
    <p style="color:#374151;font-size:15px">Your approval request for ticket <strong>#{{ticket_number}}</strong> has been <strong style="color:#dc2626">REJECTED</strong> by {{approver_name}}. The SLA timer has been resumed.</p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px">Ticket Number:</td><td style="padding:6px 0;font-weight:700;color:#111827">#{{ticket_number}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Subject:</td><td style="padding:6px 0;color:#111827">{{subject}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Rejected by:</td><td style="padding:6px 0;color:#dc2626;font-weight:600">{{approver_name}}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Rejected at:</td><td style="padding:6px 0;color:#111827">{{decided_at}}</td></tr>
      </table>
    </div>
    <div style="background:#f9fafb;border-left:4px solid #dc2626;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b">Rejection Reason from Approver:</p>
      <p style="margin:0;color:#374151;white-space:pre-wrap">{{decision_note}}</p>
    </div>
    <p style="color:#374151;font-size:14px">Please review the rejection note and take appropriate action on the ticket.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="{{ticket_url}}" style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">View Ticket</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">This is an automated notification from {{system_name}}.</p>
  </div>
</div>`,
};

module.exports = {
  TICKET_APPROVAL_REQUESTED,
  TICKET_APPROVAL_APPROVED,
  TICKET_APPROVAL_REJECTED,
};
