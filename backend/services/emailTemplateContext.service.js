/**
 * Global merge-tag context for all transactional emails.
 * Values come from system_settings + config so templates can use {{system_name}}, {{company_name}}, etc.
 * Caller-specific variables override these when keys collide.
 */

const settingsService = require('./settings.service');
const { getPublicAppUrl } = require('../utils/publicUrl');

/**
 * @returns {Promise<Record<string, string>>}
 */
async function getGlobalTemplateVariables() {
  const keys = [
    'system_name',
    'system_title',
    'company_name',
    'logo_url',
    'timezone',
  ];
  const fromDb = await settingsService.getMany(keys, false);

  const systemName =
    (fromDb.system_name != null && String(fromDb.system_name).trim() !== '')
      ? String(fromDb.system_name)
      : 'Nexus Support';

  const companyName =
    (fromDb.company_name != null && String(fromDb.company_name).trim() !== '')
      ? String(fromDb.company_name)
      : systemName;

  const systemTitle =
    (fromDb.system_title != null && String(fromDb.system_title).trim() !== '')
      ? String(fromDb.system_title)
      : systemName;

  const logoUrl = fromDb.logo_url != null ? String(fromDb.logo_url) : '';
  const timezone = fromDb.timezone != null ? String(fromDb.timezone) : 'UTC';

  const appUrl = getPublicAppUrl();

  const emailFromSetting = await settingsService.get('email_from_address');
  const supportEmail =
    process.env.SUPPORT_EMAIL ||
    (emailFromSetting && String(emailFromSetting).trim()) ||
    process.env.SMTP_FROM_EMAIL ||
    'support@example.com';

  const now = new Date();
  const year = String(now.getFullYear());

  return {
    system_name: systemName,
    system_title: systemTitle,
    company_name: companyName,
    /** Same as company_name for templates that say "organization" */
    organization_name: companyName,
    logo_url: logoUrl,
    /** Absolute base URL for the app (from APP_PUBLIC_URL) */
    system_url: appUrl,
    app_url: appUrl,
    support_email: supportEmail,
    timezone,
    current_year: year,
    current_date: now.toISOString().slice(0, 10),
    /** Standard footer line — admins override wording in template using variables */
    email_footer_disclaimer: `This email was sent by ${systemName}. Please do not reply if this is an automated message.`,
  };
}

/**
 * Merge: global first, then overrides (overrides win).
 * @param {Record<string, string>} overrides
 * @returns {Promise<Record<string, string>>}
 */
async function mergeWithGlobal(overrides = {}) {
  const globalVars = await getGlobalTemplateVariables();
  return { ...globalVars, ...overrides };
}

module.exports = {
  getGlobalTemplateVariables,
  mergeWithGlobal,
};
