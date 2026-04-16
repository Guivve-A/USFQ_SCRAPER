# CLAUDE.md — Hackathon Scraper con IA

> **Instructions for Claude Code (CLI).** Read this file completely before taking any action in this project.

---

## Project Overview

**HackFinder** is a hackathon discovery platform with AI-powered semantic search. It scrapes hackathon listings from Devpost, MLH, Eventbrite, and GDG Ecuador, stores them in Supabase with pgvector embeddings, and exposes a streaming chatbot (Gemini 1.5 Flash) that lets users find relevant events in natural language.

**Core thesis:** One solo developer, 7 days, zero AI API cost.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Fullstack, Route Handlers, Vercel-native |
| Database | Supabase (PostgreSQL + pgvector) | Vector search + relational in one service |
| LLM / Chatbot | Gemini 1.5 Flash via `@ai-sdk/google` | Free tier: 1M tokens/day, 15 RPM |
| Embeddings | HuggingFace `all-MiniLM-L6-v2` | Free, 384 dims, sufficient accuracy |
| Scraping | Cheerio + axios | Serverless-safe, no Chromium overhead |
| UI | Tailwind CSS + shadcn/ui | Fast, consistent, accessible |
| Streaming | Vercel AI SDK (`ai` package) | Native streaming + tool use |
| Cron | Vercel Cron (2 jobs on Hobby plan) | Zero config, production only |
| Deploy | Vercel Hobby | Free, CI/CD from GitHub |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage: hero + search + recent hackathons
│   ├── events/
│   │   ├── page.tsx                # Full listing with filters
│   │   └── [id]/page.tsx           # Event detail + on-demand translation
│   ├── chat/
│   │   └── page.tsx                # Chatbot UI with streaming
│   └── api/
│       ├── scrape/route.ts         # POST — trigger scraping manually
│       ├── search/route.ts         # GET  — semantic search endpoint
│       ├── chat/route.ts           # POST — streaming chatbot (Gemini + tool use)
│       ├── translate/route.ts      # POST — translate/summarize description
│       ├── embed/route.ts          # POST — generate embeddings for new hackathons
│       └── cron/
│           ├── scrape/route.ts     # GET  — daily scraping cron job
│           ├── embed/route.ts      # GET  — daily embedding cron job
│           └── status/route.ts     # GET  — public system status
├── lib/
│   ├── scrapers/
│   │   ├── devpost.ts              # Devpost: JSON API + Cheerio fallback
│   │   ├── mlh.ts                  # MLH: Cheerio on SSR HTML
│   │   ├── eventbrite.ts           # Eventbrite: scrape /d/ pages
│   │   ├── gdg.ts                  # GDG Ecuador chapters
│   │   └── index.ts                # runAllScrapers() — orchestrator
│   ├── ai/
│   │   ├── embeddings.ts           # generateEmbedding(), embedAllHackathons()
│   │   └── search.ts               # searchHackathons() — embed query + RPC call
│   └── db/
│       ├── client.ts               # Supabase browser + server clients
│       └── queries.ts              # upsertHackathon, searchHackathons, etc.
├── components/
│   ├── HackathonCard.tsx           # Grid card component
│   ├── SearchBar.tsx               # Semantic search input with debounce
│   └── ChatWidget.tsx              # Floating chat button + panel
├── hooks/
│   └── useChat.ts                  # Wraps Vercel AI SDK useChat
└── types/
    └── hackathon.ts                # Hackathon, Platform, SearchParams interfaces
```

---

## Key Conventions

### TypeScript
- Strict mode enabled. No `any` — use proper types or `unknown`.
- All API route handlers must have explicit return types.
- Use Zod for all external input validation (query params, request bodies).
- Interfaces live in `src/types/`. Import them from there, never redefine inline.

### Supabase clients
- **Browser client** (`createBrowserClient`): use in Client Components and hooks.
- **Server client** (`createServerClient`): use in Server Components, Route Handlers, Server Actions.
- **Service role** (`SUPABASE_SERVICE_ROLE_KEY`): ONLY in Route Handlers for write operations (scraping, embeddings). Never expose to client.

```typescript
// CORRECT — server-side write
import { createClient } from '@supabase/supabase-js'
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CORRECT — client-side read
import { createBrowserClient } from '@supabase/ssr'
const client = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Route Handlers
- All cron endpoints **must** validate `Authorization: Bearer {CRON_SECRET}` — return 401 if missing or wrong.
- All write endpoints (scrape, embed, translate) use service role Supabase client.
- Scraping and Node.js-native operations require: `export const runtime = 'nodejs'`
- Streaming chat requires: `export const maxDuration = 30`
- Cron jobs require: `export const maxDuration = 60`

### Error handling
- Wrap all scrapers in try/catch. A single scraper failing must NOT stop the others.
- Use `Promise.allSettled` (not `Promise.all`) when running scrapers in parallel.
- Log errors with `console.error` so they appear in Vercel Logs.
- API routes must always return JSON, even on error: `{ error: string, details?: string }`.

### Embeddings
- Model: `sentence-transformers/all-MiniLM-L6-v2` → produces exactly **384 dimensions**.
- Supabase column type: `VECTOR(384)` — never 1536 (that's OpenAI's dimension).
- Text to embed per hackathon: `title | description (first 400 chars) | tags | location | online/presencial | prize_pool`
- Always strip HTML tags before embedding: `text.replace(/<[^>]*>/g, '')`
- Batch size: max 10 hackathons at a time with 1s delay between batches (HF rate limit respect).

### Scraping
- Always include `User-Agent` header in axios requests:
  ```typescript
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HackFinder/1.0)' }
  ```
- Timeout: 10 seconds per request (`timeout: 10000`).
- Devpost: try JSON API first (`WebDevHarsha.github.io/open-hackathons-api/data-online.json`), fall back to Cheerio.
- MLH: Cheerio works directly — 30+ events are SSR in the initial HTML.
- Deduplication: always upsert by `url` (unique constraint in DB).
- If a field is not found, use `null` — never empty string `""`.

### Chatbot
- Model: `google('gemini-1.5-flash')` — never use a paid model.
- `maxSteps: 3` — allows tool chaining within a single user turn.
- The `searchHackathons` tool must always be called before responding about events.
- Response language: match the user's language (Spanish if they write in Spanish).
- Streaming: always use `result.toDataStreamResponse()` for the Response.

### UI
- Color palette: `#4F46E5` (indigo) for primary actions, `#059669` (green) for online badges.
- All images: use `next/image` with proper `remotePatterns` in `next.config.js`.
- Loading states: use shadcn/ui `Skeleton` — never show blank spaces.
- Empty states: always render a friendly message + CTA, never a blank screen.
- Responsive: mobile-first, breakpoints `sm:` (2 cols) → `lg:` (3 cols) for grids.

---

## Environment Variables

```bash
# Required — Supabase (supabase.com > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Server-side only, never prefix with NEXT_PUBLIC_

# Required — Google AI Studio (aistudio.google.com) — FREE
GOOGLE_GENERATIVE_AI_API_KEY=

# Required — HuggingFace (huggingface.co/settings/tokens) — FREE
HF_TOKEN=

# Required — Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=
```

> **Rule:** If any required env var is missing, throw a descriptive error at module load time. Do NOT silently fall back to undefined behavior.

---

## Database Schema Reference

```sql
-- Main table
CREATE TABLE hackathons (
  id               BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title            TEXT NOT NULL,
  description      TEXT,
  desc_translated  TEXT,           -- Cached AI translation
  url              TEXT UNIQUE NOT NULL,
  platform         TEXT,           -- 'devpost' | 'mlh' | 'eventbrite' | 'luma' | 'gdg'
  start_date       TIMESTAMPTZ,
  end_date         TIMESTAMPTZ,
  deadline         TIMESTAMPTZ,
  location         TEXT,
  is_online        BOOLEAN DEFAULT false,
  prize_pool       TEXT,
  prize_amount     NUMERIC,
  tags             TEXT[],
  image_url        TEXT,
  organizer        TEXT,
  embedding        VECTOR(384),    -- HuggingFace all-MiniLM-L6-v2
  scraped_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Key function
SELECT match_hackathons(
  query_embedding  => <VECTOR(384)>,
  match_threshold  => 0.75,
  match_count      => 10,
  filter_online    => NULL,        -- NULL = no filter
  filter_platform  => NULL         -- NULL = all platforms
);
```

---

## Scraping Sources

| Platform | URL | Method | Notes |
|---|---|---|---|
| Devpost (primary) | `WebDevHarsha.github.io/open-hackathons-api/data-online.json` | JSON fetch | No auth needed |
| Devpost (fallback) | `devpost.com/hackathons?challenge_type=online&order_by=deadline` | Cheerio | Selector: `article.challenge-listing` |
| MLH | `mlh.com/seasons/2026/events` | Cheerio | 30+ events in SSR HTML |
| Eventbrite | `eventbrite.com/d/ecuador/hackathon/` | Cheerio | Also: `/d/online/hackathon/` |
| GDG Quito | `gdg.community.dev/gdg-quito/` | Cheerio | SSR, simple structure |
| GDG Guayaquil | `gdg.community.dev/gdg-guayaquil/` | Cheerio | SSR, simple structure |

> **Not implemented:** Luma (requires Playwright + GitHub Actions — out of scope for v1).

---

## Cron Schedule

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "0 6 * * *" },
    { "path": "/api/cron/embed",  "schedule": "0 7 * * *" }
  ]
}
```

> Cron jobs only run in **production**. They cannot be tested on localhost. Use `curl -X GET https://your-app.vercel.app/api/cron/scrape -H "Authorization: Bearer $CRON_SECRET"` to test manually after deploy.

---

## When You Need Manual Action from Me

**Stop and tell me explicitly** when any of the following is required:

1. **External service setup** — creating accounts, generating API keys, executing SQL in Supabase dashboard.
2. **Environment variable values** — you can reference them but cannot fill them in.
3. **Vercel Dashboard configuration** — adding env vars, checking cron job logs, triggering redeploys.
4. **GitHub** — creating repos, pushing code, setting secrets for GitHub Actions.
5. **Database migrations** — if the schema needs to change after initial setup, provide the SQL and tell me to run it.

Format your request like this:
```
⚙️ MANUAL ACTION REQUIRED
Service: [Supabase / Vercel / HuggingFace / Google AI Studio / GitHub]
Action: [Exact step to take]
Where: [URL or dashboard location]
Then: [What to do after completing it]
```

---

## What NOT to Do

- ❌ Do NOT use `any` type in TypeScript.
- ❌ Do NOT use `WidthType.PERCENTAGE` in any table (breaks in Word/Google Docs).
- ❌ Do NOT use `VECTOR(1536)` — this project uses 384 dimensions (HuggingFace).
- ❌ Do NOT use `process.env.ANTHROPIC_API_KEY` — we use Gemini, not Claude API.
- ❌ Do NOT use `process.env.OPENAI_API_KEY` — embeddings are via HuggingFace.
- ❌ Do NOT install Playwright unless explicitly asked — it breaks Vercel serverless.
- ❌ Do NOT use `Promise.all` for scrapers — use `Promise.allSettled`.
- ❌ Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code or `NEXT_PUBLIC_` vars.
- ❌ Do NOT use empty strings `""` for missing data — use `null`.
- ❌ Do NOT skip Zod validation on any user-facing input.

---

## Quick Reference: Key Imports

```typescript
// LLM
import { google } from '@ai-sdk/google'
import { streamText, generateText, tool } from 'ai'

// Embeddings
import { HfInference } from '@huggingface/inference'
const hf = new HfInference(process.env.HF_TOKEN)

// Supabase
import { createClient } from '@supabase/supabase-js'          // server admin
import { createBrowserClient } from '@supabase/ssr'            // browser
import { createServerClient } from '@supabase/ssr'             // server components

// Scraping
import * as cheerio from 'cheerio'
import axios from 'axios'

// Validation
import { z } from 'zod'

// Dates
import { format, parseISO, isAfter } from 'date-fns'
```

---

*Last updated: April 2026 — HackFinder v1*
