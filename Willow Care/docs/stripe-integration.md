# Stripe billing integration guide

The current site (`Willow Care/`) is static HTML/CSS/JS with no server. The
pricing page (`willow/pricing.html`, `willow/pricing.js`) is wired to call
the routes below, but they don't exist yet. This doc is the implementation
guide for the day the Willow product gets a Next.js + Supabase backend.

## 0. Two ways to launch checkout today

`willow/pricing.js` supports either path without a code change:

- **No backend yet:** create a Stripe Payment Link for each plan in the
  Stripe Dashboard and paste the URL into that button's `data-stripe-link`
  attribute in `pricing.html`. Clicking the button redirects straight to
  Stripe, no server required.
- **Once `/api/checkout` exists:** leave `data-stripe-link` empty. The
  button POSTs to `/api/checkout` with the plan's `priceId` and redirects
  to the Checkout Session URL the route returns.

## 1. `/api/checkout` — start a Checkout Session

```ts
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { priceId } = await req.json();
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, workspace_id')
    .eq('id', user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email!,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?checkout=cancelled`,
    metadata: {
      user_id: user.id,
      workspace_id: profile?.workspace_id ?? '',
    },
  });

  return NextResponse.json({ url: session.url });
}
```

The `user_id` and `workspace_id` in `metadata` are what let the webhook
below know which row to update, since Stripe has no concept of your app's
users on its own.

## 2. `/api/webhooks/stripe` — sync subscription state

```ts
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case 'invoice.payment_succeeded':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const tier = priceId === process.env.STRIPE_PRICE_PREMIUM ? 'premium' : 'core';
      const workspaceId = subscription.metadata.workspace_id;

      await supabase
        .from('workspaces')
        .update({
          tier,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
        })
        .eq('id', workspaceId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from('workspaces')
        .update({ tier: 'core', subscription_status: 'cancelled' })
        .eq('id', subscription.metadata.workspace_id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

Register this endpoint in the Stripe Dashboard for at least
`invoice.payment_succeeded`, `customer.subscription.updated`, and
`customer.subscription.deleted`.

## 3. `/api/portal` — self-serve plan changes and cancellation

```ts
// app/api/portal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account on file' }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account`,
  });

  return NextResponse.json({ url: session.url });
}
```

## 4. Data model: one billing owner per workspace, not per person

Premium is billed once per workspace, not once per person. This is what
lets a parent, a co-parent, and a private aide share full access to the
same child's data on a single subscription.

```
workspaces
  id
  patient_name
  tier                 -- 'core' | 'premium'
  billing_owner_id      -- FK -> profiles.id
  stripe_customer_id
  stripe_subscription_id
  subscription_status

profiles
  id                    -- FK -> auth.users.id
  workspace_id          -- FK -> workspaces.id
  role                  -- 'owner' | 'member'
```

- The billing owner (e.g. Mom) subscribes; her card is charged and
  `workspaces.stripe_customer_id` / `stripe_subscription_id` point at her
  Stripe objects.
- She invites Dad, the speech therapist, or the nanny by email. Their
  `profiles.workspace_id` is set to her workspace on signup, and the app
  checks `workspaces.tier` (not any per-person billing state) to unlock
  Premium features for them.
- Row-level security should scope every query (logs, chats, exports) to
  `profiles.workspace_id`, so members can only ever see the one patient
  their workspace was created for.
- If Dad wants to track a different child in a different household, he
  creates a second workspace and becomes its billing owner. This is the
  abuse guard: one subscription always maps to exactly one patient
  profile, no matter how many people are invited into it.
