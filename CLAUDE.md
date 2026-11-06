# CLAUDE.md — The Peoples Action website

Read HANDOFF.md first for current state and open items.

## What this is
Static site for The Peoples Action (Detroit, 501(c)(3); not the national "People's Action"). Vanilla HTML/CSS/JS in `src/`, built to `public/` by `node scripts/build.mjs`. Firebase (Firestore + Auth) powers the calendar, editable text, team, inbox and `/admin/`. The site must keep working with `FIREBASE_CONFIG = null` (static fallback).

## Rules
- Do not invent impact numbers, testimonials, partners, programs, awards or quotes. Only use content from TPA's own materials; flag anything unverified.
- Spell the org "The Peoples Action" (as on its seal), "Adopt The Block", "Detroit Peoples Community".
- Keep old URLs working (`/peopleseconomy/`, `/detroitpeoplescommunity/`, `/peoplesarmy/`, `/peoplespolitics/`, `/houston/`, `/contact-us/`, `/groups/`).
- PayPal recipient stays `info@thepeoplesaction.com` unless TPA says otherwise.
- Design tokens live at the top of `src/assets/css/site.css`; follow docs/DESIGN.md. No rounded cards, no gradients-as-decoration, no new fonts/frameworks without reason.
- Any Firestore field change must be mirrored in `firebase/firestore.rules` (validEvent / validMessage).
- Escape all user/admin-provided strings before inserting HTML (`esc()` helpers); only allow `https://` or `/` links.

## Verify before claiming done
`npm test` (Playwright + axe; ~600 checks across 5 widths, admin flow against `tests/mock-firebase`). It must end with 0 failed. Look at screenshots, not just test output.
