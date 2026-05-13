/**
 * Simple demo showing the current VectorStore capabilities.
 * Run with: bun run demo/index.ts
 */

import { Effect, Layer, Schema as S } from "effect";
import { VectorStore, VectorStoreLive, ZVecCollectionLive, ZVecCollectionConfig } from "../src/index.ts";
import { VectorMetadata, VectorId } from "../src/schema/index.ts";

const fakeEmbedding = (seed: number, dim: number): Float32Array => {
    const vec = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        vec[i] = Math.sin(seed + i * 0.1);
    }
    return vec;
};

const ConfigLayer = Layer.succeed(ZVecCollectionConfig, { dimension: 128 });
const CollectionLayer = Layer.provideMerge(ZVecCollectionLive, ConfigLayer);
const DemoLayer = Layer.provideMerge(VectorStoreLive, CollectionLayer);

const doc1 = S.decodeSync(VectorId)("doc1");
const doc2 = S.decodeSync(VectorId)("doc2");
const doc3 = S.decodeSync(VectorId)("doc3");
const doc4 = S.decodeSync(VectorId)("doc4");

Effect.runPromise(
    Effect.gen(function* () {
        const store = yield* VectorStore;

        console.log("=== Storing vectors ===\n");

        const docs = [
            { id: doc1, text: "TypeScript is a typed superset of JavaScript", tags: ["lang", "web"] },
            { id: doc2, text: "Python is great for data science and AI", tags: ["lang", "ai"] },
            { id: doc3, text: "Rust provides memory safety without garbage collection", tags: ["lang", "systems"] },
            { id: doc4, text: "Go is designed for concurrent server-side applications", tags: ["lang", "servers"] },
        ];

        for (const doc of docs) {
            const metadata = new VectorMetadata({
                content: doc.text,
                category: "programming",
                tags: doc.tags,
                metadata: { source: "demo" },
                expiresAt: null
            });
            yield* store.store(doc.id, fakeEmbedding(42, 128), metadata);
            console.log(`Stored: ${doc.id} - "${doc.text.substring(0, 40)}..."`);
        }

        console.log(`\nTotal vectors: ${yield* store.size}\n`);

        console.log("=== Searching for similar ===\n");

        const queryVector = fakeEmbedding(99, 128);
        const results = yield* store.search(queryVector, { limit: 3 });

        for (const result of results) {
            console.log(`[${result.id}] score=${result.score.toFixed(3)} | ${result.content.substring(0, 50)}...`);
            console.log(`  tags: ${result.tags.join(", ")}\n`);
        }

        console.log("=== Fetching doc2 ===\n");
        const entry = yield* store.getEntry(doc2);
        if (entry) {
            console.log(`Content: ${entry.content}`);
            console.log(`Category: ${entry.category}`);
            console.log(`Created: ${entry.createdAt.toISOString()}`);
        }

        console.log("\n=== Deleting doc4 ===\n");
        yield* store.deleteEntry(doc4);
        console.log(`Size after delete: ${yield* store.size}`);

    }).pipe(Effect.provide(DemoLayer))
);