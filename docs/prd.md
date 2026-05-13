# PRD: Cortex (Effect Memory Layer)

## 1. Problem Statement

**Problem:** Effect developers need a **developer-controlled context memory system** for:
- AI/LLM applications requiring persistent context storage
- Applications needing semantic memory retrieval
- Developer-explicit memory management (not automatic state persistence)
- Type-safe context storage with similarity search capabilities

**Current Pain Points:**
- Manual context management in AI applications
- No native Effect solution for semantic memory
- Complex integration with vector databases for context
- Lack of developer-controlled memory patterns

## 2. Proposed Solution

**Product:** `@thaletto/cortex` - A developer-controlled context memory layer for Effect applications

### Core Features:
- **Explicit Context Storage**: Developers choose what to store and when
- **Semantic Memory**: Vector search for retrieving related context
- **Developer API**: Simple methods to add, search, and manage context
- **Type Safety**: Full TypeScript support with Effect Schema
- **Performance**: Optimized for Effect async patterns

### Developer Experience:
```typescript
import { MemoryService } from "@thaletto/cortex"

const memory = MemoryService.of()

const storeContext = await Effect.runPromise(
  memory.add({
    id: "user-123",           // Developer-provided ID (required)
    content: "User prefers TypeScript over JavaScript",
    category: "user-preferences"
  })
)

const relevantContext = await Effect.runPromise(
  memory.search({
    queryText: "user programming preferences",
    options: { category: "user-preferences", limit: 5 }
  })
)
```

## 3. Architecture

### High-Level Architecture:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Effect Library                                │
│                           (`npm` package)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                       @thaletto/cortex Package                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  MemoryService  │  │ ContextManager │  │  VectorEngine   │          │
│  │                 │  │                │  │                 │          │
│  │ • add()         │  │ • Validation   │  │ • Storage       │          │
│  │ • addMany()     │  │ • TTL Check    │  │ • Similarity    │          │
│  │ • search()      │  │ • Indexing     │  │ • Interface     │          │
│  │ • searchMany()  │  │                │  │                 │          │
│  │ • delete()      │  │                │  │                 │          │
│  │ • query()       │  │                │  │                 │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
├─────────────────────────────────────────────────────────────────────────┤
│                              Data Flow                                  │
│  Developer  →  MemoryService  →  ContextManager  →  VectorEngine        │
│                              ↓                                          │
│                      VectorStore (pluggable)                           │
│                                                                         │
│  Cleanup: Effect.schedule for periodic cleanup                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions:

| Decision | Choice | Rationale |
|---|---|---|
| ID Ownership | Developer-provided only | Eliminates existence checks, explicit contract |
| API Structure | Service-based | Effect DI, testable, composable |
| Embeddings | Interface (users provide impl) | Clean boundaries, no API key exposure |
| Vector Storage | Zvec (in-process, WAL persistence) | Battle-tested at Alibaba, zero infra, hybrid search |
| Error Handling | Data.TaggedError | Effect-native, typed, exhaustive |
| Search/Filters | Unified (queryText + filters) | Single method, predictable |
| TTL | Invisible on read | No background processes, devs schedule cleanup |
| Caching | None (add later if needed) | Measure first, avoid premature complexity |
| Batch Ops | Yes (addMany, searchMany) | AI apps need bulk storage |

### Detailed Component Breakdown:

#### 1. **MemoryService** (Developer Interface)
```typescript
class MemoryService {
  add(input: ContextInput): Effect<ContextId, MemoryError>
  addMany(inputs: ContextInput[]): Effect<Array<ContextId>, MemoryError>
  search(options: SearchOptions): Effect<Array<Context>, MemoryError>
  searchMany(queries: SearchOptions[]): Effect<Array<Array<Context>>, MemoryError>
  delete(id: ContextId): Effect<void, MemoryError>
  query(filter: ContextFilter): Effect<Array<Context>, MemoryError>
}
```

#### 2. **ContextInput** (Storage Contract)
```typescript
interface ContextInput {
  id: string                     // Required — developer provides
  content: string                 // Text to embed and store
  category: string                // User-defined category
  metadata?: Record<string, unknown>  // Optional metadata
  tags?: string[]                // Optional search tags
  expiresAt?: Date               // Optional TTL (checked on read)
}
```

#### 3. **SearchOptions** (Unified Query)
```typescript
interface SearchOptions {
  queryText?: string             // Semantic query (embedding lookup)
  category?: string              // Filter by category
  tags?: string[]                // Filter by tags
  limit?: number                // Max results (default: 10)
  threshold?: number            // Similarity threshold (0-1)
  metadata?: Record<string, unknown>  // Metadata filter
}
```

#### 4. **Error Types** (Effect Data.TaggedError)
```typescript
class MemoryError extends Data.TaggedClass {
  readonly _tag: "NotFound"
  readonly id: string
}

class ValidationError extends Data.TaggedClass {
  readonly _tag: "ValidationFailed"
  readonly errors: string[]
}

class VectorStoreError extends Data.TaggedClass {
  readonly _tag: "VectorStoreError"
  readonly cause: unknown
}

class EmbeddingError extends Data.TaggedClass {
  readonly _tag: "EmbeddingError"
  readonly cause: unknown
}
```

#### 5. **ContextManager** (Business Logic)
```typescript
class ContextManager {
  store(input: ContextInput): Effect<ContextId, MemoryError>
  retrieve(id: ContextId): Effect<Option<Context>, MemoryError>
  search(options: SearchOptions): Effect<Array<Context>, MemoryError>
  delete(id: ContextId): Effect<void, MemoryError>
  cleanupExpired(): Effect<void, MemoryError>  // For Effect.schedule use
}
```

#### 6. **VectorEngine** (Abstraction Layer)
```typescript
interface VectorStore {
  store(id: string, vector: Float32Array, metadata: ContextMetadata): Effect<void, MemoryError>
  search(queryVector: Float32Array, options: SearchOptions): Effect<Array<VectorResult>, MemoryError>
  delete(id: string): Effect<void, MemoryError>
  get(id: string): Effect<Option<VectorResult>, MemoryError>
}

interface EmbeddingService {
  embed(text: string): Effect<Float32Array, EmbeddingError>
}
```

#### 7. **Default Storage** (Phase 1)
```typescript
// Zvec — in-process vector DB with WAL persistence
// Supports hybrid search (dense + sparse vectors, metadata filters)
import { ZvecClient } from "zvec"

class ZvecVectorStore implements VectorStore {
  constructor(
    private collection: string,
    private client: ZvecClient
  ) {}

  store(id: string, vector: Float32Array, metadata: ContextMetadata): Effect<void, MemoryError>
  search(queryVector: Float32Array, options: SearchOptions): Effect<Array<VectorResult>, MemoryError>
  delete(id: string): Effect<void, MemoryError>
  get(id: string): Effect<Option<VectorResult>, MemoryError>
}
```

### Data Flow:
```
add(input)
  └─ Validate (ContextManager)
  └─ Embed text (EmbeddingService)
  └─ Store vector + metadata (VectorStore)
  └─ Return ContextId

search(options)
  └─ Embed queryText if present (EmbeddingService)
  └─ Query VectorStore (similarity + filters)
  └─ Filter expired (expiresAt > now)
  └─ Return Array<Context>

delete(id)
  └─ Remove from VectorStore
  └─ No cache invalidation needed

cleanupExpired() — exposed for Effect.schedule usage
  └─ Scan all entries
  └─ Remove where expiresAt < now
```

## 4. Actors Involved

### Technologies:
- **Language**: TypeScript (ES2022+)
- **Framework**: Effect
- **Vector Engine**: Zvec (in-process, WAL persistence) with interface for pluggability
- **Testing**: Effect Testing, Vitest
- **Build**: TypeScript, Rollup

### Dependencies:
```json
{
  "effect": "^latest",
  "effect-schema": "^latest",
  "@zvec/zvec": "^latest"
}
```

### Target Users:
- Effect developers building AI/LLM applications
- Teams needing context persistence
- Chatbot and agent developers
- Applications requiring semantic memory

## 5. Project Plan

### Current Status (as of 2026-05-14)

**Implemented:**
- [x] Project structure with Effect + TypeScript
- [x] `VectorStore` service interface (store, search, getEntry, deleteEntry, size)
- [x] `ZVecCollection` adapter with `ZVecCollectionLive` layer
- [x] Domain schema types (`VectorMetadata`, `StoredEntry`, `SearchResult`, `SearchOptions`, `VectorId`)
- [x] Error types (`VectorStoreError`, `VectorNotFoundError`, `VectorDecodeError`)
- [x] Codec utilities for serialization/deserialization
- [x] Filter building for category/tag/TTL queries
- [x] Demo application in `demo/index.ts`

**In Progress:**
- [ ] TTL filtering on read — filter expression exists, needs implementation in `getEntry`
- [ ] In-memory fallback for testing

**Not Started:**
- [ ] `MemoryService` (high-level API with add, addMany, search, searchMany, delete, query)
- [ ] `ContextManager` (validation, embedding orchestration)
- [ ] `EmbeddingService` interface + OpenAI adapter
- [ ] Unit tests
- [ ] Batch operations (addMany, searchMany)
- [ ] Similarity threshold support

### Phase 1: Core MemoryService API (Weeks 1-3)
- [x] Setup project structure and build system
- [x] Define VectorStore interface (store, search, getEntry, deleteEntry, size)
- [ ] Implement MemoryService (add, addMany, search, searchMany, delete, query)
- [x] Implement ZvecVectorStore
- [ ] Implement ContextManager with validation
- [x] Implement error types (Data.TaggedError)
- [ ] Add EmbeddingService interface
- [ ] Write unit tests

### Phase 2: Search & Filtering (Weeks 4-5)
- [x] Implement SearchOptions (category, tags filters)
- [ ] Implement queryText embedding lookup
- [ ] Add similarity threshold support
- [x] Implement TTL filtering on read (via filter expression)
- [ ] Add batch search (searchMany)

### Phase 3: Developer Experience (Weeks 6-7)
- [ ] Create default OpenAI EmbeddingService adapter
- [ ] Create comprehensive documentation
- [ ] Add AI application examples (chatbot, RAG, agent)
- [ ] Implement configuration system (configurable embedding, store)
- [ ] Document cleanup scheduling with Effect.schedule

### Phase 4: Polish & Release (Week 8)
- [ ] Performance profiling (no caching initially)
- [ ] Package publication
- [ ] GitHub setup
- [ ] Community outreach
- [ ] Feedback collection

### Success Metrics:
- [ ] Package published with AI application examples
- [ ] GitHub stars >50
- [ ] Positive developer feedback
- [ ] Zero critical bugs in production

## 6. Key Differentiators

### Why This Package?
- **Developer Control**: Explicit context storage, developer-provided IDs, not automatic state persistence
- **Effect Native**: Built specifically for Effect Service pattern and ecosystem
- **Pluggable Storage**: In-process for dev, upgrade path to cloud vector DBs
- **Type-Safe**: Full TypeScript integration with Effect `Data.TaggedError` errors
- **Batch-First**: addMany/searchMany for AI use cases
- **Clean Boundaries**: EmbeddingService is user-provided, Cortex owns storage/search

### Competitors:
- **Generic Vector DBs**: Complex setup, not Effect-native, require infrastructure
- **Manual Implementation**: Time-consuming, error-prone, inconsistent patterns
- **Other Memory Libraries**: Lack Effect integration, lack batch operations, over-engineered

## 7. Risks & Mitigation

### Technical Risks:
- **Embedding Provider Dependency**: Interface is clean, users bring their own. No API key exposure.
- **Memory Management**: No caching initially. Developers use Effect.schedule for cleanup.
- **Vector Store Migration**: Interface-first design enables future migration without API changes.

### Project Risks:
- **Scope Creep**: Strict 8-week timeline with clear phases
- **Effect Compatibility**: Test with multiple Effect versions
- **Adoption**: Focus on AI/Effect community for initial users

---

**Estimated Timeline**: 8 weeks (2 months)
**Target Audience**: Effect developers building AI applications
**Launch Goal**: Production-ready package with comprehensive documentation and examples