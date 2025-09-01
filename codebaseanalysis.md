## Codebase Analysis

### Overview
- Next.js App Router project with Clerk auth, Convex realtime backend, shadcn/ui, and LangChain AI.
- Protected dashboard under `/dashboard`, public landing under `/(landing)`.

### Key Directories
- `app/(landing)`: Marketing pages and pricing section
- `app/dashboard`: Auth-protected app UI, payment-gated page, AI page
- `app/api/ai`: AI endpoints (`chat` JSON, `stream` text streaming)
- `components/`: UI system, pricing, providers
- `convex/`: Schema, webhooks, users/payment functions, Convex config
- `lib/ai`: LangChain chain and helpers

### Auth & Billing
- `middleware.ts` protects `/dashboard(.*)` using Clerk
- Pricing via Clerk `PricingTable` in `components/custom-clerk-pricing.tsx`
- Gating in `app/dashboard/payment-gated/page.tsx` with `Protect`

### Convex
- `convex/schema.ts`: `users`, `paymentAttempts` with indexes
- `convex/http.ts`: `/clerk-users-webhook` for user/payment sync
- `convex/auth.config.ts`: JWT domain from `NEXT_PUBLIC_CLERK_FRONTEND_API_URL`

### AI Integration
- `lib/ai/chain.ts`: LCEL chain (`prompt -> ChatOpenAI -> StringOutputParser`)
- `app/api/ai/chat/route.ts`: Non-streaming JSON response
- `app/api/ai/stream/route.ts`: Streaming plain-text response
- `app/dashboard/ai/page.tsx`: Minimal streaming chat UI

### Environment Variables
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_FRONTEND_API_URL`, redirect URLs
- Convex: `NEXT_PUBLIC_CONVEX_URL`, `CLERK_WEBHOOK_SECRET`
- AI: `OPENAI_API_KEY`, optional `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`

### Suggested Next Steps
- Add sidebar link to `/dashboard/ai`
- Enable LangSmith tracing callbacks on chains
- Rate-limit `/api/ai/*` and enforce plan checks
- Consider RAG: add vector store integration and retrieval chains


