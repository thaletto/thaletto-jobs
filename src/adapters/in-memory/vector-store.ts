import { Effect, Layer } from "effect";
import { VectorStore, type VectorStoreShape } from "../zvec/vector-store.ts";
import { SearchResult, StoredEntry } from "../../schema/index.ts";
import type { VectorId, VectorMetadata } from "../../schema/index.ts";
import { VectorNotFoundError } from "../../errors/index.ts";

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function isExpired(metadata: VectorMetadata): boolean {
  return metadata.expiresAt !== null && metadata.expiresAt.getTime() <= Date.now();
}

interface StoredVector {
  readonly vector: Float32Array
  readonly metadata: VectorMetadata
  readonly createdAt: Date
}

export const InMemoryVectorStoreLive: Layer.Layer<VectorStore> = Layer.effect(
  VectorStore,
  Effect.gen(function* () {
    const vectors = new Map<VectorId, StoredVector>();

    const shape: VectorStoreShape = {
      store: (id, vector, metadata) =>
        Effect.sync(() => {
          vectors.set(id, { vector, metadata, createdAt: new Date() });
        }),

      search: (queryVector, options) =>
        Effect.sync(() => {
          const topk = options.limit ?? 10;
          const candidates: Array<{
            id: VectorId
            score: number
            metadata: VectorMetadata
          }> = [];

          for (const [id, stored] of vectors) {
            if (isExpired(stored.metadata)) continue;
            if (options.category !== undefined && stored.metadata.category !== options.category) continue;
            if (options.tags !== undefined && !options.tags.some(t => stored.metadata.tags.includes(t))) continue;

            candidates.push({
              id,
              score: cosineSimilarity(queryVector, stored.vector),
              metadata: stored.metadata,
            });
          }

          return candidates
            .sort((a, b) => b.score - a.score)
            .slice(0, topk)
            .map(r => new SearchResult({
              id: r.id,
              score: r.score,
              content: r.metadata.content,
              category: r.metadata.category,
              tags: r.metadata.tags,
              metadata: r.metadata.metadata,
              expiresAt: r.metadata.expiresAt,
            }));
        }),

      getEntry: (id) =>
        Effect.suspend(() => {
          const stored = vectors.get(id);
          if (stored === undefined) {
            return Effect.fail(new VectorNotFoundError({ id }));
          }
          return Effect.succeed(
            new StoredEntry({
              id,
              content: stored.metadata.content,
              category: stored.metadata.category,
              tags: stored.metadata.tags,
              metadata: stored.metadata.metadata,
              expiresAt: stored.metadata.expiresAt,
              createdAt: stored.createdAt,
            })
          );
        }),

      deleteEntry: (id) =>
        Effect.sync(() => {
          vectors.delete(id);
        }),

      size: Effect.sync(() => vectors.size),
    };

    return shape;
  })
);
