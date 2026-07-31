# Polar.sh billing integration guide

Polar is wired up and live in the Willow app (`Willow/frontend`), a
Next.js 15 + Supabase app. This doc explains how the pieces fit together
and how to finish configuring it in your own Polar/Supabase accounts.

The marketing site you're reading this from (`Willow Care/`, aka "glade")
is static HTML/CSS/JS with no server, so it can never hold a Polar access
token. It only hands visitors off to the app — see [0. How checkout
starts from this site](#0-how-checkout-starts-from-this-site).

> **This app previously used Stripe.** If you're migrating an existing
> deployment, run `Willow/supabase/migration_polar_billing.sql` — it
> renames the old `stripe_customer_id` / `stripe_subscription_id` /
> `stripe_events` to their Polar equivalents. Fresh setups can skip it;
> `migration_billing.sql` already creates the Polar-named columns.

## Data model: one billing owner per care profile, not per person

Willow's schema (`Willow/supabase/schema.sql`) already has the shape this
needs:

```
profiles                       -- one row per care recipient ("workspace")
  id
  child_name
  tier                    -- 'core' | 'premium' | 'beta'        (added by migration_billing.sql / migration_billing_gating.sql)
  billing_owner_id        -- FK -> auth.users.id                (added by migration_billing.sql)
  polar_customer_id                                             (added by migration_billing.sql)
  polar_subscription_id                                         (added by migration_billing.sql)
  subscription_status                                           (added by migration_billing.sql)

caregiver_access                -- many caregivers <-> many profiles
  profile_id              -- FK -> profiles.id
  user_id                 -- FK -> auth.users.id
  role                    -- 'owner' | 'editor' | 'viewer'
```

- The caregiver who created the profile (or was granted `role = 'owner'`)
  is the **billing owner**. They're the only one who can start checkout or
  open the billing portal for that profile — enforced server-side in
  `/api/checkout` and `/api/portal` by checking `caregiver_access`.
- Everyone else invited into that profile (co-parent, therapist, aide)
  automatically gets `profiles.tier`'s features — there's no per-person
  billing state to check.
- If someone wants to track a *different* child, they create a second
  profile and become its billing owner. One subscription always maps to
  exactly one `profiles` row, no matter how many caregivers share it.
- Willow's own `profile_id` is passed to Polar as **`externalCustomerId`**
  on every checkout. Polar reconciles its Customer record against that id
  automatically, so the webhook doesn't have to rely on metadata surviving
  the round trip from checkout → subscription.

Run `Willow/supabase/migration_billing.sql` then
`Willow/supabase/migration_billing_gating.sql` once each (Supabase
Dashboard → SQL Editor) to add the billing columns above, the `beta`
tier, tier-gated invite codes, and a `polar_events` table used for webhook
idempotency.

## 0. How checkout starts from this site

`willow/pricing.html` / `willow/pricing.js` don't call Polar directly.
Each plan button carries `data-plan="core"` or `data-plan="premium"` and,
on click, redirects to:

```
https://willow.willowcare.app/dashboard?plan=core
```

Inside the app (`components/Sidebar.tsx`, mounted on every `/dashboard/*`
page):

1. `app/dashboard/page.tsx` requires a signed-in user. If there isn't one,
   it redirects to `/login?next=/dashboard?plan=core`, preserving the plan
   through sign-in — via email/password, Google OAuth (`GoogleButton`'s
   `next` prop → `/auth/callback?next=...` → `app/auth/callback/page.tsx`),
   **and** through `/signup` if they create an account instead.
2. **New users aren't onboarded yet** — they don't have a care profile.
   Both signup paths force onboarding (create a profile, or join one with
   an invite code) *before* anything checkout-related happens:
   `app/(auth)/signup/page.tsx` (email) verifies the account with a code
   first (see `EMAIL_VERIFICATION_SETUP.md`), then walks through
   choice → create/join, then `router.push(next)`; `app/auth/callback/page.tsx`
   (Google) does the same choice → create/join → `router.replace(next)`.
   Only after a profile exists does `next` (still carrying `?plan=...`)
   ever get followed.
3. Once the active profile has loaded, Sidebar checks the `?plan=` param:
   - **Billing owner, doesn't already have that plan active** → calls
     `/api/checkout` immediately and redirects straight to the real Polar
     Checkout page — a full-screen "Redirecting you to secure checkout…"
     spinner covers the brief gap. No extra click.
   - **Anyone else** (not the billing owner, or already subscribed at that
     tier or better) → opens **Settings → Billing** instead, showing
     current plan/status and a "Manage billing" button rather than trying
     to sell them something they can't buy or already have.
4. The same `?plan=` hand-off is reused by the in-app upgrade prompts
   (`components/PremiumGate.tsx`, shown wherever a Core user hits a
   Premium-only feature) — they link to `/dashboard?plan=premium`, which
   drives the exact same auto-checkout path.

If you'd rather skip the app hand-off for a given plan (e.g. a one-off
promo), set that button's `data-checkout-link` attribute in `pricing.html`
to a Polar Checkout Link URL — `pricing.js` will redirect straight there
instead, no app or backend involved.

## 1. Configure Polar

1. Create two recurring **Products** in the Polar Dashboard: Core
   ($9.99/mo) and Premium ($24.99/mo), matching `willow/pricing.html`.
   Give each product exactly one recurring monthly price — Polar checkout
   selects a *product*, not a specific price within it, so keep it 1:1.
   Enterprise is contact-only — it never goes through Checkout.
2. Copy each Product ID into the Willow app's environment as
   `POLAR_PRODUCT_CORE` / `POLAR_PRODUCT_PREMIUM` (see `Willow/.env.example`).
3. Copy an **organization access token** into `POLAR_ACCESS_TOKEN`
   (Dashboard → Settings → Developers → Access Tokens).
4. Set `POLAR_SERVER=sandbox` while testing against Polar's sandbox
   environment (`sandbox.polar.sh`) — switch to `production` (or unset,
   since that's the default) once you're taking real payments.

## 2. `/api/checkout` — start a Checkout

`Willow/frontend/app/api/checkout/route.ts`. Given `{ profile_id, user_id,
plan }`:

- Confirms `user_id` has `role = 'owner'` on `profile_id` via
  `caregiver_access` (service-role query — this app doesn't use
  cookie-based SSR auth, so route handlers trust client-supplied ids and
  verify them against the database, same pattern as the other `/api/*`
  routes in this codebase).
- Calls `polar.checkouts.create({ products: [productId], customerId,
  customerEmail, externalCustomerId: profile_id, successUrl, metadata })`.
  Unlike Stripe, there's no separate "create a customer first" step —
  Polar creates or reuses the Customer itself during checkout, matched by
  `externalCustomerId`. The first time a profile checks out we only have
  an email to offer; `polar_customer_id` gets filled in once the webhook
  fires.
- Returns `{ url: checkout.url }` for the client to redirect to.

## 3. `/api/webhooks/polar` — sync subscription state

`Willow/frontend/app/api/webhooks/polar/route.ts`. Register this endpoint
in the Polar Dashboard (Settings → Webhooks) for at least:

- `subscription.active`
- `subscription.updated`
- `subscription.canceled`
- `subscription.revoked`
- `subscription.past_due`

Paste the endpoint's secret into `POLAR_WEBHOOK_SECRET`. The route
verifies the signature with `validateEvent()` from `@polar-sh/sdk/webhooks`
(catching `WebhookVerificationError`), skips events it's already
processed (`polar_events` table, keyed on the `webhook-id` header — Polar
uses the Standard Webhooks spec, so the same id is reused across
automatic retries of one delivery), then:

- `subscription.active` / `.updated` / `.uncanceled` / `.resumed` /
  `.cycled` → re-derive `tier` from the subscription's product and set
  `subscription_status`. Re-deriving the tier here (not just on the first
  `active` event) is what picks up a Core ↔ Premium switch made through
  the customer portal.
- `subscription.canceled` → status only, tier untouched. In Polar this
  means "won't renew," not "access revoked" — the subscriber keeps their
  tier until the period actually ends.
- `subscription.past_due` / `.paused` → status only, same reasoning.
- `subscription.revoked` → **only** this event drops `tier` back to
  `'core'`. This is when access is actually removed.

**Field names to verify:** Polar's public docs don't fully spell out the
Subscription webhook payload at the field level. The three extractor
helpers at the top of the route (`extractProfileId`, `extractProductId`,
`extractCustomerId`) try `metadata.profile_id`, then
`customer.externalId`/`customerExternalId`, then a direct `productId` /
`product.id`, then `customerId` / `customer.id` — reflecting the most
consistent field-naming pattern across the parts of Polar's API that
*are* documented (Checkout objects expose flat `productId`,
`externalCustomerId`, and `customerId` fields). Before going live, trigger
a real subscription in sandbox and check Polar Dashboard → Webhooks →
your endpoint → recent deliveries to confirm the payload actually matches
— adjust those three functions if a name differs.

To test locally, use the Polar CLI or dashboard's webhook testing tools to
send a sandbox event to `http://localhost:3000/api/webhooks/polar` (via a
tunnel like ngrok, since Polar needs a public URL to deliver to).

## 4. `/api/portal` — self-serve plan changes and cancellation

`Willow/frontend/app/api/portal/route.ts`. Same owner check as checkout,
then calls `polar.customerSessions.create({ customerId:
profile.polar_customer_id })` and returns `session.customerPortalUrl`.
Customer Session tokens are short-lived by design, so a fresh one is
minted every time — never cache the URL. Surfaced as the "Manage billing"
button in Settings → Billing once a profile has a subscription.

## 5. In-app UI

`components/BillingPanel.tsx`, opened from Settings → Billing
(`components/SettingsPanel.tsx`):

- Shows the profile's current `tier` and `subscription_status`.
- If there's no subscription yet, the billing owner sees plan cards with
  "Start Core" / "Start Premium" buttons (→ `/api/checkout`).
- Once subscribed, plan switches and cancellation happen through "Manage
  billing" (→ `/api/portal`) rather than a second Checkout, so we never
  accidentally create a duplicate subscription for the same profile.
- Non-owners see the current plan read-only with a note to ask the
  billing owner.
- Beta testers (see below) see "Beta tester — full access" instead of a
  plan name/price, and never see the upgrade cards.

## 6. Feature entitlements by tier

`Willow/frontend/lib/entitlements.ts` exports `hasPremiumAccess(tier)`,
true for `"premium"` and `"beta"`. It gates:

| Feature | Core | Premium / beta | Enforced in |
|---|---|---|---|
| Unlimited logs, dashboard, Willow Analysis (per-log AI snapshot) | ✅ | ✅ | not gated — included on every tier |
| Chat with Willow (conversational AI) | ❌ | ✅ | `app/dashboard/chat/page.tsx` (UI) **and** `app/api/chat/route.ts` (server-side 403 — the only feature gated on both sides, since it's the most expensive to let through) |
| Long-Term Trends (multi-log AI charts) | ❌ | ✅ | `app/dashboard/trends/page.tsx` (UI only) |
| Inviting caregivers (new invite codes) | ❌ | ✅ | `components/SettingsPanel.tsx` Team view (UI) **and** the `invite_codes` INSERT policy added by `migration_billing_gating.sql` (RLS — so this one can't be bypassed by calling Supabase directly) |

Core users hit `components/PremiumGate.tsx` in place of the gated UI, with
a button that links to `/dashboard?plan=premium` (see §0 for what that
triggers).

**Not yet built:** the pricing page also lists "Clinical PDF exports for
doctor visits" as a Premium feature. There's no PDF export anywhere in the
app yet — nothing to gate until that feature exists.

## 7. Granting beta tester access

Beta access is granted by hand in Supabase, not through Polar — there's
no self-serve way to become `"beta"`, by design.

1. Find the care profile's `id`. In Supabase Dashboard → SQL Editor:

   ```sql
   select p.id as profile_id, p.child_name, u.email as owner_email
   from public.profiles p
   join public.caregiver_access ca on ca.profile_id = p.id and ca.role = 'owner'
   join auth.users u on u.id = ca.user_id
   where u.email = 'tester@example.com';
   ```

2. Grant it:

   ```sql
   update public.profiles set tier = 'beta' where id = '<profile_id-from-above>';
   ```

That's it — no webhook, no Polar object involved. The profile now passes
`hasPremiumAccess()` everywhere (Chat with Willow, Long-Term Trends,
inviting caregivers), and Settings → Billing shows "Beta tester — full
access" instead of prompting them to subscribe.

To revoke it later: `update public.profiles set tier = 'core' where id = '<profile_id>';`
(or `'premium'` if they should keep paid access instead).

If a beta tester's profile later gets a *real* Polar subscription (e.g.
they leave the beta and pay), the webhook (`/api/webhooks/polar`) will
overwrite `tier` back to `'core'`/`'premium'` based on what they actually
subscribed to — `'beta'` only sticks until something else sets it.
