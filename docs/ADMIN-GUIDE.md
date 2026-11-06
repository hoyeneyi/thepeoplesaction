# Staff portal guide

The staff portal is at **/admin/** (also linked as “Staff login” in the footer). From it, TPA staff can:

- **Events** — add, edit, duplicate, unpublish (draft) and delete events. Published events appear instantly on the home page, the Events calendar, and the matching program page.
- **Page text & banner** — change key headlines and intro paragraphs on every page, and switch on a site-wide announcement banner (e.g. “Adopt The Block day moved to Sunday”).
- **Team** — manage the Meet the Team sections for Detroit and Houston.
- **Inbox** — read messages and volunteer sign-ups sent through the Contact form, mark them handled, reply by email, export to CSV.
- **Admins** — give or remove portal access.

---

## One-time setup (about 20 minutes, free)

Until this is done the website still works fully — pages, photos and PayPal donations — but the calendar shows “no events”, text can't be edited, and the contact form opens the visitor's email app instead of saving to the inbox.

1. **Create a Firebase project** at <https://console.firebase.google.com> → *Add project* (e.g. `thepeoplesaction-site`). Google Analytics is optional.
2. **Add a web app**: Project settings → *Your apps* → `</>` → register. Copy the `firebaseConfig` object.
3. **Paste it** into `src/assets/js/config.js`, replacing `export const FIREBASE_CONFIG = null;`.
   (These values are public identifiers, not secrets — security comes from the rules in step 5.)
4. **Turn on sign-in**: Build → Authentication → *Get started* → Email/Password → Enable.
   Add your first staff user under *Users → Add user*. Copy that user's **UID**.
5. **Create the database and rules**: Build → Firestore Database → *Create database* (production mode, region `us-central` or `nam5`).
   Then either paste `firebase/firestore.rules` into the *Rules* tab and Publish, or with the Firebase CLI run `firebase deploy --only firestore:rules`.
6. **Make yourself an admin**: Firestore → *Start collection* `admins` → Document ID = the UID from step 4 → add a field `email` (string). Every other admin can be added from the portal's **Admins** tab after this.
7. **Allow your domain**: Authentication → Settings → *Authorized domains* → add `www.thepeoplesaction.org` (and the GitHub Pages domain if you preview there).
8. Rebuild and deploy (`git push` to `main` if using the included GitHub Actions workflow).

*Photo uploads* in the Team editor need Firebase Storage, which requires the pay-as-you-go **Blaze** plan on new projects (it still has a free monthly allowance). If you enable it, deploy `firebase/storage.rules` and set `STORAGE_ENABLED = true` in `config.js`. Otherwise paste a photo link.

## Everyday tasks

**Add an event** — Events → *+ New event*. Title, program, date and start time are required. Tick *All-day event* for things without a set time. Add a registration link (must start with `https://`) to show a button on the event. Untick *Published* to save a draft.

**Change a headline or intro** — Page text & banner. Each box shows the original wording underneath; leave a box empty to keep the original. *Save page text* publishes immediately.

**Post an announcement** — Page text & banner → tick *Show the banner*, write one sentence, optionally add a link (`/events/` or a full `https://` address). Untick to remove.

**Update the team** — Team → *Import current team* the first time (copies the existing people into the database), then edit. Hidden people stay saved but don't appear on the site. If a chapter has nobody in the database, the site keeps showing the original listing.

**Answer messages** — Inbox shows *New* messages with a red count. Click the email to reply from your email app, then *Mark handled*.

## Hosting

The site is plain HTML/CSS/JS built by `node scripts/build.mjs` into `public/`. The included workflow (`.github/workflows/pages.yml`) deploys `public/` to GitHub Pages on every push to `main`. To point **www.thepeoplesaction.org** at it: repo Settings → Pages → *Custom domain*, then update the domain's DNS (a `CNAME` record for `www` → `<github-username>.github.io`). Do this only when ready to switch away from Wix.

Before cancelling Wix, download the two **Impact Report PDFs** (linked from the About page) and place them in `src/assets/docs/`, then update their links — they are currently still served from Wix.
