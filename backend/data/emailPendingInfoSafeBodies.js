/**
 * Pending-info request / provided — no emoji in HTML (email client safe).
 */

const TICKET_PENDING_INFO = {
  subject: 'Action Required: More Details Needed for Ticket #{{ticket_number}}',
  body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">More Details Required</h1>
    <p style="color:#ede9fe;margin:6px 0 0;font-size:14px">{{system_name}}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Dear {{requester_name}},</p>
    <p style="color:#374151;font-size:15px">The engineer working on your ticket requires additional information before they can proceed.</p>
    <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#5b21b6">Ticket: #{{ticket_number}} — {{subject}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Assigned Engineer: {{engineer_name}}</p>
      <p style="margin:8px 0 4px;font-weight:600;color:#374151">What is needed:</p>
      <p style="margin:0;color:#374151;white-space:pre-wrap">{{request_note}}</p>
    </div>
    <p style="color:#374151;font-size:14px"><strong style="color:#5b21b6">Note:</strong> <strong>SLA is paused</strong> for this ticket until you provide the requested details. Providing the information promptly will help resolve your issue faster.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="{{ticket_url}}" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Provide Details Now</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">This is an automated notification from {{system_name}}.</p>
  </div>
</div>`,
};

const TICKET_INFO_PROVIDED = {
  subject: 'Details Provided for Ticket #{{ticket_number}} — Action Required',
  body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#059669,#065f46);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">Details Provided — SLA Resumed</h1>
    <p style="color:#d1fae5;margin:6px 0 0;font-size:14px">{{system_name}}</p>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px">Dear {{engineer_name}},</p>
    <p style="color:#374151;font-size:15px">The requester has provided the additional details you requested for ticket <strong>#{{ticket_number}}</strong>.</p>
    <div style="background:#ecfdf5;border-left:4px solid #059669;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600;color:#065f46">Ticket: #{{ticket_number}} — {{subject}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Requester: {{requester_name}}</p>
      {{#if provider_note}}
      <p style="margin:8px 0 4px;font-weight:600;color:#374151">Message from requester:</p>
      <p style="margin:0;color:#374151;white-space:pre-wrap">{{provider_note}}</p>
      {{/if}}
    </div>
    <p style="color:#374151;font-size:14px"><strong>SLA has been resumed</strong> for this ticket. Please review the new information and continue working on the resolution.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="{{ticket_url}}" style="background:#059669;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View Ticket</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">This is an automated notification from {{system_name}}.</p>
  </div>
</div>`,
};

module.exports = {
  TICKET_PENDING_INFO,
  TICKET_INFO_PROVIDED,
};
