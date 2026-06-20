# Willow Care — Marketing Site

A responsive, animated landing site for Willow Care, built with vanilla HTML, CSS, and JS (no build step required).

## Structure

```
Willow Care/
├── assets/              ← drop your logo PNGs here (see "Logo" below)
├── css/
│   └── willow/
│       ├── fonts.css     Self-hosted @font-face rules (DM Mono, DM Sans, Playfair Display)
│       ├── tokens.css    Design tokens: color, type scale, spacing, motion
│       ├── home.css      Homepage + shared nav/footer styles
│       └── genesis.css   "Our story" page styles
├── html/
│   └── willow/
│       ├── index.html    Landing page
│       └── genesis.html  "Our story" page (from your Genesis doc)
├── js/
│   └── willow/
│       ├── home.js       Expanding nav panel, mobile drawer, scroll reveals
│       └── genesis.js    Scroll-spy table of contents
└── README.md
```

The empty `css/care`, `html/care`, and `js/care` folders are left in place for the future Willow Care *product* app (as opposed to this marketing site), matching your existing repo layout.

## Open it locally

No build tools needed — just open `html/willow/index.html` directly in a browser, or serve the folder:

```
cd "Willow Care"
python3 -m http.server 8000
```

Then visit `http://localhost:8000/html/willow/index.html`.

## Logo

The nav and footer currently use an inline SVG leaf mark as a placeholder so the page works standalone. To swap in your real logo:

1. Add `Willow Care Logo.png` (and/or `Willow Care Logo + Title.png`) to `assets/`.
2. In `index.html` and `genesis.html`, replace the `<svg class="mark">...</svg>` block(s) with:
   ```html
   <img class="mark" src="../../assets/Willow Care Logo.png" alt="">
   ```

## Key interactions

- **Products nav panel** — click "Products" in the nav; it expands downward (CSS Grid `0fr → 1fr` transition) to reveal product cards, including a "Willow for Agencies" placeholder for your next app.
- **Mobile drawer** — below 760px, the hamburger opens a full-screen nav drawer.
- **Scroll reveals** — sections fade/rise in via `IntersectionObserver` as you scroll (respects `prefers-reduced-motion`).
- **Scroll-spy TOC** — on the "Our story" page, the sticky sidebar highlights the active section as you scroll.

## Where to add screenshots

`genesis.html` has a "Willow in practice" gallery section with three placeholder tiles (`.gallery-placeholder`) ready for real product screenshots. Replace the placeholder `<div>` contents with `<img>` tags pointing at images in `assets/`.

## CTA link

Every "Open Willow Care" button points to `https://willow.willowcare.app`.

## Colors

| Name | Hex |
|---|---|
| Dark Spruce | `#365136` |
| Hunter Green | `#426542` |
| Mint Cream | `#E6EDE6` |
| Porcelain | `#F4F7F4` |
| Bright Snow | `#FAFAF9` |
| White | `#FFFFFF` |
| Alabaster Grey | `#E7E5E4` |

## Type

- **Playfair Display** (italic 400/600, normal 400/600/700) — headlines
- **DM Sans** (300/400/500/600, + italic 400) — body and UI
- **DM Mono** (400/500) — eyebrows, labels, timestamps, data
