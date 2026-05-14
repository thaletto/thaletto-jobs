/**
 * Real-world demo: chunk a text file, store vectors, search via CLI.
 * Run: bun run example/index.ts [path-to-file]
 * Default: example/sample.txt
 */

import { Effect, Layer, Schema as S, Console } from "effect";
import { VectorStore, VectorStoreLive, ZVecCollectionLive, ZVecCollectionConfig } from "../src/index.ts";
import { VectorMetadata, VectorId } from "../src/schema/index.ts";
import { readFileSync, existsSync } from "node:fs";
import * as readline from "node:readline";

const DIM = 128;

function textToVector(text: string, dim: number = DIM): Float32Array {
  const v = new Float32Array(dim);
  const lower = text.toLowerCase();
  // Hash character trigrams into vector positions
  for (let i = 0; i < lower.length - 2; i++) {
    const tri = lower.charCodeAt(i) * 97 + lower.charCodeAt(i + 1) * 31 + lower.charCodeAt(i + 2);
    const pos = Math.abs(tri) % dim;
    v[pos] += 1;
  }
  // Normalize to unit vector
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

function chunkText(text: string, maxWords: number = 80, overlap: number = 20): Array<{ text: string; index: number }> {
  const words = text.split(/\s+/);
  const chunks: Array<{ text: string; index: number }> = [];
  let start = 0;
  let idx = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    chunks.push({ text: words.slice(start, end).join(" "), index: idx });
    idx++;
    if (end >= words.length) break;
    start += maxWords - overlap;
  }
  return chunks;
}

const ConfigLayer = Layer.succeed(ZVecCollectionConfig, { dimension: DIM });
const CollectionLayer = Layer.provideMerge(ZVecCollectionLive, ConfigLayer);
const DemoLayer = Layer.provideMerge(VectorStoreLive, CollectionLayer);

Effect.runPromise(
  Effect.gen(function* () {
    const store = yield* VectorStore;

    const filePath = process.argv[2] || "./example/sample.txt";
    if (!existsSync(filePath)) {
      yield* Console.log(`File not found: ${filePath}`);
      yield* Console.log("Create a .txt file or pass an existing path as argument.");
      return;
    }

    const text = readFileSync(filePath, "utf-8");
    const chunks = chunkText(text);

    yield* Console.log(`\n  File: ${filePath}`);
    yield* Console.log(`  Chunks: ${chunks.length}`);
    yield* Console.log("  Storing vectors...\n");

    for (const chunk of chunks) {
      const id = S.decodeSync(VectorId)(`chunk-${chunk.index}`);
      const meta = new VectorMetadata({
        content: chunk.text,
        category: "knowledge",
        tags: [],
        metadata: { source: filePath },
        expiresAt: null,
      });
      yield* store.store(id, textToVector(chunk.text), meta);
    }

    yield* Console.log(`  Stored ${chunks.length} chunks. Ready.\n`);

    // Interactive search loop
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const question = (query: string) =>
      Effect.promise<string>(() => new Promise(resolve => rl.question(query, resolve)));

    const loop = Effect.gen(function* () {
      const query = yield* question("Search > ");
      if (query.toLowerCase() === "quit" || query.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      const results = yield* store.search(textToVector(query), { limit: 3 });
      if (results.length === 0) {
        yield* Console.log("  No matches.\n");
      }
      for (const r of results) {
        yield* Console.log(`  [${r.score.toFixed(3)}] ${r.content.substring(0, 120)}`);
      }
      yield* Console.log("");
      yield* loop;
    });

    yield* loop;
  }).pipe(Effect.provide(DemoLayer)),
);
