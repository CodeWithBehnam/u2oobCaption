## SaaS Adoption Checklist

### Checklist
- [x] Plan adoption steps
- [ ] Collect product inputs
- [ ] Set up local env & secrets
- [ ] Configure Clerk authentication & middleware
- [ ] Design Convex schema for your entities
- [ ] Set up billing & gated routes
- [ ] Branding (logo/colors/copy/metadata)
- [ ] Customize dashboard modules
- [ ] QA locally, then deploy

### Provide These Inputs to Personalize
- SaaS name and description
- Production domain and marketing site domain
- Brand colors (primary/secondary) and a logo file (SVG/PNG)
- Auth providers to enable in Clerk (Email/Passkey/Google/GitHub/…)
- Plans and pricing (plan ids, names, features, monthly/annual)
- Usage limits per plan (projects, API calls, storage)
- Core domain entities (e.g., projects, documents, teams)
- Support email and legal links (terms, privacy)

### Step-by-Step Adoption
1) Environment and dev servers

```bash
cp .env.example .env.local  # if present; otherwise create .env.local

# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://<your-clerk-domain>.clerk.accounts.dev
NEXT_PUBLIC_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
CLERK_WEBHOOK_SECRET=whsec_...

# Redirects
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Install & run
bun install
bun run dev
bunx convex dev
```

2) Clerk configuration
- In Clerk Dashboard: create a JWT Template named "convex"; use its issuer domain as `NEXT_PUBLIC_CLERK_FRONTEND_API_URL`.
- Enable desired auth providers (Google/GitHub/Email/etc.).
- Set redirect URLs to `/dashboard`.
- `app/middleware.ts` protects `/dashboard(.*)`; extend matchers if needed.

3) Convex auth integration
- `convex/auth.config.ts` uses `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` and `applicationID: "convex"`.
- `components/ConvexClientProvider.tsx` requires `NEXT_PUBLIC_CONVEX_URL`.

4) Webhooks
- Set `CLERK_WEBHOOK_SECRET` in Convex dashboard env.
- Configure Clerk webhook to Convex at `/clerk-users-webhook`.
- `convex/http.ts` handles `user.created|updated|deleted` and `paymentAttempt.updated`.

5) Pricing and gating
- Pricing UI: `components/custom-clerk-pricing.tsx` (Clerk `<PricingTable>`).
- Payment-gated page: `app/dashboard/payment-gated/page.tsx` uses `<Protect>`; replace the `has({ plan: ... })` checks with your plan keys.

6) Branding
- Update landing content under `app/(landing)/*`.
- Replace `components/logo.tsx` and assets under `public/`.
- Adjust styles in `app/globals.css` and `components/ui/*` as needed.

7) Data model
- Current schema: `users` with `externalId`, `name`; `paymentAttempts` table.
- Add your entities in `convex/schema.ts` and implement queries/mutations in new `convex/*.ts` files.
- Add indexes for any fields used in filters.

8) Dashboard customization
- Update `app/dashboard/*` (sidebar, charts, tables).
- Replace sample data in `app/dashboard/data.json` and connect to Convex via `useQuery`/`useMutation`.

9) Deploy
- Vercel: set all env vars from `.env.local`.
- Ensure Convex deployment URL and Clerk keys are set in Vercel and Convex dashboards.
- Push to main for auto-deploy.

### Where to Edit
- Auth: `app/middleware.ts`, `convex/auth.config.ts`
- Env/Client: `.env.local`, `components/ConvexClientProvider.tsx`
- Billing: `components/custom-clerk-pricing.tsx`, `app/(landing)/page.tsx`, `app/dashboard/payment-gated/page.tsx`
- Webhooks: `convex/http.ts`
- Data: `convex/schema.ts`, `convex/*.ts`
- UI/Brand: `app/(landing)/*`, `components/logo.tsx`, `app/globals.css`

### Quick Checks
- Visiting `/dashboard` signed-out redirects to sign-in.
- Pricing table renders on landing.
- Payment-gated page shows upgrade prompt without paid plan; unlocks with paid plan.
- Webhook logs show Clerk user sync events.
- Convex queries stream live data in dashboard.


