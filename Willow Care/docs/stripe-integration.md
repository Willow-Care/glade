# Stripe billing integration guide

Stripe is wired up and live in the Willow app (`Willow/frontend`), a
Next.js 15 + Supabase app. This doc explains how the pieces fit together
and how to finish configuring it in your own Stripe/Supabase accounts.

The marketing site you're reading this from (`Willow Care/`, aka "glade")
is static HTML/CSS/JS with no server, so it can never hold a Stripe secret
key. It only hands visitors off to the app — see [0. How checkout starts
from this site](#0-how-checkout-starts-from-this-site).

## Data model: one billing owner per care profile, not per person

Willow's schema (`Willow/supabase/schema.sql`) already has the shape this
needs:

```
profiles                       -- one row per care recipient ("workspace")
  id
  child_name
  tier                    -- 'core' | 'premium' | 'beta'        (added by migration_billing.sql / migration_billing_gating.sql)
  billing_owner_id        -- FK -> auth.users.id                (added by migration_billing.sql)
  stripe_customer_id                                            (added by migration_billing.sql)
  stripe_subscription_id                                        (added by migration_billing.sql)
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

Run `Willow/supabase/migration_billing.sql` then
`Willow/supabase/migration_billing_gating.sql` once each (Supabase
Dashboard → SQL Editor) to add the billing columns above, the `beta` tier,
tier-gated invite codes, and a `stripe_events` table used for webhook
idempotency.

## 0. How checkout starts from this site

`willow/pricing.html` / `willow/pricing.js` don't call Stripe directly.
Each plan button carries `data-plan="core"` or `data-plan="premium"` and,
on click, redirects to:

```
https://willow.willowcare.app/dashboard?plan=core
```

Inside the app (`components/Sidebar.tsx`, mounted on every `/dashboard/*`
page):

1. `app/dashboard/page.tsx` requires a signed-in user. If there isn't one,
   it redirects to `/login?next=/dashboard?plan=core`, preserving the plan
   through sign-in (and through `/signup` if they create an account instead).
2. Once the active profile has loaded, Sidebar checks the `?plan=` param:
   - **Billing owner, doesn't already have that plan active** → calls
     `/api/checkout` immediately and redirects straight to the real Stripe
     Checkout page (the pasted-image "payment menu" — a full-screen
     "Redirecting you to secure checkout…" spinner covers the brief gap).
     No extra click.
   - **Anyone else** (not the billing owner, or already subscribed at that
     tier or better) → opens **Settings → Billing** instead, showing
     current plan/status and a "Manage billing" button rather than trying
     to sell them something they can't buy or already have.
3. The same `?plan=` hand-off is reused by the in-app upgrade prompts
   (`components/PremiumGate.tsx`, shown wherever a Core user hits a
   Premium-only feature) — they link to `/dashboard?plan=premium`, which
   drives the exact same auto-checkout path.

**Known gap:** the `?next=` hand-off (step 1) is only implemented for
email/password sign-in. A visitor who signs in with Google from that link
lands on `/dashboard` without the plan pre-selected — they just need one
extra click into Settings → Billing. Fixing this means threading `next`
through `GoogleButton`'s OAuth `redirectTo` and reading it back in
`app/auth/callback/page.tsx`.

If you'd rather skip the app hand-off for a given plan (e.g. a one-off
promo), set that button's `data-stripe-link` attribute in `pricing.html`
to a Stripe Payment Link URL — `pricing.js` will redirect straight there
instead, no app or backend involved.

## 1. Configure Stripe

1. Create two recurring **Products/Prices** in the Stripe Dashboard
   (Product catalog): Core ($9.99/mo) and Premium ($24.99/mo), matching
   `willow/pricing.html`. Enterprise is contact-only — it never goes
   through Checkout.
2. Copy each Price ID into the Willow app's environment as
   `STRIPE_PRICE_CORE` / `STRIPE_PRICE_PREMIUM` (see `Willow/.env.example`).
3. Copy your secret key into `STRIPE_SECRET_KEY`.
4. Under Settings → Billing → Customer portal, turn on "Customers can
   switch plans" and enable both Prices, so a subscriber can move between
   Core and Premium (and cancel) from the portal button in Settings →
   Billing, without the app ever creating a second subscription.

## 2. `/api/checkout` — start a Checkout Session

`Willow/frontend/app/api/checkout/route.ts`. Given `{ profile_id, user_id,
plan }`:

- Confirms `user_id` has `role = 'owner'` on `profile_id` via
  `caregiver_access` (service-role query — this app doesn't use
  cookie-based SSR auth, so route handlers trust client-supplied ids and
  verify them against the database, same pattern as the other `/api/*`
  routes in this codebase).
- Creates (or reuses) a Stripe Customer for that profile and saves
  `stripe_customer_id`.
- Creates a `mode: "subscription"` Checkout Session for the requested
  plan's price, with `profile_id` / `user_id` / `plan` in both the
  session's and the subscription's `metadata` (the subscription's copy is
  what the webhook reads later — session metadata isn't available on
  `customer.subscription.*` events).
- Returns `{ url }` for the client to redirect to.

## 3. `/api/webhooks/stripe` — sync subscription state

`Willow/frontend/app/api/webhooks/stripe/route.ts`. Register this
endpoint in the Stripe Dashboard (Developers → Webhooks) for:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Paste the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. The
route verifies the signature, skips events it's already processed
(`stripe_events` table, since Stripe redelivers), and updates
`profiles.tier` / `subscription_status` / `stripe_subscription_id` from
`subscription.metadata.profile_id` (falling back to a lookup by
`stripe_customer_id` if metadata is ever missing, e.g. a subscription
edited by hand in the Dashboard).

To test locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and use the webhook secret it prints.

## 4. `/api/portal` — self-serve plan changes and cancellation

`Willow/frontend/app/api/portal/route.ts`. Same owner check as checkout,
then creates a Billing Portal session for the profile's
`stripe_customer_id` and returns its URL. Surfaced as the "Manage billing"
button in Settings → Billing once a profile has a subscription.

## 5. In-app UI

`components/BillingPanel.tsx`, opened from Settings → Billing
(`components/SettingsPanel.tsx`):

- Shows the profile's current `tier` and `subscription_status`.
- If there's no subscription yet, the billing owner sees plan cards with
  "Start Core" / "Start Premium" buttons (→ `/api/checkout`).
- Once subscribed, plan switches and cancellation happen through "Manage
  billing" (→ `/api/portal`) rather than a second Checkout Session, so we
  never accidentally create a duplicate subscription for the same profile.
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

Everything else on the Trends/Chat/Team pages (viewing existing data,
redeeming someone else's invite code, being invited into a Premium
profile) is unaffected by tier — gating only applies to the
Premium-exclusive actions above.

## 7. Granting beta tester access

Beta access is granted by hand in Supabase, not through Stripe — there's
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

That's it — no webhook, no Stripe object involved. The profile now passes
`hasPremiumAccess()` everywhere (Chat with Willow, Long-Term Trends,
inviting caregivers), and Settings → Billing shows "Beta tester — full
access" instead of prompting them to subscribe.

To revoke it later: `update public.profiles set tier = 'core' where id = '<profile_id>';`
(or `'premium'` if they should keep paid access instead).

If a beta tester's profile later gets a *real* Stripe subscription (e.g.
they leave the beta and pay), the webhook (`/api/webhooks/stripe`) will
overwrite `tier` back to `'core'`/`'premium'` based on what they actually
subscribed to — `'beta'` only sticks until something else sets it.
