# glade

Landing pages for all our apps.

Each brand gets its own folder of **static** HTML/CSS/JS — no build step, no
server, no secrets. Pages are plain files you can open directly or serve
from any static host.

## Structure

```
glade/
├── global assets/            # Shared brand logos (Willow / Willow Care lockups)
└── Willow Care/              # The Willow Care brand site (org + product)
    ├── index.html            # Org landing page (Willow Care = the company)
    ├── genesis.html          # Origin story
    ├── home.css / home.js    # Landing page styles + interactions
    ├── genesis.css / genesis.js
    ├── tokens.css            # Design tokens (colors)
    ├── fonts.css             # Playfair Display · DM Sans · DM Mono
    ├── README.md             # Brand design reference (palette + type)
    ├── assets/               # Page imagery + logos
    ├── docs/
    │   ├── polar-integration.md    # ⭐ Full billing/webhook guide for the Willow app
    │   └── Willow_Genesis_source.txt
    └── willow/               # The Willow product sub-site
        ├── index.html        # Product page
        ├── pricing.html      # Plans → hand off to the app at willow.willowcare.app
        └── pricing.js / product.js / product.css / pricing.css
```

## How it connects to the app

The marketing site is static and never holds a billing token. Pricing
buttons redirect to the Willow app (`https://willow.willowcare.app/dashboard?plan=…`),
which starts checkout from there. The end-to-end flow is documented in
[`Willow Care/docs/polar-integration.md`](./Willow%20Care/docs/polar-integration.md).

The Willow app itself lives in the sibling **`Willow/`** repo.
