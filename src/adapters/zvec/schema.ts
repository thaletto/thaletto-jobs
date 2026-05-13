/**
 * @file CollectionSchema.ts
 * ZVec collection schema factory — pure function, no side effects.
 * Isolated here so it can be tested or swapped without touching logic.
 */

import {
    ZVecCollectionSchema,
    ZVecDataType,
    ZVecIndexType,
    ZVecMetricType,
} from "@zvec/zvec";
import { Effect, Schema as S } from "effect";

export const VECTOR_FIELD = "content_embedding" as const;

export class ZVecConfig extends S.Class<ZVecConfig>("ZVecConfig")({
    dimension:
        S.optional(
            S.Int
                .check(
                    S.isBetween({
                        minimum: 1,
                        maximum: 65536
                    })
                )
        )
            .pipe(
                S.withDecodingDefault(Effect.succeed(384))
            )
}) { }

export function makeCollectionSchema(dimension: number | undefined): ZVecCollectionSchema {
    return new ZVecCollectionSchema({
        name: "cortex",
        fields: [
            {
                name: "content",
                dataType: ZVecDataType.STRING,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
            {
                name: "category",
                dataType: ZVecDataType.STRING,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
            {
                name: "tags",
                dataType: ZVecDataType.STRING,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
            {
                name: "metadata_json",
                dataType: ZVecDataType.STRING,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
            {
                name: "expires_at",
                dataType: ZVecDataType.INT64,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
            {
                name: "created_at",
                dataType: ZVecDataType.INT64,
                indexParams: { indexType: ZVecIndexType.INVERT },
            },
        ],
        vectors: [
            {
                name: VECTOR_FIELD,
                dataType: ZVecDataType.VECTOR_FP32,
                dimension: dimension ?? 384,
                indexParams: {
                    indexType: ZVecIndexType.HNSW,
                    metricType: ZVecMetricType.COSINE,
                },
            },
        ],
    });
}