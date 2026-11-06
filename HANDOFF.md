# HANDOFF — The Peoples Action website redesign

_Last updated: 2026-11-06 · branch `redesign` (not merged, not deployed)_

## State
- All public pages rebuilt from the old Wix site's content and photos: Home, About (new, from the old home page's "Who is TPA" + team), Adopt The Block (new dedicated page from existing ATB copy), The Peoples Economy, Detroit Peoples Community, The Peoples Army, The Peoples Politics, Houston, Events (new live calendar), Get Involved/Contact, Donate (new page; same PayPal recipient), Groups, 404.
- Staff portal at `/admin/`: events, page text + announcement banner, team, inbox, admins. Works against Firebase once configured; verified end-to-end against `tests/mock-firebase`.
- `npm test`: 615 checks, 0 failures (pages × 5 widths, axe WCAG 2.1 AA, links, nav, forms, PayPal post, calendar, admin flow, reduced motion).

## Not done / needs a human
1. **Connect Firebase** (docs/ADMIN-GUIDE.md). Decide who owns the Firebase project — ideally an org-owned Google account, not a personal one.
2. **Firestore rules were not run in the Firebase emulator** (the build sandbox couldn't download it). Run `firebase emulators:start` and try: anonymous create of a valid/invalid message, anonymous read of drafts, non-admin writes. Expected results are in the rules comments.
3. **Impact report PDFs are still on Wix.** Download both and move into `src/assets/docs/` before cancelling Wix.
4. **Photos** were taken from the Wix CDN (hero 1600px, others 800px). Ask TPA for originals and newer photos — most appear to be from earlier years.
5. **Email**: PayPal and the contact fallback use `info@thepeoplesaction.com` (.com, from the old PayPal button) while the website is .org. Confirm that inbox is monitored.
6. **Domain switch**: only after TPA approves; DNS `www` CNAME → GitHub Pages; add domain to Firebase Auth authorized domains.

## Content to confirm with TPA (kept as-is from the old site, not invented)
- The Peoples Politics page describes a PAC, a yearly slate, and canvassing for endorsed candidates on a 501(c)(3) site. Recommend TPA confirm with their counsel how they want this presented.
- Houston chapter: still active? Joi's title (old site gave none — shown as "TPA Houston").
- "1,000+ network" (Entrepreneur Workshop), "30+ families" (2017), "10+ start-ups" (2018), Proposal A 2016 — all TPA's own figures, labelled as such.
- The old home page had a fourth, unnamed team photo; it's used unnamed as a volunteer photo on Get Involved.
- No street address is published: public directories list different addresses (Roselawn St, Piedmont St). Add one only once TPA confirms.

## Dropped from Wix (intentionally)
Facebook "Like" widget, Wix visitor-analytics/StatCounter widgets, the stale "Dec 29 Entrepreneur Workshop" event widget, background videos on division pages (Wix-hosted; no source files), the empty Wix Groups feed (replaced by a simple Groups page at the same URL).

## Next sensible steps
- Firebase App Check + reCAPTCHA v3 on the contact form if spam appears (honeypot only today).
- Privacy-friendly analytics (e.g. GoatCounter) if TPA wants visit numbers.
- A short "In the news" list fed from the admin portal.
