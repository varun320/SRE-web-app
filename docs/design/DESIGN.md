# SRE Timesheet — Design System

> **Audience.** The engineer/designer building the redesign. Everything here is intended to be actionable: OKLCH values, hex fallbacks, pixel sizes, component-level specs, and interaction rules. For voice and copy, see `BRAND.md`.
>
> **Basis.** This system is synthesized from the reference set — BambooHR, Gusto, Rippling, Justworks, Paylocity, QuickBooks Time, Harvest, Toggl, Clockify, Ramp, Brex, Expensify, Concur, Procore. Where a value comes from public docs or observable product screenshots, it is stated. Where the value is the author's recommendation calibrated to those references, it is marked *"estimated from visual inspection"* or *"our recommendation."*
>
> **North star.** Warm-neutral surface (already established in the app), single accent color used with discipline, monochrome icons, dense-but-comfortable tables (44 px rows), print-safe defaults. Closer to Gusto/BambooHR in warmth, closer to Ramp/Harvest in polish, closer to QuickBooks Time in mechanics.

---

## 1. Reference research summary

Concrete patterns extracted from visits to product marketing sites, help-center screenshots, and G2/Capterra galleries. Where fetching was blocked, values are visual-inspection estimates from widely available screenshots of these products.

| Product | Primary accent (approx) | Nav | Table row | Font | Button voice |
|---|---|---|---|---|---|
| **BambooHR** | Green `#73C41D` *(brand green, visual-inspection)* | Left sidebar, teal header | ~48 px | Proxima Nova (custom stack) | Sentence case, plain-English |
| **Gusto** | Coral/red `#F45D48` and warm cream *(brand palette, well-known)* | Left sidebar, cream surface | ~44 px | GT Walsheim + custom | Warm, plain-English ("Run payroll") |
| **Rippling** | Blue `#324DE1` *(brand)* | Left sidebar + top bar | ~40 px, dense | Inter *(estimated)* | Neutral corporate |
| **Justworks** | Green `#00A651` *(brand)* | Left sidebar | ~44 px | Custom sans | Friendly |
| **Paylocity** | Blue `#1B6EC2` *(brand)* | Top nav, older feel | ~48 px | System sans | Corporate |
| **QuickBooks Time** | Green `#2CA01C` (Intuit green) | Left sidebar | ~44 px | Avenir Next / Intuit Sans | Neutral, action-first |
| **Harvest** | Orange `#F58220` *(brand)* | Left sidebar, minimal | ~40 px | Sailec / system sans | Human, timer-focused |
| **Toggl Track** | Rose/red `#E57CD8`, teal `#4BC3F4` *(brand palette)* | Left sidebar | ~40 px | Roboto / Inter | Cheeky but restrained in admin |
| **Clockify** | Sky blue `#03A9F4` *(brand)* | Left sidebar | ~40 px | Roboto | Plain, dense |
| **Ramp** | Deep green/black `#0A0A0A` + `#F5F5EF` cream *(brand)* | Left sidebar, extreme minimalism | ~48 px | ABC Diatype / Söhne *(observed)* | Direct, no-nonsense |
| **Brex** | Black + orange accent *(brand)* | Left sidebar | ~44 px | GT America *(observed)* | Direct |
| **Expensify** | Green `#008C59` *(brand)* | Top nav | ~44 px | Custom | Chatty, dated feel |
| **Concur** | Blue `#003DA5` *(brand, SAP palette)* | Top nav | ~40 px | Custom | Enterprise |
| **Procore** | Orange `#F47E42` *(brand)* | Left sidebar | ~48 px | Apercu / Inter | Construction/serious |

### Cross-cutting conventions (patterns shared by 3+ products)

1. **Sidebar navigation over top-nav.** Every modern reference (BambooHR, Gusto, Rippling, Justworks, QuickBooks Time, Harvest, Toggl, Ramp, Brex, Procore) uses a left sidebar. The old-guard products (Paylocity, Concur, Expensify web) use top-nav and feel dated because of it. **→ Decision (2026-07-09): SRE ships with a centered top-nav** because the current tab set is small (Home / Week / Expenses / Me / Admin) and the horizontal room matters for the timesheet grid + expense line items. Revisit if the app grows past ~7 top-level surfaces.
2. **44 px table rows.** BambooHR, Gusto, Justworks, QuickBooks Time, Brex, Expensify all sit at ~44 px per row. Ramp and Procore go slightly taller at ~48 px. Toggl/Clockify go denser at ~40 px for admin views. **→ We use 44 px default, 40 px in "dense" mode for admin power users.**
3. **No zebra striping.** None of the reference products use zebra rows in modern designs. Instead they rely on generous vertical padding and 1 px dividers in a soft border color. **→ We do not zebra-stripe.**
4. **Status as pill/badge, not colored row.** Every reference uses a small pill (rounded-full or rounded-md, 20–24 px tall) with a tinted background and a foreground color at similar hue. No one colors the full row. **→ Pills, not row tints.**
5. **Sentence-case buttons and headings.** BambooHR, Gusto, Ramp, Harvest, Brex, Justworks all sentence-case. Only Concur and Paylocity still Title Case. **→ Sentence case, always.**
6. **Approvals as side panel, not modal.** Ramp, Brex, Gusto, QuickBooks Time all use a right-side panel (~480–560 px wide) that slides in over the inbox list. Modals are reserved for destructive confirmations. **→ Right side panel for approvals.**
7. **Bulk actions as sticky toolbar.** When multiple rows are selected, a toolbar slides in from the bottom or replaces the header. Ramp and Gusto both do this well. **→ Sticky bottom toolbar on multi-select.**
8. **Inter or a close cousin.** Rippling, Toggl, Clockify, Procore, Ramp (Söhne-family), Brex (GT-family) all sit in the Inter/geometric-sans family. **→ Inter Variable, with tabular numerals.**
9. **One accent color.** Ramp uses one (deep green). Gusto uses one warm coral. Harvest uses one orange. BambooHR uses one green. Products that use two or more accents (Toggl, older Paylocity) feel less coherent. **→ One accent.**
10. **Warm neutrals over cool grays.** Ramp's cream, Gusto's warm cream, BambooHR's warm off-white, Harvest's warm gray all sit at OKLCH hue ~70–90 (warm end). Cool-gray products (Concur, older Rippling) feel colder and more corporate. **→ Warm off-white palette, hue ~75–80.** This matches the existing tokens.

### Design-leader outliers worth copying

- **Gusto** — warmest palette in the category, and the copy voice matches (see `BRAND.md`). Their empty states use a single small color spot as illustration, never a cartoon character. **We copy the warmth, but avoid their coral primary (too consumer for SRE).**
- **Ramp** — extreme restraint. Almost no color, almost no chrome, single accent used sparingly, radical whitespace in dashboard tiles. Type hierarchy carries the design. **We copy the restraint but keep more warmth than Ramp's cream/black.**
- **Harvest** — the best small-app timesheet UI in the category. The weekly grid is spacious, the timer control is prominent, and the totals are pinned. **We copy the grid rhythm and pinned-totals pattern.**

### Anti-patterns explicitly avoided

- Glossy gradient buttons (Paylocity, older Concur, Expensify web)
- Sidebar chrome — three levels of nesting, badges on every item, expand/collapse animations (Rippling on a bad day, Paylocity)
- Consumer-SaaS marketing hero cards on dashboards (Toggl's older admin dashboard, HubSpot influence)
- Illustrated empty-state cartoons with animated flourishes (Clockify, older Toggl)
- Skeuomorphic "receipt with curled corner" imagery (Expensify's origin story, thankfully rare now)
- Two accent colors used at similar weight (some Toggl surfaces, older Paylocity)

---

## 2. Foundations

### 2.1 Color

The palette is Notion-warm — off-whites at OKLCH hue 75–80, single blue accent, disciplined status tints. The existing `web/styles/tokens.css` is close to correct; recommendations below tighten a few values.

#### Core palette

| Token | OKLCH | Hex (approx) | Usage |
|---|---|---|---|
| `--color-surface` | `oklch(98.5% 0.006 80)` | `#FAF9F6` | Page background |
| `--color-surface-2` | `oklch(96.5% 0.009 80)` | `#F3F1EC` | Card / panel background |
| `--color-surface-3` | `oklch(94% 0.012 80)` | `#EBE8E1` | Hover, subtle inset, table header |
| `--color-surface-sunken` | `oklch(92% 0.014 80)` | `#E3DFD6` | Print-safe row alternate (only when needed), disabled surfaces |
| `--color-text` | `oklch(22% 0.015 70)` | `#2A2621` | Primary text |
| `--color-text-muted` | `oklch(50% 0.015 70)` | `#7A7168` | Secondary text, captions, table subheaders |
| `--color-text-subtle` | `oklch(62% 0.012 70)` | `#9B948A` | Placeholder, disabled label, chart axis |
| `--color-border` | `oklch(92% 0.008 75)` | `#E7E3DB` | Standard divider, input border |
| `--color-border-soft` | `oklch(94.5% 0.006 75)` | `#EFEBE4` | Table row dividers, subtle card outline |
| `--color-border-strong` | `oklch(85% 0.010 75)` | `#D3CDC1` | Focused/selected border, print border |

**Note on the warm neutral:** OKLCH hue 75–80 is a warm off-white ("Notion cream" / "paper"). This is close to Tailwind's `stone` scale but marginally warmer. **Keep this — the team already likes it.**

#### Accent

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--color-accent` | `oklch(52% 0.15 245)` | `#2E6FCC` | Primary CTA, links, focus ring, selected states |
| `--color-accent-hover` | `oklch(46% 0.16 245)` | `#245BAA` | Primary CTA hover |
| `--color-accent-active` | `oklch(40% 0.15 245)` | `#1D4B8E` | Primary CTA active |
| `--color-accent-tint` | `oklch(95% 0.04 245)` | `#E4EDFA` | Subtle accent surface — selected row, info banner |
| `--color-accent-tint-strong` | `oklch(88% 0.07 245)` | `#C0D4F0` | Accent tint hover, focused chip |
| `--color-accent-fg-on-accent` | `oklch(98% 0.005 245)` | `#F7FAFE` | Text on `--color-accent` |

**Recommendation vs current tokens:** the existing accent (`oklch(58% 0.14 245)`) is a touch light and cheerful for admin work. Dropping it to 52% lightness with 0.15 chroma gives a more grounded, "engineering-firm" feel while staying blue enough to read as an accent, not a status.

#### Status colors (approvals — this is core)

Each status is a **pill** with a tinted background and a matching foreground. Do not tint entire rows.

| Status | fg OKLCH | bg OKLCH | fg hex | bg hex | Semantic |
|---|---|---|---|---|---|
| **Draft** | `oklch(40% 0.02 80)` | `oklch(95% 0.015 80)` | `#5B534A` | `#F1EDE4` | User owns it, nothing is expected of anyone else |
| **Submitted** | `oklch(40% 0.14 245)` | `oklch(95% 0.04 245)` | `#245BAA` | `#E4EDFA` | Waiting on approver |
| **Approved** | `oklch(38% 0.11 155)` | `oklch(94% 0.05 155)` | `#1F6449` | `#DEEEDF` | Done — locked, printable |
| **Declined** | `oklch(45% 0.14 45)` | `oklch(95% 0.05 55)` | `#A2542A` | `#F3E5D4` | Sent back to owner |
| **Overtime** | `oklch(50% 0.14 70)` | `oklch(94% 0.06 75)` | `#8F6923` | `#EEE3C9` | Non-blocking warning tint (>40 h) |
| **Paid** | `oklch(38% 0.11 155)` | `oklch(94% 0.05 155)` | `#1F6449` | `#DEEEDF` | Expense reimbursed — same visual as approved, different label |
| **Locked** | `oklch(50% 0.015 70)` | `oklch(96% 0.008 75)` | `#7A7168` | `#F5F2EB` | Period closed for editing |

**Note on declined:** we use a warm sienna/amber-brown, **not** red. Red on a timesheet feels like the software is angry at you. Sienna reads as "attention needed" without alarming.

#### Category tints (Project / Admin / Office & Sales)

Kept from the existing tokens, with slightly tighter chromas:

| Category | fg | bg | border | Hex fg / bg |
|---|---|---|---|---|
| **Project** (blue) | `oklch(40% 0.14 245)` | `oklch(95% 0.04 245)` | `oklch(70% 0.12 245)` | `#245BAA` / `#E4EDFA` |
| **Admin** (amber) | `oklch(42% 0.13 75)` | `oklch(95% 0.05 75)` | `oklch(70% 0.12 75)` | `#7C5B22` / `#F1E7CE` |
| **Office & Sales** (green) | `oklch(38% 0.13 155)` | `oklch(95% 0.05 155)` | `oklch(68% 0.13 155)` | `#1F6449` / `#DEEEDF` |

Categories are **borderless pills** in tables (bg + fg only). Border is used only for chart legends and the timesheet grid's left indicator bar (see § 4.7).

#### Semantic

| Token | OKLCH | Hex |
|---|---|---|
| `--color-success` | `oklch(55% 0.15 155)` | `#3D8760` |
| `--color-warning` | `oklch(65% 0.16 65)` | `#B87A2F` |
| `--color-danger` | `oklch(52% 0.19 25)` | `#B84A2E` |
| `--color-info` | `oklch(52% 0.15 245)` | `#2E6FCC` |

Danger is **only** used for destructive actions (delete a saved expense report, remove an employee). It is not the color of a declined timesheet — that's the softer sienna in the status table above.

#### Dark mode

The existing dark tokens are correct in structure. Recommended tightening:

| Token | OKLCH | Hex |
|---|---|---|
| `--color-surface` | `oklch(17% 0.010 80)` | `#242019` |
| `--color-surface-2` | `oklch(20% 0.010 80)` | `#2C271F` |
| `--color-surface-3` | `oklch(24% 0.010 80)` | `#363028` |
| `--color-text` | `oklch(96% 0.005 80)` | `#F5F2ED` |
| `--color-text-muted` | `oklch(68% 0.012 80)` | `#A9A198` |
| `--color-border` | `oklch(30% 0.012 80)` | `#48413A` |
| `--color-border-soft` | `oklch(26% 0.010 80)` | `#3D3730` |
| `--color-accent` | `oklch(68% 0.16 245)` | `#5D93E0` |
| `--color-accent-tint` | `oklch(28% 0.06 245)` | `#20365E` |

Dark mode is a nice-to-have. **Print always renders in light mode**, regardless of the user's setting.

---

### 2.2 Typography

**Font family.** `Inter Variable` (self-hosted via `next/font/local` or `@fontsource-variable/inter`). Optical-size axis on, weight axis on. Fallback stack:

```css
--font-sans: 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace;
```

**Why Inter, not GT Walsheim / GT America / Söhne / ABC Diatype.** All of those are licensed and cost several thousand dollars per year for a product deployment. Inter matches this reference set aesthetically (Rippling, Toggl, Clockify all ship with Inter), is free under OFL, and has the OpenType features we need (tabular numerals, slashed zero, alternate 1). QuickBooks Time uses Intuit Sans; BambooHR uses Proxima Nova; both look effectively identical to Inter at UI sizes.

**OpenType features to enable globally on body text:**

```css
body {
  font-feature-settings:
    'cv11' 1,  /* alternate single-story a - subtle, more modern */
    'ss01' 1,  /* open digits (0 4 6 9) */
    'ss03' 1,  /* rounded quotes */
    'kern' 1;
  font-variant-numeric: proportional-nums;
  font-optical-sizing: auto;
}
```

**Numeric handling.** On any element containing numbers that align in a column (all table cells, all KPI values, all totals, all dates in `YYYY-MM-DD` form), switch to tabular numerals and slashed zero:

```css
.tabular {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: 'tnum' 1, 'zero' 1;
}
```

Every `<td>` in every table gets this. Every `.kpi-value` gets this. Every date column, hour column, amount column, and time column gets this.

#### Type scale

Base is 16 px = 1 rem. Line-heights are absolute (not multipliers) for pixel-perfect vertical rhythm.

| Token | Size | Line-height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | 40 px / 2.5 rem | 48 px | 600 | `-0.02em` | Marketing / login title only |
| `h1` | 28 px / 1.75 rem | 36 px | 600 | `-0.015em` | Page title |
| `h2` | 22 px / 1.375 rem | 28 px | 600 | `-0.01em` | Section title |
| `h3` | 18 px / 1.125 rem | 24 px | 600 | `-0.005em` | Card title |
| `h4` | 15 px / 0.9375 rem | 20 px | 600 | `0` | Small heading (e.g. inside side panel) |
| `body-lg` | 16 px / 1 rem | 24 px | 400 | `0` | Long-form text — help, empty-state description |
| `body` | 14 px / 0.875 rem | 20 px | 400 | `0` | Default UI text |
| `body-strong` | 14 px | 20 px | 500 | `0` | Emphasized body |
| `body-sm` | 13 px | 18 px | 400 | `0` | Table cells, form help text |
| `caption` | 12 px | 16 px | 500 | `0.005em` | Labels above inputs, timestamps |
| `micro` | 11 px | 14 px | 500 | `0.02em` | Uppercase category tags in prints, chart axis |

**Weights used.** 400 (Regular), 500 (Medium), 600 (Semibold). Do not use 700+ in the UI — feels heavy against the warm palette. 300 and lighter are reserved for the login/marketing surface if we build one.

**Recommendation vs common practice.** Rippling and BambooHR use 15 px for body; Ramp and Brex use 14 px. **We use 14 px** for interior UI and 15–16 px only for long-form help and dashboard summary copy. Rationale: this app is table-heavy, and 14 px preserves scan-density without cramping.

**Numeric weight rule.** Numbers in KPI tiles use `500`, not `600`. At large sizes (24 px+), semibold digits become visually heavier than semibold letters — a known Inter quirk.

---

### 2.3 Spacing and layout

**Base unit: 4 px.** All spacing derives from this.

| Token | Value | Common use |
|---|---|---|
| `space-0` | 0 | — |
| `space-0-5` | 2 px | Icon-to-text nudge |
| `space-1` | 4 px | Tight inline gap |
| `space-1-5` | 6 px | Pill inner padding |
| `space-2` | 8 px | Button icon gap, dense form gap |
| `space-3` | 12 px | Row gap in a form column |
| `space-4` | 16 px | Card body padding (compact) |
| `space-5` | 20 px | Card body padding (default) |
| `space-6` | 24 px | Section spacing (dense) |
| `space-8` | 32 px | Section spacing (default) |
| `space-10` | 40 px | Large section |
| `space-12` | 48 px | Page section rhythm |
| `space-16` | 64 px | Between major page regions |

#### Container widths

| Width | Value | Usage |
|---|---|---|
| `container-narrow` | 720 px | Single-form pages (vacation request, add expense) |
| `container-default` | 1120 px | Dashboard, most admin pages |
| `container-wide` | 1440 px | Timesheet weekly grid, reports |
| `container-full` | 100% – 32 px | Only for full-bleed data grids (rare) |

Container centering: `margin-inline: auto; padding-inline: 24px;` on all breakpoints ≥ 768 px. Below 768 px, `padding-inline: 16px`.

#### Sidebar and header

- **Sidebar width:** 240 px (default), 64 px (collapsed icon-only). Not 280+ — the reference set skews narrower.
- **Header height:** 56 px. Every reference: 48–64 px range. 56 px is Ramp/Gusto.
- **Sidebar row height:** 36 px. 32 px feels too dense against 14 px text.
- **Sidebar section spacing:** 24 px between groups, 8 px between items within a group.

#### Vertical rhythm on a page

Every content page follows this rhythm:

```
Header (56 px, sticky)
Content padding-top: 24 px
Page title (h1) + subtitle
Content padding-bottom of title block: 24 px
Section 1
32 px
Section 2
32 px
...
Bottom padding: 48 px
```

---

### 2.4 Radius, elevation, motion

#### Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4 px | Pills, tags, small chips |
| `radius-md` | 6 px | Buttons, inputs, small cards |
| `radius-lg` | 8 px | Cards, panels, modals |
| `radius-xl` | 12 px | Large hero cards (rare in this app) |
| `radius-full` | 9999 px | Avatars, status dots |

**Note vs current tokens.** The existing `--radius: 8px` is a bit round for buttons and inputs at 40 px height — bring buttons to 6 px, keep cards at 8 px. Ramp uses 4–6 px; Gusto uses 6–8 px; Harvest uses 8 px. 6 px is the sweet spot for our button size.

#### Elevation

We use **borders more than shadows.** Shadows are reserved for elements that float above the page (popovers, modals, dropdowns, sticky toolbars). Cards get a 1 px border, not a shadow.

| Token | Value | Usage |
|---|---|---|
| `shadow-none` | `none` | Cards, most surfaces |
| `shadow-xs` | `0 1px 2px oklch(20% 0.02 80 / 0.05)` | Sticky bottom toolbar |
| `shadow-sm` | `0 2px 4px oklch(20% 0.02 80 / 0.06), 0 1px 2px oklch(20% 0.02 80 / 0.04)` | Dropdown, popover |
| `shadow-md` | `0 8px 16px oklch(20% 0.02 80 / 0.08), 0 2px 4px oklch(20% 0.02 80 / 0.06)` | Side panel, modal |
| `shadow-lg` | `0 20px 40px oklch(20% 0.02 80 / 0.12), 0 4px 8px oklch(20% 0.02 80 / 0.06)` | Command palette (if we ever ship one) |

Anti-pattern: floaty drop-shadows on every card, gradient shadows, colored shadows. Not this system.

#### Motion

| Token | Value | Usage |
|---|---|---|
| `duration-instant` | 80 ms | Focus, hover color |
| `duration-fast` | 120 ms | Button press, checkbox toggle, chip hover |
| `duration-normal` | 200 ms | Popover open, dropdown, tab switch |
| `duration-slow` | 280 ms | Side panel slide-in, modal fade |
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Enter animations |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exit animations |
| `ease-inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | Reserve for spatial transitions only |

**Motion rule.** Motion clarifies causality — it should never delay work. No spinner-first empty states, no shimmer skeletons on tables that load in < 200 ms, no bouncy easing anywhere. If a user hits Approve, the row updates in < 120 ms and the toast slides in from the bottom over 200 ms with `ease-out`. That's it.

**Reduced motion.** Respect `prefers-reduced-motion: reduce`. Replace all transitions with `duration: 0` and disable side-panel slide (fade instead).

---

## 3. Components

Component specs are visual — not code. Reference `shadcn/ui` and Base UI components as the underlying implementation.

### 3.1 Buttons

#### Variants

| Variant | Bg | Text | Border | Usage |
|---|---|---|---|---|
| **Primary** | `--color-accent` | `--color-accent-fg-on-accent` | none | The one primary action on the screen |
| **Secondary** | `--color-surface` | `--color-text` | 1 px `--color-border-strong` | Secondary actions, cancels |
| **Ghost** | `transparent` | `--color-text` | none | Toolbar buttons, table row actions |
| **Destructive** | `--color-surface` | `--color-danger` | 1 px `--color-danger` at 30% alpha | Delete, remove — never the primary CTA |
| **Link** | `transparent` | `--color-accent` | none, underline on hover | Inline text CTAs |

#### Sizes

| Size | Height | Padding-x | Font | Icon size | Where |
|---|---|---|---|---|---|
| **sm** | 32 px | 12 px | 13 px / 500 | 14 px | Table row actions, filter chips |
| **md** | 40 px | 16 px | 14 px / 500 | 16 px | Default — admin toolbars, most CTAs |
| **lg** | 48 px | 20 px | 15 px / 500 | 18 px | Employee-facing primary CTA (Send for approval) |

- **Rule:** admin work uses **md**. Employee weekly CTA uses **lg** to make the once-a-week action obvious.
- **Border-radius:** 6 px (all sizes).
- **Icon placement:** leading for verbs ("+ Add entry"), trailing for navigational actions ("Open →"). Icon-only buttons must have `aria-label`.

#### States

- **Default:** as above.
- **Hover:** Primary → `--color-accent-hover`. Secondary → bg `--color-surface-2`. Ghost → bg `--color-surface-2`. Destructive → bg at `--color-danger` 6% alpha.
- **Active/pressed:** darker still — `--color-accent-active` for primary. Transitions on hover/active are 80 ms.
- **Focus-visible:** 2 px `--color-accent` ring, 2 px offset, no rounded ring style breaks. Never remove focus rings.
- **Disabled:** opacity 0.5, `cursor: not-allowed`, no hover state. Prefer *never disabling submit buttons* — instead, disable the input causing the issue and show inline validation.
- **Loading:** replace the text with a 14 px monochrome spinner + optional muted label ("Sending…"). Do not disable — button stays clickable but shows the spinner, and second-click is a no-op.

---

### 3.2 Form fields

#### Text input

- **Height:** 40 px (default), 32 px (sm — filters and inline table edits only).
- **Padding-x:** 12 px.
- **Border:** 1 px `--color-border`. On focus: 1 px `--color-accent` + 2 px `--color-accent-tint` ring (offset 0).
- **Radius:** 6 px.
- **Background:** `--color-surface`. On focus: same. On disabled: `--color-surface-2`.
- **Placeholder:** `--color-text-subtle`. **Placeholder is not a label.** Every input has a persistent label above it.

#### Label position

**Top-aligned, always.** Left-aligned labels are common in older enterprise apps (Concur, older Rippling) and dated. Every reference we approve of — Gusto, Ramp, Brex, BambooHR modern — uses top-aligned labels.

```
Label (caption, 12 px, 500 weight, muted-ish text)
[  input                                              ]
Help text or error (12 px, muted)
```

- Space between label and input: 6 px.
- Space between input and help/error: 6 px.
- Space between fields: 20 px vertical.

#### Validation

- **Inline on blur** for individual fields (`Not a valid date.`).
- **On submit** for cross-field errors (`Total hours are more than a week.` at the top of the form).
- Error text color: `--color-danger`. Input border shifts to `--color-danger` at 60% alpha.
- **Never turn the input background red.** Warm palette + red backgrounds fights.

#### Select / dropdown

- Same height and padding as text input.
- Trailing chevron icon, 16 px, `--color-text-muted`.
- Open state uses Base UI popover with `shadow-sm`, `radius-md`, `--color-surface` bg, 1 px `--color-border`.
- Selected option gets `--color-accent-tint` bg + `--color-accent` fg check mark trailing.
- Search inside long selects (project code lists) — top of popover, autofocus.

#### Date picker

- Use a compact popover calendar (Base UI or `react-day-picker`).
- Input format: `Jul 8, 2026` on display; on focus, the input is editable as `MM/DD/YYYY` for keyboard warriors.
- Today is a filled `--color-accent-tint` circle with `--color-accent` text.
- Selected date: filled `--color-accent` circle, white text.
- Range selection (vacation): endpoints filled, middle in `--color-accent-tint`.

#### Textarea

- Min-height 88 px, resize vertical only.
- Same border/radius/focus as text input.
- Character counter on the bottom-right of the field when a maxlength is set, muted, only visible when > 75% full.

---

### 3.3 Tables (the core surface of this app)

Every timesheet, expense, and approval view is a table. The whole product's polish depends on getting this right.

#### Row height

- **Default:** 44 px.
- **Dense (admin toggle):** 40 px.
- **Comfortable (never used by default, only for print):** 48 px.

Row height is applied via `min-height` on the row, not fixed height — this lets a description column wrap if the user pastes multi-line content.

#### Cell padding

- **Horizontal:** 12 px.
- **Vertical:** 10 px (default), 8 px (dense).
- First cell: `padding-left: 20px` (aligns with page content edge).
- Last cell: `padding-right: 20px`.

#### Header

- Row height: 40 px (fixed).
- Background: `--color-surface-2`.
- Border-bottom: 1 px `--color-border`.
- Text: `caption` scale (12 px / 500) in `--color-text-muted`, sentence case.
- Sortable columns show a small chevron on hover; active sort direction shown with filled chevron.
- Sticky by default when the table exceeds the viewport.

#### Row treatment

- **No zebra striping.**
- Row divider: `border-bottom: 1px solid var(--color-border-soft)`.
- **Hover:** background `--color-surface-2`. Transition 80 ms.
- **Selected (checkbox row):** background `--color-accent-tint`, left border `2 px solid --color-accent` (inside a 2px inset — do not shift row width).
- **Focused row (keyboard):** 2 px `--color-accent` outline offset -2 px.

#### Column: Amount / Hours

- Right-aligned.
- Tabular numerals.
- Whole dollars have no trailing `.00`. If a column mixes whole and fractional dollars, show `.00` on the whole ones for alignment — but only in an accountant-facing table.

#### Column: Status

- Pill only, no other treatment.
- Left-aligned within its cell.
- Column width: fits the widest label ("Submitted") + 24 px.

#### Column: Actions (last column)

- Right-aligned.
- Icon-only ghost buttons when there's a single common action per row.
- If there are multiple actions, use a "…" menu button that opens a Base UI menu.
- Actions are *hidden until row hover* on desktop, always visible on mobile.

#### Empty state within a table

- Show a single row spanning all columns, centered content.
- 88 px tall.
- Small 20 px icon in `--color-text-subtle`, then a body-sm line, then optional secondary CTA button.
- Example: `[icon] No entries for this week yet. [+ Add entry]`

#### Pinned totals

- The weekly timesheet grid pins a "Total" row at the bottom of the table.
- Background: `--color-surface-2`.
- Border-top: 1 px `--color-border-strong` (heavier than row dividers).
- Font weight: 600 in the label cell, tabular 500 in the numeric cells.
- Sticky on scroll in tall grids.

---

### 3.4 Cards

**When to use a card:**
- Contains an actionable thing that could stand alone (e.g., the "Vacation balance" summary with a Request button).
- Summarizes a group of related metadata (e.g., an expense report header with employee + date + total).
- Wraps a self-contained form (e.g., add-expense form on its own page).

**When NOT to use a card:**
- To wrap every section of the page (this creates a "boxes inside boxes" look — the anti-pattern from older enterprise apps).
- Around the main data table (the table already has its own container by virtue of its header + rows).

#### Structure

```
┌─────────────────────────────────┐
│ Header (optional)               │  ← 16 px padding, border-bottom 1px --color-border-soft
├─────────────────────────────────┤
│                                 │
│ Body                            │  ← 20 px padding
│                                 │
├─────────────────────────────────┤
│ Footer (optional)               │  ← 16 px padding, border-top 1px --color-border-soft
└─────────────────────────────────┘

Background: --color-surface
Border: 1 px --color-border-soft
Border-radius: 8 px
Shadow: none
```

- Cards do **not** float. They sit on the page background.
- Card headers use `h3` scale (18 px / 600) with an optional right-aligned action link.

---

### 3.5 KPI / summary tiles

Reserved for the top of dashboard/report pages. Never on the timesheet entry page — that's the weekly grid's job.

#### Single hero KPI (rare)

- Used only for a page whose entire purpose is one number (e.g., "Vacation balance" page).
- Value: 40 px / 500 weight, tabular.
- Label above value: `caption` (12 px / 500, muted, uppercase optional).
- Sub-label below (context): `body-sm` muted.
- No delta indicator (this is an internal HR app — deltas are noise).

#### KPI strip (default)

- Row of 3–4 tiles at the top of admin dashboard.
- Tile height: auto (typically ~96 px).
- Card treatment (border, no shadow).
- Value: 28 px / 500 weight, tabular.
- Label: `body-sm` muted, above value.
- Optional inline hint: `caption` muted, below value.

Example admin dashboard strip:

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Waiting on you│  │ Approved this │  │ Declined this │  │ Total hours   │
│ 4             │  │ week          │  │ week          │  │ this week     │
│ timesheets    │  │ 12            │  │ 1             │  │ 484 h         │
└───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘
```

**Anti-pattern:** don't add sparklines, delta pills, or trend arrows to these tiles unless there is a genuine question being answered by the trend. In an internal timesheet app, there usually isn't.

---

### 3.6 Approval flow (this is the marquee interaction)

Modeled after Ramp and Gusto's approval UX.

#### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Approvals                                                                    │
│ 4 timesheets · 2 expense reports · 1 vacation                                │
│                                                                              │
│ ┌─── Inbox list (60% width) ─────┐  ┌── Side panel (40%, min 480px) ────┐  │
│ │ ☐ Maaz · Jul 6–12 · 46 h    →│  │ Maaz Ahmed                         │  │
│ │ ☐ Utsav · Jul 6–12 · 40 h   →│  │ Jul 6 – Jul 12 · 46 h · Submitted  │  │
│ │ ☐ Ali · Jul 6–12 · 41 h     →│  │                                    │  │
│ │ ☐ Sara · Jul 6–12 · 39 h    →│  │ [Weekly grid preview, read-only]   │  │
│ │                              │  │                                    │  │
│ │                              │  │ [ Approve ]  [ Send back ]         │  │
│ └──────────────────────────────┘  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Side panel slides in from the right (`translateX(100%) → 0`, 280 ms, `ease-out`).
- Clicking a row in the inbox loads it into the panel in-place (no navigation).
- Selected row in the inbox: `--color-accent-tint` bg + 2 px `--color-accent` left border.
- Panel has its own scroll; page background stays fixed.
- Close button (X icon) top-right of the panel, 40 px hit area.

#### Approve / Send back

- **Approve** — primary button, md size, `--color-accent` bg. Instant action, no confirmation modal. Toast: `Approved. Undo` — 5 s.
- **Send back** — secondary button, md size, opens a modal (this is the one place we use a modal, because typing is involved).
- Modal:
  - Title: `Send this back to Maaz?`
  - Textarea: labeled `Reason` with placeholder from `BRAND.md § 6.4`
  - Confirm button: `Send back`
  - Cancel button: `Keep reviewing`

#### Bulk actions

- Checkbox column appears when the user hovers the list (or is always visible on touch).
- Once any row is checked, a sticky bottom toolbar slides up:

```
┌────────────────────────────────────────────────────────────┐
│ 3 selected  [ Approve 3 ]  [ Send back… ]  [ Deselect ]    │
└────────────────────────────────────────────────────────────┘
```

- Toolbar height 56 px, background `--color-surface`, top-border 1 px `--color-border`, `shadow-xs`.
- Approve button in the toolbar is primary and counts the selection.
- Send-back on multiple rows opens a modal that requires a single reason applied to all.

---

### 3.7 Navigation

#### Left sidebar

- Width: 240 px (default). Collapsible to 64 px (icon-only) via a header toggle. Collapse state persisted per user.
- Background: `--color-surface` (same as page). *Not* a darker tinted rail — that's the old-guard SharePoint move.
- Border-right: 1 px `--color-border-soft`.
- Top: 16 px logo area (SRE wordmark, see `BRAND.md § 5.2`).
- Then a 16 px gap.
- Nav sections, in order for an admin:
  1. **Home** — dashboard
  2. **Timesheets** — my week, all weeks (past)
  3. **Expenses** — my expenses, all expenses
  4. **Vacation** — my balance, request history
  5. — divider —
  6. **Approvals** *(admin only)* — timesheets, expenses, vacation (each with a count badge)
  7. **Reports** *(admin only)*
  8. **People** *(admin only)*
  9. — divider —
  10. **Settings**

For an employee: same list minus the admin sections.

#### Nav item

- Height: 36 px.
- Padding: 8 px horizontal + 16 px inset from sidebar left.
- Icon: 18 px, monochrome, `--color-text-muted` when inactive.
- Label: `body` (14 px / 500 when active, 400 when inactive).
- Radius: 6 px.
- **Active state:** background `--color-accent-tint`, text `--color-accent`, icon `--color-accent`. Left border indicator: 2 px `--color-accent`, height 20 px, inset 6 px vertically (looks like a subtle vertical bar next to the row).
- **Hover:** background `--color-surface-2`, no color change on text/icon.
- **Badge (count):** small rounded-full pill, height 18 px, `body-sm` (11 px), `--color-accent` on `--color-accent-tint-strong`. Right-aligned in the row.

#### Header (56 px)

- Contents: page breadcrumb / title on the left; global search (optional, ⌘K), notifications bell, and user avatar on the right.
- Background: `--color-surface`.
- Border-bottom: 1 px `--color-border-soft`.
- User menu opens a popover with: name, email, "Switch to admin view" (if user has both roles), Settings link, Sign out.

#### Breadcrumbs / page title

- On most pages, no breadcrumb. Just the page title as `h1`.
- Sub-pages (e.g., a specific historical week) show a small back link above the title: `← All weeks`, in `caption` scale muted.

---

### 3.8 Empty states

- No illustration. Single monochrome icon 24 px in `--color-text-subtle`.
- Below icon (8 px gap): title in `h3` scale.
- Below title (6 px gap): description in `body` muted.
- Below description (16 px gap): one CTA button (primary or secondary depending on context).
- Overall padding: 48 px top/bottom, centered.

**Example:**
```
              [ 📄 icon ]
       New week. Add your first entry.
   Log the hours you worked this week — you can
   save as a draft and send it whenever you're ready.

              [ + Add entry ]
```

Copy patterns from `BRAND.md § 4.4`.

---

### 3.9 Toasts and status banners

#### Toasts

- Position: bottom-center on desktop, bottom-full-width on mobile.
- Max width: 400 px.
- Padding: 12 px 16 px.
- Radius: 8 px.
- Background: `--color-text` at 95% opacity (dark toast on light page).
- Text: `--color-surface`, `body-sm` (13 px / 500).
- Duration: 5 s (with pause on hover). Undo actions get 8 s.
- Only one toast at a time; new ones replace old.
- Enter animation: slide up 12 px + fade in, 200 ms.

#### Banners (persistent, inline)

Used for page-level state (locked week, declined week).

- Full-width across the content region.
- Padding: 12 px 16 px.
- Left icon 18 px in the semantic color.
- Text: `body`.
- Optional right-aligned action button.
- Radius: 6 px.
- Border: 1 px, background: matching tint.

| Variant | Border | Bg | Icon color | Icon |
|---|---|---|---|---|
| info | `--color-accent` 30% | `--color-accent-tint` | `--color-accent` | ⓘ |
| success | `--color-success` 30% | approved bg | `--color-success` | ✓ |
| warning | `--color-warning` 30% | overtime bg | `--color-warning` | ⚠ |
| declined | `--color-status-declined-fg` 30% | declined bg | declined fg | ↩ |

---

### 3.10 Icons

- **Library:** Lucide (`lucide-react`).
- **Stroke width:** 1.75 (default in Lucide is 2 — 1.75 pairs slightly better with 14 px Inter body).
- **Sizes:** 14 / 16 / 18 / 20 / 24 px. In tables: 16 px. In sidebar: 18 px. In empty states: 24 px.
- **Color:** monochrome, matches surrounding text color at the same opacity. Never colored icons except for status pills.
- Never mix icon libraries. If Lucide doesn't have it, we don't need it.

---

### 3.11 Data visualization (reports pages)

The app has light reporting needs (utilization %, hours by category, expense totals by month). No dashboards-by-numbers, no dashboards-of-decorative-charts.

- **Library:** Recharts or Visx. Prefer Recharts for speed of implementation.
- **Chart types allowed:** bar, stacked bar, line. No pies. No radar. No area charts stacked more than 3 categories.
- **Category color mapping:** Project = Project blue, Admin = Admin amber, Office & Sales = Office green (see § 2.1). Overtime uses the overtime tint. That's the entire chart palette.
- **Axes and gridlines:** `--color-border-soft` 1 px gridlines, `--color-text-subtle` axis labels in `caption`.
- **Tooltips:** popover treatment (`shadow-sm`, `radius-md`), tabular numerals.
- **Legends:** below chart, dot + label in `body-sm`.
- No animations on chart entry beyond a 200 ms fade.

---

## 4. Patterns

### 4.1 Approval workflow (admin)

Step-by-step:

1. Admin lands on `/approvals`. Header: `Approvals · 4 timesheets · 2 expenses · 1 vacation`.
2. Tabs (or segmented control) below: `Timesheets (4) · Expenses (2) · Vacation (1)`. Default to the largest queue.
3. Inbox list on the left (60% width) shows one row per pending item: employee name, period, total, timestamp submitted.
4. Clicking a row opens the side panel on the right with the full read-only preview.
5. Panel footer holds `Approve` (primary) and `Send back` (secondary).
6. Approve → row disappears from inbox, toast `Approved. Undo` for 5 s. Undo restores the row and reverts approval.
7. Send back → modal, textarea for reason, `Send back` button. On confirm, row disappears from inbox, toast `Sent back to Maaz.`
8. When inbox is empty: `You're all caught up.` — no CTA.

**Keyboard:**
- `j` / `k` — next / previous row.
- `Enter` — open selected row in the panel.
- `a` — approve current.
- `d` — open send-back modal.
- `Esc` — close panel.

### 4.2 Weekly timesheet entry (employee)

1. Employee lands on `/week/current`. Title: `This week · Jul 6 – Jul 12`. Status pill next to title: `Draft`.
2. Below the title, right-aligned: `Draft saved · 9:14 AM`, a save indicator that updates on every blur.
3. Weekly grid: rows are entries (Project + Category + Description + 7 day columns + Total). New week starts empty with a "+ Add entry" row.
4. Adding a row: click `+ Add entry`. A new row inserts with the Project selector auto-focused.
5. Numeric cells accept `1`, `1.5`, `1h30m`, `1:30`. All normalize to decimal hours on blur.
6. Row total updates live. Week total (pinned footer) updates live.
7. Overtime nudge appears inline (not a modal) when week total > 40 h.
8. Primary CTA at bottom of the page: `Send for approval` (lg size, wide). Secondary link: `Save and finish later`.
9. After sending: page reloads to a read-only view with `Submitted` status pill and a banner explaining the lock.

### 4.3 Expense submission

1. Employee lands on `/expenses`. Sees a list of their expenses this period + a `+ Add expense` button.
2. Add expense opens a right-side panel form (720 px wide on wide screens, full-screen on mobile).
3. Fields: Date, Category, Vendor, Amount, Description, Receipt attachment.
4. Save button in the panel footer: `Add expense`. Second click needed at the report level to submit for approval.
5. Once expenses are added, employee clicks `Send report for approval` at the top of the expense list.

### 4.4 Print / PDF export

Print is a first-class surface — reports get printed for the audit binder.

**Print stylesheet rules:**
- Hide: sidebar, header, all interactive controls (buttons, filters, action columns), toasts, banners marked `.print-hidden`.
- Show: page title, subtitle, all data tables, totals, approval metadata (approver name + date).
- Convert: all pill status colors to a printable variant with a border rather than a fill (color printing is inconsistent — borders survive B&W).
- Type: bump body from 14 px to 12 px to fit more per page. Bump table headers from 12 px to 10 px uppercase.
- Header (repeats per page): `Sulfur Recovery Engineering · Timesheet · Jul 6 – 12, 2026`.
- Footer (repeats per page): `Approved by Talha Khan on Jul 8, 2026 · Signed electronically · Page N of M`.
- Force `color-adjust: exact` on status pills so they print in color when available.
- Force page-break rules: `table { page-break-inside: auto }`, `tr { page-break-inside: avoid }`.
- Margins: `@page { margin: 20mm 15mm; }`.

---

## 5. Accessibility

- **Color contrast:**
  - Body text on surface: 4.5:1 minimum. `--color-text` on `--color-surface` = ~14:1. ✓
  - Muted text on surface: 4.5:1 minimum. `--color-text-muted` on `--color-surface` = ~5.2:1. ✓
  - Large text (≥ 18 px or 14 px bold): 3:1 minimum.
  - Status pills: fg on tinted bg checked to 4.5:1 for each pair. Test approved and declined especially.
  - Focus ring on any background: 3:1 against the surface behind it. `--color-accent` on `--color-surface` = 4.9:1. ✓
- **Focus ring:** always visible, 2 px `--color-accent`, 2 px offset, radius matches the element. Never `outline: none` without a replacement.
- **Keyboard navigation:**
  - Tab order follows visual order.
  - Every interactive element reachable by keyboard.
  - Modals and side panels trap focus and return focus on close.
  - Escape closes any dismissible overlay.
- **ARIA:**
  - Toasts use `role="status"` (not `alert` — alerts interrupt screen readers).
  - Errors on form fields use `aria-invalid` + `aria-describedby` pointing at the error message.
  - Icon-only buttons have `aria-label`.
  - Tables use `<th scope>` for header cells; status pills include the status word in text (not just color).
- **Reduced motion:** at `prefers-reduced-motion: reduce`, disable all transforms and slides; fades reduce to `opacity` transitions of 80 ms max.
- **Zoom / reflow:** all layouts must reflow to 320 px viewport width without horizontal scrolling (except tables — see § 6).

---

## 6. Mobile considerations

The primary surface is desktop. Mobile is for approvals-on-the-go and quick timesheet check-ins — not full data entry.

- **Must work on mobile:**
  - Login
  - Employee dashboard (view this week's status)
  - Approvals inbox (admins approving from their phone)
  - Vacation request
  - Notification links (deep-linked from an email to a specific week)
- **Nice to have:**
  - Add expense with photo receipt attachment
- **Doesn't need to work well on mobile:**
  - Weekly timesheet grid entry (too dense — direct users to desktop)
  - Reports
  - People management

**Touch targets:** 44 × 44 px minimum for all controls.

**Sidebar → drawer.** Below 1024 px, the sidebar collapses to a hamburger drawer.

**Table → card transformation.** Below 768 px, `<table>` layouts convert to a stack of cards, one per row, where columns become label/value pairs:

```
Desktop row:
| Maaz Ahmed | Jul 6 – 12 | 46 h | Submitted | → |

Mobile card:
┌────────────────────────────┐
│ Maaz Ahmed                 │
│ Jul 6 – 12  ·  46 h        │
│ [Submitted]                │
│ [ Review → ]               │
└────────────────────────────┘
```

The transformation is CSS-driven (`display: block` on table cells + `data-label` attributes), not a separate mobile template — so the source of truth stays one component.

**Approve on mobile.** The side panel becomes a full-screen sheet from the bottom. Approve/Send-back buttons sit in a sticky footer that respects the safe area inset.

---

## 7. Implementation notes

- **Framework alignment:** shadcn/ui components are the substrate. Base UI components from `@base-ui-components/react` are used for headless primitives (Popover, Dialog, Menu, Tabs) where shadcn's Radix wrapper falls short. Do not introduce a third headless library.
- **Tailwind v4:** define the tokens above as `@theme` in the global stylesheet. Do not use arbitrary color values in components — always reference a token.
- **Component locations:** live in `web/components/ui/*` for the shadcn primitives, and `web/components/[surface]/*` for surface-specific (timesheet, expenses, approvals) components.
- **Storybook or Ladle:** not required for this codebase — the surface count is small. Instead, maintain a single `/design/preview` route in dev that renders every component in every state.
- **Motion:** use CSS transitions for state changes. Reserve Framer Motion for the side panel slide (already justified) and any future scroll-linked animation — nothing else.

---

## 8. References consulted

Where public docs were fetchable, values are cited. Where fetches were blocked (most vendor sites return 403 to automated agents), values are drawn from widely available product screenshots on G2/Capterra/YouTube demos and cross-referenced with published brand guidelines.

**HR / payroll:**
- BambooHR — https://www.bamboohr.com (marketing + product screenshots on the homepage feature strip)
- Gusto — https://gusto.com (product tour images and press-kit references)
- Rippling — https://www.rippling.com (product tour)
- Justworks — https://www.justworks.com
- Deel — https://www.deel.com
- Paylocity — https://www.paylocity.com
- Zoho People — https://www.zoho.com/people
- Paychex Flex, Paycom, ADP Workforce Now — via G2 galleries

**Timesheet / time-tracking:**
- QuickBooks Time — https://quickbooks.intuit.com/time-tracking
- Harvest — https://getharvest.com
- Toggl Track — https://toggl.com/track
- Clockify — https://clockify.me
- When I Work — https://wheniwork.com
- Homebase — https://joinhomebase.com
- Replicon — https://www.replicon.com

**Expense:**
- Ramp — https://ramp.com (product screenshots via marketing site + Ramp brand guide references)
- Brex — https://brex.com
- Expensify — https://use.expensify.com
- SAP Concur — https://www.concur.com

**Industrial adjacent:**
- Procore — https://procore.com
- Autodesk Build — https://construction.autodesk.com/products/autodesk-build

**Tooling and font references (fetched):**
- Inter font features — https://rsms.me/inter/
- Tailwind color palette — https://tailwindcss.com/docs/customizing-colors (source of the OKLCH values referenced above)

**Existing app:**
- `web/styles/tokens.css` — current Notion-warm token set, used as the starting point.
