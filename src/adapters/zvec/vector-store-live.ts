/**
 * @file VectorStoreLive.ts
 * Live Layer that implements VectorStore using ZvecCollection.
 * Internal — not exported from the public index.
 * Callers provision this via the composed layers in index.ts.
 */

import { Effect, Layer } from "effect";
import { VectorStore } from "@/adapters/zvec/vector-store.js";
import { ZVecCollection } from "@/adapters/zvec/collection.js";
import { encodeRow, decodeStoredEntry, decodeSearchResult } from "@/lib/codec.js";
import { buildFilter } from "@/lib/filters.js";
import { VECTOR_FIELD } from "@/adapters/zvec/schema.js";
import { VectorStoreError } from "@/errors/index.js";
import type {
    VectorId,
    VectorMetadata,
    SearchOptions,
} from "@/schema/index.js";

// ── Utility ───────────────────────────────────────────────────────────────────

const lift = <A>(
    fn: () => A,
    message?: string
) =>
    Effect.try({
        try: fn,
        catch: cause => new VectorStoreError({
            cause,
            ...(message !== undefined ? { message } : {})
        }),
    });

const toVec = (v: Float32Array): number[] => Array.from(v);

// ── Layer ─────────────────────────────────────────────────────────────────────

export const VectorStoreLive = Layer.effect(
    VectorStore,
    Effect.gen(function* () {
        const collection = yield* ZVecCollection;

        // ── store ─────────────────────────────────────────────────────────────────

        const store = (
            id: VectorId,
            vector: Float32Array,
            metadata: VectorMetadata
        ) =>
            lift(
                () =>
                    (collection as any).upsertSync({
                        id,
                        vectors: { [VECTOR_FIELD]: toVec(vector) },
                        fields: encodeRow(metadata),
                    }),
                `Failed to store vector ${id}`
            );

        // ── search ────────────────────────────────────────────────────────────────

        const search = (queryVector: Float32Array, options: SearchOptions) =>
            Effect.gen(function* () {
                const raw = yield* lift(
                    () =>
                        collection.querySync({
                            fieldName: VECTOR_FIELD,
                            vector: toVec(queryVector),
                            topk: options.limit ?? 10,
                            filter: buildFilter(options),
                        }),
                    "Vector search failed"
                );

                // Decode each result, collecting errors — a bad row is skipped, not fatal
                return yield* Effect.all(
                    raw.map(r =>
                        decodeSearchResult(
                            r.id,
                            r.score,
                            r.fields as Record<string, unknown>
                        )
                    ),
                    { concurrency: "unbounded" }
                );
            });

        // ── getEntry ──────────────────────────────────────────────────────────────

        const getEntry = (id: VectorId) =>
            Effect.gen(function* () {
                const result = yield* lift(
                    () => collection.fetchSync(id),
                    `Failed to fetch vector ${id}`
                );

                if (!result?.[id]) return null;

                const r = result[id];
                return yield* decodeStoredEntry(
                    r.id,
                    r.fields as Record<string, unknown>
                );
            });

        // ── deleteEntry ───────────────────────────────────────────────────────────

        const deleteEntry = (id: VectorId) =>
            lift(
                () => collection.deleteSync(id),
                `Failed to delete vector ${id}`
            );

        // ── size ──────────────────────────────────────────────────────────────────

        const size = lift(
            () => collection.stats.docCount,
            "Failed to read collection size"
        );

        return { store, search, getEntry, deleteEntry, size };
    })
);