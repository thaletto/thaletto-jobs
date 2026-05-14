/**
 * @file VectorStore.ts
 * The public-facing VectorStore service definition.
 * This is the ONLY thing callers depend on — all ZVec details are hidden behind it.
 *
 * Callers:
 *   const vs = yield* VectorStore
 *   yield* vs.store(id, vector, metadata)
 */

import { Context, Effect } from "effect";
import type { SearchOptions, SearchResult, StoredEntry, VectorId, VectorMetadata } from "../../schema/index.ts";
import type { VectorStoreErrors } from "../../errors/index.ts";

export interface VectorStoreShape {
  /**
   * Upsert a vector + metadata under the given id.
   * Replaces any existing entry with the same id.
   */
  readonly store: (
    id:       VectorId,
    vector:   Float32Array,
    metadata: VectorMetadata
  ) => Effect.Effect<void, VectorStoreErrors>;

  /**
   * Nearest-neighbour search. Expired entries are always excluded.
   */
  readonly search: (
    queryVector: Float32Array,
    options:     SearchOptions
  ) => Effect.Effect<ReadonlyArray<SearchResult>, VectorStoreErrors>;

  /**
   * Fetch a single entry by id. Fails with VectorNotFoundError when not found.
   */
  readonly getEntry: (
    id: VectorId
  ) => Effect.Effect<StoredEntry, VectorStoreErrors>;

  /**
   * Delete an entry by id. No-ops silently when not found.
   */
  readonly deleteEntry: (
    id: VectorId
  ) => Effect.Effect<void, VectorStoreErrors>;

  /**
   * Total number of stored vectors (including expired ones not yet GC'd).
   */
  readonly size: Effect.Effect<number, VectorStoreErrors>;
}

export class VectorStore extends Context.Service<
  VectorStore,
  VectorStoreShape
>()("@cortex/VectorStore") {}