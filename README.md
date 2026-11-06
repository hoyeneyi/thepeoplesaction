# The Peoples Action — website (v2)

Redesign of **thepeoplesaction.org** for The Peoples Action (TPA), the Detroit-based, resident-driven 501(c)(3) behind Adopt The Block. Replaces the previous Wix site.

- **Static site** — hand-written HTML/CSS/JS, no framework, no runtime dependencies. Built with a 100-line Node script.
- **Live calendar + staff portal** — Firebase (Firestore + Auth), free tier. Optional: the site runs fully in static mode until Firebase is connected.
- **Donations** — the same PayPal recipient as the old site (`info@thepeoplesaction.com`).

## Quick start

```bash
npm install          # dev-only: fonts source + axe-core for tests
npm run build        # src/ → public/
npm run serve        # http://127.0.0.1:8080
npm test             # build + full QA suite (Playwright + axe), ~5 min
npm run shots        # QA + after-screenshots into docs/screenshots/after
```

Playwright must be available (`npm i -D playwright && npx playwright install chromium` if it isn't).

## Structure

```
src/
  pages/            one folder per URL (old Wix URLs preserved: /peopleseconomy/, /peoplesarmy/, …)
  partials/         head, header, footer (shared)
  assets/css/       site.css (design system), admin.css
  assets/js/        config.js ← Firebase + PayPal settings
                    site.js (nav, editable text, banner) · events.js (calendar) · contact.js · donate.js
                    data.js (Firestore / static fallback) · admin.js (staff portal)
  assets/img/       TPA photos, responsive JPG + WebP
  assets/data/      static fallbacks (events.json, content.json)
scripts/build.mjs   assembles pages, responsive <picture> tags, sitemap, editable-field registry
firebase/           Firestore + Storage security rules
tests/              QA suite, test server, Firebase mock used only by tests
docs/               DESIGN.md · ADMIN-GUIDE.md · screenshots/
```

## Conventions
- Page metadata lives in the first-line comment: `<!--page title="…" description="…" nav="programs" -->`.
- Images: `{{img src="atb-1" alt="…" sizes="…"}}` — the build emits a WebP/JPEG `<picture>` from `assets/img/atb-1-{width}.{jpg,webp}`.
- Any element with `data-cms="page.key"` becomes editable in the staff portal (default = the HTML text).
- Never invent statistics, quotes, partners or programs. Content is sourced from TPA's own site; see HANDOFF.md.

See **docs/ADMIN-GUIDE.md** for Firebase setup, hosting and daily use.
