# Design direction — “The Seal & the Street”

## The idea

The Peoples Action already has a strong identity in its seal: a navy field, gold lettering, a triangle holding **T · P · A**, red-black-green stars, and six words — **Unity, Power, Discipline, Execution, Organize, Mobilize**. Its work happens in a very particular place: Detroit streets, vacant lots, front porches, community halls, marches with megaphones.

The redesign joins those two things.

- **The Seal** gives the site its authority and dignity: a deep navy and burnished gold palette, a serif voice for the mission statement, and the seal's own words and triangle used as structure.
- **The Street** gives it energy and honesty: condensed placard-style headlines like a protest sign, hard edges and printed rules instead of soft cards, and **real TPA photography**, shown large, in full color, with plain documentary captions.

The one recurring signature is the **block-club sign**: a gold rectangle with black condensed capitals, used for labels, event dates and calls to action. It echoes the yellow block club signs on Detroit streets, and it is literally the organization's work — Adopt The Block is about organizing blocks.

### What it deliberately avoids
No centered stock-photo hero, no gradients-as-decoration, no rounded card grids, no purple-blue "AI" palette, no invented slogans or statistics. Content is laid out as **editorial rows and numbered index lists** (01–05) rather than repeated card grids. Every headline uses TPA's own words ("Changing the narrative of Detroit" comes from the Adopt The Block description on the old site).

## Color

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0E1630` | Seal field. Header, footer, dark sections, body text on light |
| `--navy` | `#1B2A5C` | Seal navy. Secondary dark surface |
| `--gold` | `#E2B53E` | Seal gold. Block-club signs, primary buttons, text **on dark only** |
| `--gold-ink` | `#7A5A10` | Gold for text on light backgrounds (passes AA) |
| `--paper` | `#F5F0E6` | Newsprint background |
| `--paper-2` | `#EBE3D2` | Alternate light section |
| `--red` `#B8242B` / `--green` `#1D7442` | | From the seal's stars. Errors / success only — never decoration |

Contrast: ink on paper 15.6:1, gold on ink 9.3:1, paper on navy 12.1:1, gold-ink on paper 5.6:1, muted text on paper 7.2:1. All pairings pass WCAG AA (also verified by axe in `npm test`).

## Typography (self-hosted, no external font requests)

| Role | Family | Why |
|---|---|---|
| Display & headings | **Archivo** variable, condensed (`font-stretch` 62–75%), weight 800–900, uppercase | Reads like a hand-lettered placard or a block-club sign; variable width lets one family cover posters and small labels |
| Body & UI | **Public Sans** | Designed for public-service websites — plain, legible, civic |
| Mission quotes | **Source Serif 4** italic | The seal's serif heritage; used only for the organization's own words |

Scale (fluid, `clamp()`): display 3.1→8.25rem · h1 2.6→5.5rem · h2 2→3.5rem · h3 1.3→1.75rem · lead 1.125→1.4rem · body 17px · labels .78rem tracked +.14em.

## Space, grid, breakpoints

- 4px base: `--s-1` .25rem … `--s-10` 9rem; section padding `clamp(3.5rem, …, 8rem)`.
- Content max width 1320px, fluid gutter 16→44px, 12-column grid for photo essays.
- Breakpoints: 400 (small phones), 560, 760/860 (stack to one column), 960 (mobile nav), 1100 (hide secondary nav item).
- Mobile layouts are composed, not shrunk: hero photo moves above the headline and is re-cropped on the speaker; calendar switches from month grid to an agenda list; program rows stack photo-first.

## Components

- **Buttons** — square, 2px border, uppercase Archivo; gold (primary), ink, ghost. Hover lifts with a hard offset shadow (disabled under reduced motion). Min height 48px.
- **Block-club sign (`.tag`)** — section labels, event categories.
- **Date sign** — gold event date block with a hard shadow.
- **Index list** — numbered rows for focus areas, services, milestones.
- **Program row** — alternating 7/5 photo/text editorial rows.
- **Paths band** — gold "Need help?" vs navy "Want to help?" split.
- **Photos** — 2px ink frame, optional gold offset shadow, caption with a leading rule. Team portraits are grayscale and turn to color on hover/focus.
- **Forms** — labels above, 2px square inputs, 52px tall, inline errors with `aria-invalid`, status region.
- **Navigation** — sticky ink header with a gold underline; Programs disclosure menu; full-screen mobile menu.

## Accessibility requirements (tested)
Semantic landmarks, one `<h1>` per page, skip link, visible gold+ink focus ring, keyboard-operable menus/dialogs (Escape closes, focus returns), `aria-live` for calendar and form status, alt text describing what is actually visible, ≥40px touch targets, `prefers-reduced-motion` honored, no horizontal scroll from 360px up.

## Photography rules
Only TPA's own photos from the previous site are used. Captions describe what is visible and never add names, dates or claims that aren't verified. People are named only where the old site named them (team portraits). Where a photo is missing, the layout uses type instead of filler imagery.
