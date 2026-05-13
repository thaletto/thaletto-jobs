/**
 * @file src/schema/index.ts
 * All domain types for the VectorStore, defined with effect/Schema.
 */

import { Schema as S } from "effect";

/**
 * PRIMITIVES
 */

export const VectorId = S.String.pipe(S.brand("VectorId"));
export type VectorId = typeof VectorId.Type;

export const EmbeddingDimension = S.Int.check(
    S.isBetween({ minimum: 1, maximum: 65536 }),
).pipe(
    S.brand("EmbeddingDimension")
);
export type EmbeddingDimension = typeof EmbeddingDimension.Type

/**
 * CLASSES
 */

export class VectorMetadata extends S.Class<VectorMetadata>("VectorMetadata")({
    content: S.String,
    category: S.String,
    tags: S.Array(S.String),
    metadata: S.Record(S.String, S.Unknown),
    expiresAt: S.NullOr(S.Date)
}) { }

export class StoredEntry extends S.Class<StoredEntry>("StoredEntry")({
    id: VectorId,
    content: S.String,
    category: S.String,
    tags: S.Array(S.String),
    metadata: S.Record(S.String, S.Unknown),
    expiresAt: S.NullOr(S.Date),
    createdAt: S.Date,
}) { }

export class SearchResult extends S.Class<SearchResult>("SearchResult")({
    id: VectorId,
    score: S.Number,
    content: S.String,
    category: S.String,
    tags: S.Array(S.String),
    metadata: S.Record(S.String, S.Unknown),
    expiresAt: S.NullOr(S.Date)
}) { }

export class SearchOptions extends S.Class<SearchOptions>("SearchOptions")({
    limit: S.optional(S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 }))),
    category: S.optional(S.String),
    tags: S.optional(S.Array(S.String)),
}) { }

export class SerializedRow extends S.Class<SerializedRow>("SerializedRow")({
    content: S.String,
    category: S.String,
    tags: S.String, // space-joined
    metadata_json: S.String, // JSON.stringify'd
    expires_at: S.Number, // epoch millis or -1
    created_at: S.Number, // epoch millis
}) { }