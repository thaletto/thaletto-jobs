# Technical Spec: `@thaletto/observe`

> **Status:** Draft  
> **Author:** Laxman K R  
> **Stack:** Effect v4 (beta), TypeScript, Bun, Next.js  
> **Note:** Effect v4 is currently in beta. `effect/unstable/*` modules (HTTP, Schema, SQL) may receive breaking changes in minor releases. This project intentionally targets v4 to explore its patterns — not recommended for production use until v4 stabilises.

---

## 1. Overview

### Problem

Building AI agents is easy. Knowing what they're actually doing is hard.

When an agent fails, hallucinates, or returns unexpected output, there's no standard way to answer:
- Which LLM call caused it?
- What was the exact prompt and response?
- How long did each tool call take?
- Did this run perform worse than the last one?

Most developers resort to `console.log` scattered across their agent code. This is not enough.

### Solution

`@thaletto/observe` is a zero-config observability SDK + local dashboard for TypeScript AI agents.

Developers instrument their agents with a single import. Every LLM call, tool invocation, and agent decision is automatically captured as a structured trace. A local dashboard — started with `npx @thaletto/observe` — visualises these traces as timelines, showing exactly what happened inside each agent run.

### Non-Goals

- **Not a cloud service.** Traces are stored locally only. No data leaves the machine.
- **Not multi-tenant.** Single developer tool, not a team platform.
- **Not a LangSmith replacement.** No prompt management, datasets, or evaluation pipelines — just tracing.
- **Not model-agnostic evaluation.** Tracing only, no scoring or grading of outputs.
- **Not a production APM.** Designed for development and debugging, not high-volume production monitoring.

---

## 2. Architecture

The system has three layers that work together:

```
┌─────────────────────────────────────┐
│           Agent code                │
│  import { observe } from            │
│    "@thaletto/observe"              │
│                                     │
│  Instruments LLM calls,             │
│  tool invocations, agent steps      │
└────────────────┬────────────────────┘
                 │ HTTP POST /traces (JSON)
                 ▼
┌─────────────────────────────────────┐
│        Collector (Effect v4)        │
│                                     │
│  HTTP server — receives spans       │
│  Assembles spans into trace trees   │
│  Persists to SQLite via             │
│    effect/unstable/sql              │
└────────────────┬────────────────────┘
                 │ SQL queries
                 ▼
┌─────────────────────────────────────┐
│         Dashboard (Next.js)         │
│                                     │
│  Reads from SQLite                  │
│  Renders trace timelines            │
│  Served at localhost:4318           │
└─────────────────────────────────────┘
```

### Component Responsibilities

**SDK** (`src/sdk/`) — Tiny instrumentation library. Zero dependencies beyond `effect`. Wraps agent operations and emits span events to the collector over HTTP. Designed to be dropped into any TypeScript agent with one import.

**Collector** (`src/collector/`) — Effect v4 HTTP server. Receives span events, validates them with `effect/unstable/schema`, assembles them into trace trees, and writes to SQLite. Built with `effect/unstable/http` and `@effect/sql-sqlite-bun`.

**Dashboard** (`src/dashboard/`) — Next.js app. Reads directly from SQLite. Shows trace list, trace detail timeline, span detail, and a regression view. Served locally alongside the collector.

**CLI** (`src/cli/`) — Built with `effect/unstable/cli`. Entry point for `npx @thaletto/observe`. Starts the collector + dashboard together, opens the browser.

---

## 3. SDK Design

### Installation

```bash
bun add @thaletto/observe
# or
npm install @thaletto/observe
```

### Core API

The SDK exposes a single primary function: `observe`. It wraps any async operation and emits a span.

```ts
import { observe } from "@thaletto/observe"

// Wrap an LLM call
const result = await observe("llm.call", async () => {
  return anthropic.messages.create({ ... })
}, {
  model: "claude-sonnet-4-6",
  input_tokens: 1200,
})

// Wrap a tool invocation
const data = await observe("tool.call", async () => {
  return searchWeb(query)
}, {
  tool: "web_search",
  input: { query },
})
```

### Span Attributes

Developers can attach typed attributes to spans. The SDK provides attribute helpers for common AI patterns:

```ts
import { observe, attrs } from "@thaletto/observe"

const result = await observe("llm.call", () => callLLM(prompt), 
  attrs.llm({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    inputTokens: 1200,
    outputTokens: 340,
    promptPreview: prompt.slice(0, 200),
  })
)
```

### Nesting — Trace Trees

Spans automatically nest via async context propagation. The outermost `observe` call becomes the root span (the agent run). Inner calls become children.

```ts
// Root span — the full agent run
await observe("agent.run", async () => {

  // Child span — planning step
  const plan = await observe("agent.plan", () => callLLM(planPrompt))

  // Child span — tool call
  const results = await observe("tool.search", () => searchWeb(plan.query))

  // Child span — synthesis
  return await observe("agent.synthesize", () => callLLM(synthesizePrompt))

})
```

This produces a trace tree:
```
agent.run (1200ms)
  ├── agent.plan (340ms)
  ├── tool.search (420ms)
  └── agent.synthesize (280ms)
```

### Effect v4 Integration

For agents built with Effect, the SDK provides a native Effect wrapper:

```ts
import { ObserveEffect } from "@thaletto/observe/effect"

const program = ObserveEffect.span("agent.run")(
  Effect.gen(function* () {
    const plan = yield* ObserveEffect.span("agent.plan")(callLLM(planPrompt))
    const results = yield* ObserveEffect.span("tool.search")(searchWeb(plan.query))
    return yield* ObserveEffect.span("agent.synthesize")(callLLM(synthesizePrompt))
  })
)
```

### Configuration

```ts
import { configure } from "@thaletto/observe"

configure({
  collectorUrl: "http://localhost:4317",  // default
  enabled: process.env.NODE_ENV !== "production",  // disable in prod
  batchSize: 10,           // send spans in batches
  flushInterval: 1000,     // ms — flush even if batch not full
})
```

---

## 4. Trace Data Model

All data is modelled with `effect/unstable/schema`.

### Span

The atomic unit. Every `observe()` call produces one span.

```ts
import { Schema } from "effect/unstable/schema"

class Span extends Schema.Class<Span>("Span")({
  spanId:    Schema.String,           // uuid
  traceId:   Schema.String,           // uuid — shared across all spans in a run
  parentId:  Schema.Option(Schema.String),  // null for root span
  name:      Schema.String,           // e.g. "llm.call", "tool.search"
  startedAt: Schema.DateTimeUtc,
  endedAt:   Schema.DateTimeUtc,
  durationMs: Schema.Number,
  status:    Schema.Literal("ok", "error"),
  error:     Schema.Option(Schema.String),  // error message if status = "error"
  attrs:     Schema.Record(Schema.String, Schema.Unknown),  // arbitrary metadata
}) {}
```

### Trace

A tree of spans sharing a `traceId`. Assembled by the collector from individual spans.

```ts
class Trace extends Schema.Class<Trace>("Trace")({
  traceId:    Schema.String,
  rootSpan:   Span,
  spans:      Schema.Array(Span),
  startedAt:  Schema.DateTimeUtc,
  durationMs: Schema.Number,
  status:     Schema.Literal("ok", "error", "running"),
  spanCount:  Schema.Number,
}) {}
```

### LLM Span Attributes

Standard attribute shape for `llm.call` spans:

```ts
class LLMAttrs extends Schema.Class<LLMAttrs>("LLMAttrs")({
  provider:      Schema.String,                       // "anthropic", "openai"
  model:         Schema.String,                       // "claude-sonnet-4-6"
  inputTokens:   Schema.Option(Schema.Number),
  outputTokens:  Schema.Option(Schema.Number),
  costUsd:       Schema.Option(Schema.Number),
  promptPreview: Schema.Option(Schema.String),        // first 200 chars
  responsePreview: Schema.Option(Schema.String),
}) {}
```

---

## 5. Collector Backend

Built entirely with Effect v4.

### Service Architecture

```ts
import { ServiceMap } from "effect"

// Storage service
class TraceStore extends ServiceMap.Service<TraceStore>()("TraceStore", {
  make: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return {
      insertSpan: (span: Span) => ...,
      getTrace:   (traceId: string) => ...,
      listTraces: (limit: number) => ...,
    }
  })
}) {
  static readonly layer = Layer.effect(this, this.make)
}

// Ingestion service
class SpanIngester extends ServiceMap.Service<SpanIngester>()("SpanIngester", {
  make: Effect.gen(function* () {
    const store = yield* TraceStore
    return {
      ingest: (span: Span) => Effect.gen(function* () {
        const validated = yield* Schema.decode(Span)(span).pipe(
          Effect.mapError(e => new ValidationError({ cause: e }))
        )
        yield* store.insertSpan(validated)
      })
    }
  })
}) {
  static readonly layer = Layer.effect(this, this.make)
}
```

### HTTP API

Built with `effect/unstable/http`:

```
POST /spans          — ingest one or more spans from the SDK
GET  /traces         — list recent traces (paginated)
GET  /traces/:id     — get full trace tree by traceId
GET  /health         — liveness check
```

### Error Handling

Every failure mode is a typed error — not a thrown exception:

```ts
class ValidationError extends Data.TaggedError("ValidationError")<{
  cause: unknown
}> {}

class StorageError extends Data.TaggedError("StorageError")<{
  operation: string
  cause: unknown
}> {}

class SpanNotFoundError extends Data.TaggedError("SpanNotFoundError")<{
  spanId: string
}> {}

type CollectorError = ValidationError | StorageError | SpanNotFoundError
```

### Storage

SQLite via `@effect/sql-sqlite-bun`. Two tables:

```sql
CREATE TABLE spans (
  span_id     TEXT PRIMARY KEY,
  trace_id    TEXT NOT NULL,
  parent_id   TEXT,
  name        TEXT NOT NULL,
  started_at  INTEGER NOT NULL,  -- unix ms
  ended_at    INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  status      TEXT NOT NULL,
  error       TEXT,
  attrs       TEXT               -- JSON blob
);

CREATE TABLE traces (
  trace_id    TEXT PRIMARY KEY,
  started_at  INTEGER NOT NULL,
  duration_ms INTEGER,
  status      TEXT NOT NULL,
  span_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_spans_trace_id ON spans(trace_id);
CREATE INDEX idx_traces_started_at ON traces(started_at DESC);
```

---

## 6. Dashboard

Built with Next.js (App Router). Reads directly from SQLite — no separate API layer needed since it runs on the same machine.

### Views

**Trace List** (`/`)
- Table of recent traces sorted by time
- Columns: name (root span), status, duration, span count, timestamp
- Filter by status (ok / error)
- Click to open trace detail

**Trace Detail** (`/traces/:id`)
- Waterfall timeline showing all spans with relative start/end
- Each span row: name, duration, status indicator
- Click a span to open span detail panel
- Total duration, span count, error summary at top

**Span Detail** (side panel)
- Full span metadata: name, spanId, traceId, parentId
- Start time, end time, duration
- Status + error message if errored
- All attributes rendered as a key-value table
- For `llm.call` spans: prompt preview, response preview, token counts, estimated cost

**Regression View** (`/regression`)
- Select two time ranges
- Compare average duration, error rate, token usage between them
- Highlights spans that got slower or started erroring

### Design Principles

- Dark theme by default — developer tool aesthetic
- Waterfall timeline is the primary interaction surface
- No charts unless they add diagnostic value
- Fast — reads from local SQLite, no network latency

---

## 7. CLI

Entry point: `npx @thaletto/observe`

Built with `effect/unstable/cli`.

```bash
# Start dashboard + collector (default)
npx @thaletto/observe

# Custom port
npx @thaletto/observe --port 4318

# Don't open browser automatically
npx @thaletto/observe --no-open

# Show version
npx @thaletto/observe --version
```

On start:
1. Checks if port is available, exits with clear error if not
2. Starts SQLite database (creates `~/.observe/traces.db` if not exists)
3. Starts Effect v4 collector on `:4317`
4. Starts Next.js dashboard on `:4318`
5. Opens `http://localhost:4318` in default browser
6. Logs: `@thaletto/observe running at http://localhost:4318`

On `Ctrl+C`: graceful shutdown — closes HTTP server, flushes any pending spans, closes SQLite connection.

---

## 8. Effect v4 Patterns

The interesting technical decisions and why Effect v4 is the right tool here.

### Typed Errors Over Thrown Exceptions

The collector never throws. Every failure — malformed span, SQLite write failure, span not found — is a typed error in the `Effect<A, E, R>` error channel. The HTTP handler pattern-matches on error type to return the right HTTP status:

```ts
const handleIngest = HttpRouter.post("/spans", 
  Effect.gen(function* () {
    const body = yield* HttpServerRequest.json
    yield* ingester.ingest(body)
    return HttpServerResponse.empty({ status: 201 })
  }).pipe(
    Effect.catchTag("ValidationError", () => 
      HttpServerResponse.json({ error: "invalid span" }, { status: 400 })
    ),
    Effect.catchTag("StorageError", () =>
      HttpServerResponse.json({ error: "storage failed" }, { status: 500 })
    ),
  )
)
```

### Layer Composition

Each service is a `Layer`. The full collector is assembled by composing layers:

```ts
const CollectorLayer = Layer.mergeAll(
  TraceStore.layer,
  SpanIngester.layer,
  HttpServer.layer,
).pipe(
  Layer.provide(SqliteLive),
)
```

Testing any service is swapping its layer for a test double — no mocking framework needed.

### Graceful Shutdown

Effect's `Scope` handles cleanup. When the CLI receives `SIGINT`, the scope closes, which in order: stops accepting new HTTP connections, flushes in-flight spans, closes SQLite.

```ts
const program = Effect.scoped(
  Effect.gen(function* () {
    yield* HttpServer.serve(router)
    yield* Effect.never  // keep alive until scope closes
  })
)
```

### Schema Validation at the Boundary

Spans are untrusted input from the SDK. `effect/unstable/schema` validates at the HTTP boundary — invalid spans are rejected with typed `ValidationError` before touching storage.

---

## 9. Open Questions

These are not yet decided and need resolution before or during implementation:

| # | Question | Options | Notes |
|---|----------|---------|-------|
| 1 | Where to store the SQLite file? | `~/.observe/traces.db` vs `./.observe/traces.db` | Global (`~`) means traces persist across projects; local (`.`) means per-project isolation |
| 2 | How long to retain traces? | 7 days default, configurable | Need to decide if old traces auto-delete or just accumulate |
| 3 | SDK batching strategy | Batch by count (10) or time (1s), whichever first | Need to handle offline collector gracefully — queue and retry? |
| 4 | Async context propagation | `AsyncLocalStorage` for automatic parent span tracking | Need to verify Bun's `AsyncLocalStorage` behaviour matches Node |
| 5 | Effect v4 beta risk | v4 is beta — `unstable/*` modules may break | Acceptable for a portfolio/learning project; would use v3 for production |
| 6 | Dashboard tech | Next.js vs plain HTML served by Effect | Next.js adds complexity to the CLI bundle; plain HTML is simpler to ship |
| 7 | SDK bundle size | Effect as peer dependency vs bundled | If bundled, SDK becomes heavy for non-Effect agents — peer dep preferred |

---

## 10. Monorepo Structure

```
@thaletto/observe/
├── packages/
│   ├── sdk/               # @thaletto/observe — the npm package
│   │   ├── src/
│   │   │   ├── index.ts       # observe(), configure(), attrs
│   │   │   ├── effect.ts      # ObserveEffect wrapper
│   │   │   ├── context.ts     # AsyncLocalStorage span context
│   │   │   └── transport.ts   # HTTP batch sender
│   │   └── package.json
│   │
│   ├── collector/         # Effect v4 HTTP server
│   │   ├── src/
│   │   │   ├── main.ts        # Layer composition + server start
│   │   │   ├── routes.ts      # HttpRouter definitions
│   │   │   ├── ingester.ts    # SpanIngester service
│   │   │   ├── store.ts       # TraceStore service
│   │   │   └── schema.ts      # Span / Trace schemas
│   │   └── package.json
│   │
│   ├── dashboard/         # Next.js app
│   │   ├── app/
│   │   │   ├── page.tsx           # Trace list
│   │   │   ├── traces/[id]/       # Trace detail
│   │   │   └── regression/        # Regression view
│   │   └── package.json
│   │
│   └── cli/               # npx entry point
│       ├── src/
│       │   └── main.ts        # effect/unstable/cli definition
│       └── package.json
│
├── examples/
│   ├── basic-agent/       # Simple Anthropic agent with observe()
│   └── effect-agent/      # Effect-native agent with ObserveEffect
│
└── package.json           # Bun workspaces
```

---

## 11. Build Order

Suggested implementation sequence:

1. **Schema + data model** — define `Span`, `Trace`, and attribute types. Everything depends on this.
2. **Collector HTTP server** — `POST /spans` endpoint that validates and writes to SQLite. Testable standalone.
3. **SDK core** — `observe()` wrapper + HTTP transport. Test against the running collector.
4. **Dashboard — trace list + detail** — the two most important views.
5. **CLI** — wire collector + dashboard together, add `npx` entry.
6. **SDK — Effect integration** — `ObserveEffect` wrapper.
7. **Dashboard — regression view** — stretch goal, add last.
