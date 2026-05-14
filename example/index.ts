/**
 * Real-world demo: chunk a text file, store vectors, search via CLI.
 * Run: bun run example/index.ts [path-to-file]
 * Default: example/sample.txt
 */

import { Effect, Layer, Schema as S, Terminal } from "effect";
import { VectorStore, VectorStoreLive, ZVecCollectionLive, ZVecCollectionConfig, type VectorStoreShape } from "../src/index.ts";
import { VectorMetadata, VectorId } from "../src/schema/index.ts";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { layer as BunTerminalLayer } from "@effect/platform-bun/BunTerminal";

// Start fresh: remove any ZVec data from prior runs
rmSync(".cortex", { recursive: true, force: true });

const DIM = 128;

function textToVector(text: string, dim: number = DIM): Float32Array {
  const v = new Float32Array(dim);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const tri = lower.charCodeAt(i)! * 97 + lower.charCodeAt(i + 1)! * 31 + lower.charCodeAt(i + 2)!;
    const pos = Math.abs(tri) % dim;
    v[pos]! += 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i]! * v[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) v[i] = v[i]! / norm;
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
const StoreLayer = Layer.provideMerge(VectorStoreLive, CollectionLayer);
const MainLayer = Layer.provideMerge(StoreLayer, BunTerminalLayer);

const program = Effect.gen(function* () {
  const store = yield* VectorStore;
  const terminal = yield* Terminal.Terminal;

  const filePath = process.argv[2] || "./example/sample.txt";
  if (!existsSync(filePath)) {
    yield* terminal.display(`File not found: ${filePath}\n`);
    yield* terminal.display("Create a .txt file or pass an existing path as argument.\n");
    return;
  }

  const text = readFileSync(filePath, "utf-8");
  const chunks = chunkText(text);

  yield* terminal.display(`\n  File: ${filePath}\n`);
  yield* terminal.display(`  Chunks: ${chunks.length}\n`);
  yield* terminal.display("  Storing vectors...\n\n");

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

  yield* terminal.display(`  Stored ${chunks.length} chunks. Ready.\n\n`);

  yield* loop(store, terminal);
});

function loop(
  store: VectorStoreShape,
  terminal: Terminal.Terminal,
): Effect.Effect<void, unknown> {
  return Effect.suspend((): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* terminal.display("Search >\n");
      const query = yield* terminal.readLine;
      const input = query.trim();
      if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
        return;
      }
      const results = yield* store.search(textToVector(input), { limit: 3 });
      if (results.length === 0) {
        yield* terminal.display("  No matches.\n\n");
      }
      for (const r of results) {
        yield* terminal.display(`  [${r.score.toFixed(3)}] ${r.content.substring(0, 120)}\n`);
      }
      yield* terminal.display("\n");
      yield* loop(store, terminal);
    })
  );
}

Effect.runPromise(Effect.provide(program, MainLayer));
