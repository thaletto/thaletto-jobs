import { Effect, Schema as S } from "effect";
import { SearchResult, SerializedRow, StoredEntry, VectorId, type VectorMetadata } from "../schema/index.ts";
import { VectorDecodeError } from "../errors/index.ts";

export function encodeRow(metadata: VectorMetadata): Record<string, unknown> {
    return {
        content: metadata.content,
        category: metadata.category,
        tags: metadata.tags.join(" "),
        metadata_json: JSON.stringify(metadata.metadata),
        expires_at: metadata.expiresAt ? metadata.expiresAt.getTime() : -1,
        created_at: Date.now()
    };
}

const decodeRow = S.decodeUnknownEffect(SerializedRow);

function parseMetadata(raw: string) {
    return Effect.try({
        try: () => JSON.parse(raw) as Record<string, unknown>,
        catch: (cause) =>
            new VectorDecodeError({
                cause,
                field: "metadata_json"
            })
    });
}

export function decodeStoredEntry(id: string, rawFields: Record<string, unknown>) {
    return Effect.gen(function* () {
        const row = yield* decodeRow(rawFields).pipe(
            Effect.mapError(cause => new VectorDecodeError({ cause, field: "row" }))
        );

        return new StoredEntry({
            id: S.decodeSync(VectorId)(id),
            content: row.content,
            category: row.category,
            tags: row.tags.split(" ").filter(Boolean),
            metadata: yield* parseMetadata(row.metadata_json),
            expiresAt: row.expires_at > 0 ? new Date(row.expires_at) : null,
            createdAt: new Date(row.created_at),
        })
    })
}

export function decodeSearchResult(id: string, score: number, rawFields: Record<string, unknown>) {
    return Effect.gen(function* () {
        const row = yield* decodeRow(rawFields).pipe(
            Effect.mapError(cause => new VectorDecodeError({ cause, field: "row" }))
        );

        return new SearchResult({
            id: S.decodeSync(VectorId)(id),
            score,
            content: row.content,
            category: row.category,
            tags: row.tags.split(" ").filter(Boolean),
            metadata: yield* parseMetadata(row.metadata_json),
            expiresAt: row.expires_at > 0 ? new Date(row.expires_at) : null
        })
    })
}