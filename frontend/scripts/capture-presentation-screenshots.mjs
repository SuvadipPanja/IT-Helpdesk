import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'http://localhost:5173';
const outDir = path.resolve('..', 'presentation', 'assets', 'screenshots');

const accounts = {
  admin: { username: 'admin', password: 'Admin@123' },
  user: { username: 'user', password: 'User@123' },
  pankaj: { username: 'Pankaj', password: 'Pankaj@123' },
};

async function ensureDir() {
  await fs.mkdir(outDir, { recursive: true });
}

async function clearSession(page) {
  await page.context().clearCookies();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function login(page, { username, password }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2500);

  const otpVisible = await page.getByRole('heading', { name: /verify your identity/i }).isVisible().catch(() => false);
  if (otpVisible) {
    throw new Error(`2FA required for ${username}; automated login cannot proceed without OTP.`);
  }

  await page.waitForURL(/dashboard|my-tickets|tickets|settings|analytics/, { timeout: 15000 });
}

async function capture(page, fileName, locator = null) {
  await page.waitForTimeout(1500);
  const filePath = path.join(outDir, fileName);
  if (locator) {
    await locator.screenshot({ path: filePath });
  } else {
    await page.screenshot({ path: filePath, fullPage: true });
  }
  return filePath;
}

async function captureAdmin(page) {
  await login(page, accounts.admin);
  await capture(page, '01-admin-dashboard.png');

  await page.goto(`${baseUrl}/users`, { waitUntil: 'networkidle' });
  await capture(page, '02-admin-users.png');

  await page.goto(`${baseUrl}/tickets`, { waitUntil: 'networkidle' });
  await capture(page, '03-admin-tickets.png');

  await page.goto(`${baseUrl}/analytics`, { waitUntil: 'networkidle' });
  await capture(page, '04-admin-analytics.png');

  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
  await capture(page, '05-admin-settings-general.png');

  const licenseTab = page.getByRole('button', { name: /license/i }).first();
  if (await licenseTab.isVisible().catch(() => false)) {
    await licenseTab.click();
    await page.waitForTimeout(1200);
    await capture(page, '06-admin-settings-license.png');
  }

  const backupTab = page.getByRole('button', { name: /backup/i }).first();
  if (await backupTab.isVisible().catch(() => false)) {
    await backupTab.click();
    await page.waitForTimeout(1200);
    await capture(page, '07-admin-settings-backup.png');
  }

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  const botFab = page.locator('.nbot-fab').first();
  if (await botFab.isVisible().catch(() => false)) {
    await botFab.click();
    await page.waitForTimeout(800);
    const input = page.locator('.nbot-chat-footer input').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('How does password reset work?');
      await page.locator('.nbot-send').click();
      await page.waitForTimeout(2500);
      await capture(page, '08-admin-ai-assistant.png');
    }
  }
}

async function captureUser(page) {
  await clearSession(page);
  await login(page, accounts.user);
  await capture(page, '09-user-dashboard.png');

  await page.goto(`${baseUrl}/my-tickets`, { waitUntil: 'networkidle' });
  await capture(page, '10-user-my-tickets.png');
}

async function captureEngineer(page) {
  await clearSession(page);
  await login(page, accounts.pankaj);
  await capture(page, '11-engineer-dashboard.png');

  await page.goto(`${baseUrl}/tickets`, { waitUntil: 'networkidle' });
  await capture(page, '12-engineer-tickets.png');
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await capture(page, '00-login-page.png');
    await captureAdmin(page);
    await captureUser(page);
    await captureEngineer(page);
    console.log(`Screenshots saved to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
