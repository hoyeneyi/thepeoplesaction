// End-to-end QA for the built site (public/). Run: npm test
// - every page at 1440/1024/768/390/360: console errors, failed requests, horizontal overflow, broken images
// - axe-core WCAG 2.1 A/AA scan at desktop + mobile
// - internal link check
// - functional checks: navigation, contact form, donation form, calendar, admin portal (with a mocked Firebase)
// - optional: SHOTS=1 writes after-screenshots to docs/screenshots/after
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'public');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PAGES = ['/', '/about/', '/adopt-the-block/', '/peopleseconomy/', '/detroitpeoplescommunity/', '/peoplesarmy/', '/peoplespolitics/', '/houston/', '/events/', '/contact-us/', '/donate/', '/groups/', '/admin/', '/this-page-does-not-exist'];
const WIDTHS = [1440, 1024, 768, 390, 360];

let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { failures++; console.log('  ✗ ' + msg); } };
const section = (t) => console.log('\n▸ ' + t);

const day = (offset, h = 10) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const FIXTURE = {
  events: [
    { id: 'e1', title: 'Adopt The Block clean-up', category: 'adopt-the-block', chapter: 'detroit', start: day(2), end: day(2, 13), location: 'Test location A', address: '123 Test St, Detroit, MI', description: 'Fixture event for automated tests.', published: true },
    { id: 'e2', title: 'Community meeting', category: 'meeting', chapter: 'detroit', start: day(5, 18), end: day(5, 20), location: 'Test hall', description: 'Fixture.', published: true },
    { id: 'e3', title: 'Self-defense training', category: 'army', chapter: 'detroit', start: day(9, 11), published: true },
    { id: 'e4', title: 'Houston block day', category: 'adopt-the-block', chapter: 'houston', start: day(12, 9), allDay: true, published: true },
    { id: 'e5', title: 'Draft that must not show', category: 'economy', start: day(3), published: false },
    { id: 'e6', title: 'Past event', category: 'economy', start: day(-20), published: true },
  ],
  content: { fields: { 'home.hero.kicker': 'Fixture kicker text' }, announcement: { active: true, text: 'Fixture announcement', linkText: 'Details', linkUrl: '/events/' } },
};

const { server, url: BASE } = await serve(PUBLIC);
const browser = await chromium.launch();

async function newPage(width, { mockFirebase = false, fixtures = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) page.errors.push('Request failed: ' + r.url()); });
  await ctx.route(/paypal\.com|calendar\.google\.com|google\.com\/maps/, (r) => r.fulfill({ status: 200, body: 'external' }));
  if (mockFirebase) {
    await ctx.route('**/firebasejs/**', (r) => {
      const f = r.request().url().split('/').pop();
      r.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(root, 'tests/mock-firebase', f), 'utf8') });
    });
    await ctx.route('**/assets/js/config.js', async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace('export const FIREBASE_CONFIG = null;', 'export const FIREBASE_CONFIG = { projectId: "mock" };');
      r.fulfill({ response: res, body });
    });
  }
  if (fixtures) await ctx.addInitScript((d) => { window.__TPA_DATA = d; }, fixtures);
  return page;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------- 1. Pages × widths
section('Pages render cleanly at 1440 / 1024 / 768 / 390 / 360');
for (const path of PAGES) {
  for (const w of WIDTHS) {
    const page = await newPage(w);
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const expected = path.startsWith('/this-page') ? 404 : 200;
    ok(res.status() === expected, `${path} @${w}: HTTP ${res.status()} (expected ${expected})`);
    await scrollThrough(page);
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc),
      h1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent).length,
      title: document.title,
      smallTargets: [...document.querySelectorAll('a.btn, button, .nav-link, input:not([type=hidden]):not(.hp input), select')]
        .filter((e) => e.offsetParent && !e.closest('.hp, .cal-grid, [hidden]'))
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 40 || r.width < 40)).length,
    }));
    ok(m.overflow <= 0, `${path} @${w}: horizontal overflow ${m.overflow}px`);
    ok(m.broken.length === 0, `${path} @${w}: broken images ${m.broken.join(', ')}`);
    ok(m.h1 === 1 || (path === '/admin/' && m.h1 <= 1), `${path} @${w}: expected exactly one visible <h1>, found ${m.h1}`);
    ok(m.title.length > 10, `${path} @${w}: missing <title>`);
    ok(m.smallTargets === 0, `${path} @${w}: ${m.smallTargets} interactive targets smaller than 40px`);
    const errs = page.errors.filter((e) => !(expected === 404 && /status of 404/.test(e)));
    ok(errs.length === 0, `${path} @${w}: console/page errors: ${errs.join(' | ')}`);
    await page.context().close();
  }
}

// ---------------------------------------------------------------- 2. Accessibility (axe)
section('Accessibility — axe-core WCAG 2.1 A/AA');
for (const path of PAGES) {
  for (const w of [1440, 390]) {
    const page = await newPage(w, { fixtures: path === '/events/' || path === '/' ? FIXTURE : null });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await page.addScriptTag({ content: AXE });
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return res.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')}`);
    });
    ok(r.length === 0, `${path} @${w}: axe violations:\n      ${r.join('\n      ')}`);
    await page.context().close();
  }
}

// ---------------------------------------------------------------- 3. Links
section('Internal links resolve');
{
  const page = await newPage(1440);
  const hrefs = new Set();
  for (const path of PAGES.slice(0, -1)) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    (await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))).forEach((h) => hrefs.add(h));
  }
  const internal = [...hrefs].filter((h) => h.startsWith('/') && !h.startsWith('//'));
  for (const h of internal) {
    const u = new URL(h, BASE); u.hash = '';
    const r = await fetch(u);
    ok(r.status === 200, `link ${h} → HTTP ${r.status}`);
    if (h.includes('#') && !h.endsWith('#')) {
      const id = h.split('#')[1];
      const html = await (await fetch(new URL(h.split('#')[0] || '/', BASE))).text();
      ok(html.includes(`id="${id}"`), `link ${h} → anchor #${id} not found on target page`);
    }
  }
  const external = [...hrefs].filter((h) => /^https?:/.test(h));
  console.log(`  checked ${internal.length} internal links; ${external.length} external links listed in docs (not fetched from test sandbox)`);
  await page.context().close();
}

// ---------------------------------------------------------------- 4. Navigation
section('Navigation — desktop dropdown + mobile menu + keyboard');
{
  const page = await newPage(1440);
  await page.goto(BASE + '/');
  const toggle = page.locator('.nav-toggle-sub');
  await toggle.click();
  ok(await page.locator('#sub-programs').isVisible(), 'Programs submenu opens on click');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('#sub-programs').isVisible()), 'Escape closes submenu');
  ok(await toggle.evaluate((e) => e === document.activeElement), 'Focus returns to Programs button after Escape');
  await page.goto(BASE + '/peoplesarmy/');
  ok((await toggle.getAttribute('aria-current')) === 'page', 'Programs marked current on a program page');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.classList.contains('skip-link')), 'First Tab focuses “Skip to content”');
  await page.context().close();

  const m = await newPage(390);
  await m.goto(BASE + '/');
  ok(!(await m.locator('#site-nav').isVisible()), 'Mobile nav hidden initially');
  await m.click('.menu-btn');
  ok(await m.locator('#site-nav').isVisible(), 'Mobile nav opens');
  ok((await m.getAttribute('.menu-btn', 'aria-expanded')) === 'true', 'Menu button aria-expanded=true');
  await m.click('.nav-toggle-sub');
  ok(await m.locator('#sub-programs a[href="/adopt-the-block/"]').isVisible(), 'Programs list expands in mobile nav');
  await m.keyboard.press('Escape'); await m.keyboard.press('Escape');
  await m.waitForTimeout(350);
  ok(!(await m.locator('#site-nav').isVisible()), 'Escape closes mobile nav');
  await m.context().close();
}

// ---------------------------------------------------------------- 5. Contact form (static mode)
section('Contact form — validation, topic preselect, fallback');
{
  const page = await newPage(1024);
  await page.goto(BASE + '/contact-us/?topic=property-tax#contact-form');
  ok((await page.inputValue('#cf-topic')) === 'property-tax', 'Topic preselected from ?topic=');
  await page.click('[data-contact-form] [type=submit]');
  ok((await page.getAttribute('#cf-name', 'aria-invalid')) === 'true', 'Empty name flagged aria-invalid');
  ok(await page.locator('#cf-email-err').isVisible(), 'Email error shown');
  ok(await page.evaluate(() => document.activeElement.id === 'cf-name'), 'Focus moves to first invalid field');
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'not-an-email');
  await page.fill('#cf-message', 'Hello');
  await page.click('[data-contact-form] [type=submit]');
  ok((await page.getAttribute('#cf-email', 'aria-invalid')) === 'true', 'Invalid email rejected');
  await page.fill('#cf-email', 'test@example.org');
  await page.click('[data-contact-form] [type=submit]');
  const status = page.locator('[data-form-status]');
  await status.waitFor();
  const href = await status.locator('a').getAttribute('href');
  ok(href?.startsWith('mailto:info@thepeoplesaction.com') && href.includes('Hello'), 'Static mode falls back to a pre-filled email to info@thepeoplesaction.com');
  await page.click('a[data-topic="army"]');
  ok((await page.inputValue('#cf-topic')) === 'army', 'In-page topic links set the topic');
  await page.context().close();
}

// ---------------------------------------------------------------- 6. Donate form
section('Donate — PayPal recipient, amount, designation');
{
  const page = await newPage(1024);
  await page.goto(BASE + '/donate/?designation=Detroit%20Peoples%20Community');
  ok((await page.inputValue('[data-designation]')) === 'Detroit Peoples Community', 'Designation preselected from URL');
  await page.check('input[name=preset][value="50"]');
  ok((await page.inputValue('#dn-amount')) === '50', 'Preset amount fills the amount field');
  let posted = null;
  await page.context().route('https://www.paypal.com/**', (r) => { posted = r.request().postData(); r.fulfill({ status: 200, body: 'paypal' }); });
  await Promise.all([page.waitForURL(/paypal\.com/), page.click('[data-donate-form] [type=submit]')]);
  const params = new URLSearchParams(posted || '');
  ok(params.get('cmd') === '_donations', 'PayPal cmd=_donations');
  ok(params.get('business') === 'info@thepeoplesaction.com', 'PayPal recipient unchanged from existing site');
  ok(params.get('amount') === '50', 'Amount sent to PayPal');
  ok(params.get('item_name') === 'The Peoples Action — Detroit Peoples Community', 'Designation sent as item_name');
  ok(!params.has('preset'), 'UI-only preset field not sent');
  await page.context().close();
}

// ---------------------------------------------------------------- 7. Calendar
section('Calendar — upcoming lists, month grid, filters, details dialog');
{
  const page = await newPage(1440, { fixtures: FIXTURE });
  await page.goto(BASE + '/');
  await page.waitForSelector('[data-events] .event-item');
  const titles = await page.$$eval('[data-events] .event-item h3', (h) => h.map((x) => x.textContent));
  ok(titles.length === 3 && titles[0] === 'Adopt The Block clean-up', `Home shows next 3 upcoming events in order (got ${titles.join(', ')})`);
  ok(!titles.includes('Draft that must not show') && !titles.includes('Past event'), 'Drafts and past events hidden');
  ok((await page.textContent('[data-cms="home.hero.kicker"]')) === 'Fixture kicker text', 'Admin-edited text overrides default');
  ok(await page.locator('[data-announce]').isVisible(), 'Announcement banner shows when active');

  await page.goto(BASE + '/events/');
  await page.waitForSelector('[data-cal-agenda] .event-item');
  ok((await page.locator('.cal-grid .cal-ev').count()) >= 1, 'Month grid renders events');
  await page.click('[data-view="list"]');
  const upcomingCount = await page.locator('[data-cal-agenda] .event-item').count();
  ok(upcomingCount === 4, `Upcoming view lists 4 published future events (got ${upcomingCount})`);
  await page.click('[data-filter="army"]');
  ok((await page.locator('[data-cal-agenda] .event-item').count()) === 1, 'Program filter narrows the list');
  await page.click('[data-filter="all"]');
  await page.click('[data-cal-agenda] [data-open-event="e1"]');
  const dlg = page.locator('#event-dialog');
  ok(await dlg.isVisible(), 'Details dialog opens');
  ok((await dlg.locator('a[href*="calendar.google.com"]').count()) === 1, 'Add to Google Calendar link present');
  ok(((await dlg.locator('a[download]').getAttribute('href')) || '').startsWith('blob:'), '.ics download present');
  await page.keyboard.press('Escape');
  ok(!(await dlg.isVisible()), 'Escape closes dialog');
  ok(await page.evaluate(() => document.activeElement?.dataset.openEvent === 'e1'), 'Focus returns to the Details button');

  await page.goto(BASE + '/houston/');
  await page.waitForSelector('[data-events] .event-item');
  ok((await page.$$eval('[data-events] .event-item h3', (h) => h.map((x) => x.textContent))).join() === 'Houston block day', 'Houston page shows only Houston events');
  ok(page.errors.length === 0, 'No errors on calendar pages: ' + page.errors.join(' | '));
  await page.context().close();
}

// ---------------------------------------------------------------- 8. Admin portal (mock Firebase)
section('Admin portal — static setup screen, then full flow against a mocked Firebase');
{
  const s = await newPage(1024);
  await s.goto(BASE + '/admin/');
  ok(await s.locator('[data-view="setup"]').isVisible(), 'Unconfigured site shows setup instructions');
  await s.context().close();

  const page = await newPage(1280, { mockFirebase: true });
  await page.goto(BASE + '/admin/');
  await page.evaluate(() => localStorage.setItem('__mockfs', JSON.stringify({ admins: { 'test-admin-uid-123': { email: 'admin@test.local' } } })));
  await page.reload();
  await page.locator('[data-view="login"]').waitFor();
  await page.fill('#lg-email', 'admin@test.local');
  await page.fill('#lg-pass', 'wrong');
  await page.click('[data-login-form] [type=submit]');
  ok(await page.locator('[data-login-status]').isVisible(), 'Wrong password shows an error');
  await page.fill('#lg-pass', 'correct-horse');
  await page.click('[data-login-form] [type=submit]');
  await page.locator('[data-view="app"]').waitFor();
  ok(true, 'Admin signs in');

  // create event
  await page.click('[data-new-event]');
  await page.click('#editor [type=submit]');
  ok(await page.locator('[data-ev-status]').isVisible(), 'Event form requires a title');
  const d = new Date(); d.setDate(d.getDate() + 4);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.fill('#ev-title', 'QA Block Day');
  await page.fill('#ev-date', iso);
  await page.fill('#ev-start', '10:00');
  await page.fill('#ev-end', '13:00');
  await page.fill('#ev-loc', 'QA Park');
  await page.fill('#ev-link', 'http://insecure.example');
  await page.click('#editor [type=submit]');
  ok((await page.textContent('[data-ev-status]')).includes('https://'), 'Rejects non-https links');
  await page.fill('#ev-link', '');
  await page.click('#editor [type=submit]');
  await page.locator('[data-event-list] h2', { hasText: 'QA Block Day' }).waitFor();
  ok(true, 'Event saved and listed');

  // edit page text + banner
  await page.click('#tab-content');
  await page.locator('#cms-home-hero-line1').waitFor();
  await page.fill('#cms-home-hero-line1', 'Edited by QA');
  await page.check('#panel-content input[name="active"]');
  await page.fill('#an-text', 'QA banner');
  await page.fill('#an-lurl', '/events/');
  await page.click('[data-content-form] [type=submit]');
  await page.locator('[data-content-status]', { hasText: 'Saved' }).waitFor();
  ok(true, 'Page text saved');

  // team import
  await page.click('#tab-team');
  await page.click('[data-import-team]');
  await page.locator('[data-team-list] h3', { hasText: 'Negus Vu' }).waitFor();
  ok((await page.locator('[data-team-list] .admin-row').count()) === 5, 'Original team imported (5 people)');

  // public site sees it (same browser context = same mock database)
  const pub = await page.context().newPage();
  pub.errors = [];
  pub.on('console', (m) => { if (m.type() === 'error') pub.errors.push(m.text()); });
  pub.on('pageerror', (e) => pub.errors.push(e.message));
  await pub.goto(BASE + '/');
  await pub.locator('[data-events] h3', { hasText: 'QA Block Day' }).waitFor();
  ok((await pub.textContent('[data-cms="home.hero.line1"]')) === 'Edited by QA', 'Public page shows edited text');
  ok((await pub.textContent('[data-announce-text]')) === 'QA banner', 'Public page shows banner');
  await pub.goto(BASE + '/about/');
  await pub.waitForTimeout(300);
  ok((await pub.locator('[data-team="detroit"] .person').count()) === 3, 'About page renders team from database');

  // contact form → inbox
  await pub.goto(BASE + '/contact-us/?topic=volunteer');
  await pub.fill('#cf-name', 'QA Volunteer');
  await pub.fill('#cf-email', 'qa@example.org');
  await pub.fill('#cf-message', 'I want to help on Saturdays.');
  await pub.click('[data-contact-form] [type=submit]');
  await pub.locator('[data-form-status].is-ok').waitFor();
  ok(true, 'Contact form saves to inbox when Firebase is live');
  await page.click('#tab-inbox');
  await page.locator('[data-msg-list] h3', { hasText: 'QA Volunteer' }).waitFor();
  ok((await page.textContent('[data-inbox-count]')) === '1', 'Inbox badge counts new messages');
  await page.click('[data-msg-list] [data-handle]');
  await page.locator('[data-msg-list]', { hasText: 'No new messages' }).waitFor();
  ok(true, 'Mark handled moves message out of New');

  // live update: delete the event in admin, public calendar updates without reload
  await pub.goto(BASE + '/events/');
  await pub.click('[data-view="list"]');
  await pub.locator('[data-cal-agenda] h3', { hasText: 'QA Block Day' }).waitFor();
  await page.click('#tab-events');
  await page.click('[data-event-list] [data-del-event]');
  await page.click('[data-confirm-ok]');
  await pub.locator('[data-cal-agenda] h3', { hasText: 'QA Block Day' }).waitFor({ state: 'detached', timeout: 4000 }).then(() => ok(true, ''), () => ok(false, 'Public calendar did not update live after delete'));
  ok(page.errors.length === 0 && pub.errors.length === 0, 'No errors in admin flow: ' + [...page.errors, ...pub.errors].join(' | '));

  // non-admin is denied
  const n = await newPage(1024, { mockFirebase: true });
  await n.goto(BASE + '/admin/');
  await n.fill('#lg-email', 'someone@test.local');
  await n.fill('#lg-pass', 'correct-horse');
  await n.click('[data-login-form] [type=submit]');
  await n.locator('[data-view="denied"]').waitFor();
  ok(true, 'Signed-in non-admin sees “no access” screen');
  await n.context().close();
  await page.context().close();
}

// ---------------------------------------------------------------- 9. Reduced motion
section('Reduced motion');
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/');
  const dur = await p.$eval('.nav', (e) => getComputedStyle(e).transitionDuration);
  ok(parseFloat(dur) < 0.01, `Transitions disabled with prefers-reduced-motion (got ${dur})`);
  await ctx.close();
}

// ---------------------------------------------------------------- 10. Screenshots
if (process.env.SHOTS) {
  section('Writing after-screenshots to docs/screenshots/after');
  const out = join(root, 'docs/screenshots/after');
  mkdirSync(out, { recursive: true });
  for (const path of PAGES.slice(0, -2)) {
    for (const w of [1440, 390]) {
      const page = await newPage(w);
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await scrollThrough(page);
      const name = (path === '/' ? 'home' : path.replace(/\//g, '')) + `-${w === 1440 ? 'desktop' : 'mobile'}.png`;
      await page.screenshot({ path: join(out, name), fullPage: true });
      await page.context().close();
    }
  }
}

await browser.close();
server.close();
console.log(`\n${failures ? '✗' : '✓'} ${passes} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
