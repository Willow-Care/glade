# Willow Care — Brand & Site Reference

The **Willow Care** marketing site: a static HTML/CSS/JS site (no build step)
that positions Willow Care as the organization and **Willow** as its product.
Tokens below are the source of truth for `tokens.css`; the pages consume them
via CSS custom properties.

## Pages

| File | What it is |
|---|---|
| `index.html` | Org landing page (hero, pillars, vision, CTA) |
| `genesis.html` | Origin story |
| `willow/index.html` | Willow product page |
| `willow/pricing.html` | Plans → hand off to the app (`willow.willowcare.app`) |

Styling: `tokens.css` (variables + reset) → `fonts.css` → `home.css` /
`genesis.css` / `willow/*.css`. Behavior: `home.js`, `genesis.js`,
`willow/*.js`.

## Colors

| Name | Var | Hex | Use |
|---|---|---|---|
| Dark Spruce | `--spruce` | `#365136` | Primary ink, headings, deep accents |
| Hunter Green | `--hunter` | `#426542` | Primary CTA / accent |
| Hunter (hover) | `--hunter-dim` | `#395839` | Hover state for hunter |
| Mint Cream | `--mint` | `#E6EDE6` | Soft section tint |
| Porcelain | `--porcelain` | `#F4F7F4` | Alt section background |
| Bright Snow | `--snow` | `#FAFAF9` | Page background |
| White | `--white` | `#FFFFFF` | — |
| Alabaster Grey | `--alabaster` | `#E7E5E4` | Hairlines, borders |

**Derived text/ink** — `--ink` `#25352A` (body), `--ink-soft` `#5B6B60`
(secondary), `--ink-faint` `#8A968D` (tertiary/placeholder), `--ring`
`rgba(66,101,66,0.35)` (focus ring).

## Type

- **Playfair Display** (italic 400/600, normal 400/600/700) — headlines (`--font-display`)
- **DM Sans** (300/400/500/600, + italic 400) — body and UI (`--font-body`)
- **DM Mono** (400/500) — eyebrows, labels, timestamps, data (`--font-mono`)

A fluid type scale (`--step--1` … `--step-5`), spacing scale
(`--space-xs` … `--space-2xl`), radii, shadows, and easing/duration tokens
also live in `tokens.css`. Motion respects `prefers-reduced-motion`.

## Design motifs

- **Eyebrow** labels: mono, uppercase, tracked, with a short leading rule.
- **Stem divider** (`.stem-divider`): a thin vertical "growth" line with a
  hunter-green node — the recurring leaf/growth motif, used sparingly.
