## AI Integration Guide

### Endpoints
- POST `/api/ai/chat` → JSON `{ input }` → `{ text }`
- POST `/api/ai/stream` → text/plain streaming response

### Client Page
- `app/dashboard/ai/page.tsx` – Minimal chat UI streaming from `/api/ai/stream`.
- Sidebar link: "AI Assistant" → `/dashboard/ai`.

### Chain
- `lib/ai/chain.ts` – LCEL chain: `ChatPromptTemplate -> ChatOpenAI -> StringOutputParser`.
- Helper: `generateCompletion(input)` for non-streaming calls.

### Environment
- `OPENAI_API_KEY=sk_...`
- Optional LangSmith:
  - `LANGCHAIN_TRACING_V2=true`
  - `LANGCHAIN_API_KEY=ls_...`
  - `LANGCHAIN_PROJECT=u2oobCaption`

### Notes
- Add rate limiting and auth checks for `/api/ai/*`.
- Consider enabling LangSmith callbacks for observability.
- For RAG, add a vector store and retrieval chain.


