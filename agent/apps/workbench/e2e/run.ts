import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { LoginResult } from '@aitp/protocol';
import puppeteer from 'puppeteer-core';
import { createFixtureWorkspace } from '../../../test/support/fixture-workspace.ts';
import { startAgent } from '../../../packages/server/src/compose.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const screenshots = process.env.AITP_SCREENSHOTS || join(root, 'e2e/screenshots');
const executablePath = process.env.AITP_CHROME;
if (!executablePath) throw new Error('Set AITP_CHROME to the installed Chrome or Chromium executable before running the browser check.');
const fixture = await createFixtureWorkspace();
let running: Awaited<ReturnType<typeof startAgent>> | undefined;
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
try {
  fixture.config.server.port = 0;
  fixture.config.workspace.writeMode = 'off';
  await mkdir(fixture.dataDir, { recursive: true }); await mkdir(screenshots, { recursive: true });
  const configPath = join(fixture.dataDir, 'config.json'); await writeFile(configPath, JSON.stringify(fixture.config));
  running = await startAgent({ env: { ...process.env, AITP_AGENT_CONFIG: configPath, AITP_AGENT_HOME: fixture.dataDir }, profile: 'read-only', faux: true, version: 'browser-test', staticDir: join(root, 'dist') });
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, ...(process.env.AITP_BROWSER_LIBS ? { LD_LIBRARY_PATH: [process.env.AITP_BROWSER_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : {}) } });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await page.setRequestInterception(true);
  page.on('request', request => { if (request.url().startsWith(new URL(running!.url).origin) || request.url().startsWith('data:')) void request.continue(); else void request.abort(); });
  await page.goto(running.url, { waitUntil: 'networkidle0' });
  try { await page.waitForSelector('.direction-card', { timeout: 10000 }); }
  catch (error) { console.error(JSON.stringify({ errors, page: await page.$eval('body', element => element.innerText) })); await page.screenshot({ path: join(screenshots, 'failure.png') }); throw error; }
  await page.screenshot({ path: join(screenshots, 'home-light.png') });
  assert.equal(await page.evaluate(() => location.hash), '');
  await page.click('.topic-list button');
  await page.waitForSelector('.thread-card');
  await page.screenshot({ path: join(screenshots, 'topic-light.png') });
  await page.click('button[aria-label="Toggle theme"]');
  await page.screenshot({ path: join(screenshots, 'topic-dark.png') });
  await page.click('button[aria-label="Toggle theme"]');
  await page.click('.ask-button');
  await page.waitForSelector('.composer textarea');
  await page.type('.composer textarea', 'Where does this topic stand?');
  await page.click('button[aria-label="Send message"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant')].some(e => e.textContent?.includes('Faux completion.')), { timeout: 10000 });
  await page.evaluate(() => { [...document.querySelectorAll('.dock-tabs button')].find(e => e.textContent?.startsWith('Context'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForSelector('.context-list article');
  await page.screenshot({ path: join(screenshots, 'context-light.png') });
  await page.setViewport({ width: 1024, height: 768 });
  await page.screenshot({ path: join(screenshots, 'topic-narrow.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth), 'horizontal overflow');
  await page.click('button[aria-label="Close agent"]');
  await page.click('.ask-button');
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant')].some(e => e.textContent?.includes('Faux completion.')));
  assert.notEqual(await page.$eval('select[aria-label="Session"]', e => (e as HTMLSelectElement).value), '');
  await page.click('button[aria-label="Close agent"]');
  await page.click('button[aria-label="Settings"]');
  await page.waitForSelector('.model-summary');
  assert.match(await page.$eval('.model-summary', e => e.textContent ?? ''), /faux/);
  await page.screenshot({ path: join(screenshots, 'settings.png') });
  // Reproduce ChatGPT's two immediate challenges without making an external auth request.
  const modelPort = running.services.port.models();
  let loginCalls = 0;
  let finishLogin: ((result: LoginResult) => void) | undefined;
  let activeLogin = '';
  modelPort.startLogin = async (provider, _method, challenge) => {
    loginCalls++; activeLogin = randomUUID();
    const login = activeLogin;
    challenge({ kind: 'auth-url', provider, login, url: 'https://auth.example.invalid/authorize' });
    challenge({ kind: 'prompt', provider, login, prompt: randomUUID(), label: 'Optional final callback URL', secret: true });
    return { login, done: new Promise(resolve => { finishLogin = resolve; }) };
  };
  modelPort.cancelLogin = async login => { assert.equal(login, activeLogin); finishLogin?.({ login, provider: 'openai', ok: false, message: 'Sign-in cancelled. You can start a new sign-in.' }); };
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(e => e.textContent === 'Sign in with ChatGPT')?.click(); });
  await page.waitForSelector('.login-challenge a');
  assert.equal(await page.$eval('.login-challenge a', e => (e as HTMLAnchorElement).href), 'https://auth.example.invalid/authorize');
  assert.equal(await page.$eval('.settings-actions .primary-button', e => (e as HTMLButtonElement).disabled), true);
  assert.equal(loginCalls, 1);
  // Reconnect: the server must replay the link AND the optional manual prompt.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('button[aria-label="Settings"]');
  await page.waitForSelector('.login-challenge a');
  assert.ok(await page.$('.login-challenge details input'));
  await page.screenshot({ path: join(screenshots, 'sign-in-pending.png') });
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(e => e.textContent === 'Cancel sign-in')?.click(); });
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(e => e.textContent?.includes('Sign-in cancelled')));
  assert.equal(await page.$eval('.settings-actions .primary-button', e => (e as HTMLButtonElement).disabled), false);
  assert.equal(await page.$('.login-challenge a'), null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['authentication', 'navigation', 'topic', 'themes', 'session', 'streaming', 'context', '1024x768 overflow', 'settings', 'sign-in link and optional callback', 'sign-in reconnect', 'cancel and retry'], screenshots, errors }));
} finally {
  await browser?.close(); await running?.stop(); await fixture.cleanup();
}
