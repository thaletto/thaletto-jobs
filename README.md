# @thaletto/cortex

> Developer-controlled context memory layer for Effect applications

Vector storage for AI/LLM applications, built with [Effect](https://effect.website) and [ZVec](https://github.com/zvec/zvec). Type-safe, pluggable, and designed for explicit memory management.

![Cortex Banner](/assets/cortex-banner.png)

> **⚠️ Beta** — Effect v4 beta. API may change.

## Install

```bash
bun add @thaletto/cortex
```

## Quick Start

```typescript
import { Effect, Layer, Schema as S } from "effect";
import {
  VectorStore, VectorStoreLive,
  ZVecCollectionLive, ZVecCollectionConfig,
  VectorMetadata, VectorId,
} from "@thaletto/cortex";

const layer = Layer.provideMerge(VectorStoreLive, Layer.provideMerge(
  ZVecCollectionLive,
  Layer.succeed(ZVecCollectionConfig, { dimension: 128 }),
));

const program = Effect.gen(function* () {
  const store = yield* VectorStore;

  const id = S.decodeSync(VectorId)("doc-1");
  yield* store.store(id, new Float32Array(128), new VectorMetadata({
    content: "User prefers TypeScript over JavaScript",
    category: "preferences",
    tags: ["lang"],
    metadata: {},
    expiresAt: null,
  }));

  const results = yield* store.search(new Float32Array(128), {
    limit: 5,
    category: "preferences",
  });
});

Effect.runPromise(program.pipe(Effect.provide(layer)));
```

## API

### VectorStore

| Method | Signature | Description |
|--------|-----------|-------------|
| `store` | `(id, vector, metadata) => Effect<void, VectorStoreErrors>` | Upsert a vector + metadata |
| `search` | `(queryVector, options) => Effect<SearchResult[], VectorStoreErrors>` | Nearest-neighbour search with filters |
| `getEntry` | `(id) => Effect<StoredEntry, VectorStoreErrors>` | Fetch by ID (fails with `VectorNotFoundError`) |
| `deleteEntry` | `(id) => Effect<void, VectorStoreErrors>` | Remove entry (no-op if missing) |
| `size` | `Effect<number, VectorStoreErrors>` | Total stored vectors |

### SearchOptions

| Field | Type | Default |
|-------|------|---------|
| `limit` | `number` (1–1000) | `10` |
| `category` | `string` | — |
| `tags` | `string[]` | — |

Expired entries (by `expiresAt`) are always excluded from search results.

### Error Types

- `VectorStoreError` - storage operation failed
- `VectorNotFoundError` - entry not found (by tag: `"_tag": "VectorNotFoundError"`)
- `VectorDecodeError` - data corruption on read

## Adapters

### ZVec (default)

Persistent, in-process vector database with WAL persistence. Configured via `ZVecCollectionConfig`:

```typescript
const layer = Layer.provideMerge(VectorStoreLive, Layer.provideMerge(
  ZVecCollectionLive,
  Layer.succeed(ZVecCollectionConfig, { dimension: 128 }),
));
```

Data is stored in `.cortex/`.

### InMemory (testing)

```typescript
import { InMemoryVectorStoreLive } from "@thaletto/cortex";

const program = Effect.gen(function* () {
  const store = yield* VectorStore;
  // ...
}).pipe(Effect.provide(InMemoryVectorStoreLive));
```

Fresh state per `Effect.provide` call — no cleanup needed. Great for tests.

## Demo

```bash
bun run example
# or with a custom file:
bun run example/index.ts path/to/document.txt
```

Chunks a text file, indexes vectors, and starts an interactive search prompt:

```
  File: ./example/sample.txt
  Chunks: 8
  Storing vectors...

  Stored 8 chunks. Ready.

Search >
  [0.468] TypeScript adds static type checking to JavaScript...
  [0.410] designed as a drop-in replacement for Node.js...
  [0.369] computing, Pandas for data manipulation...

Search > quit
```

## Development

```bash
bun install
bun test          # 31 tests (17 in-memory + 14 ZVec)
bun run example   # interactive CLI demo
```

## Status

| Feature | Status |
|---------|--------|
| `VectorStore` interface | Done |
| ZVec adapter | Done |
| InMemory adapter | Done |
| `MemoryService` (high-level API) | Planned |
| `ContextManager` (validation, TTL) | Planned |
| `EmbeddingService` integration | Planned |
| Batch operations | Planned |

## License

MIT
