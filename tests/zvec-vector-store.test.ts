import { beforeAll, afterAll } from "@effect/vitest";
import { Effect, Layer, FileSystem } from "effect";
import { VectorStore, type VectorStoreShape } from "../src/adapters/zvec/vector-store.ts";
import { VectorStoreLive } from "../src/adapters/zvec/vector-store-live.ts";
import { ZVecCollectionLive, ZVecCollectionConfig } from "../src/adapters/zvec/collection.ts";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { vectorStoreTests } from "./utils/shared-vector-store.ts";

const DIM = 128;

const ZVecLayer = Layer.provideMerge(
  VectorStoreLive,
  Layer.provideMerge(
    ZVecCollectionLive,
    Layer.succeed(ZVecCollectionConfig, { dimension: DIM }),
  ),
);

let store!: VectorStoreShape;

beforeAll(async () => {
  await Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(".cortex", { recursive: true, force: true });
  }).pipe(Effect.provide(BunFileSystem.layer), Effect.runPromise);

  store = await VectorStore.pipe(Effect.provide(ZVecLayer), Effect.runPromise);
});

afterAll(async () => {
  await Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(".cortex", { recursive: true, force: true });
  }).pipe(Effect.provide(BunFileSystem.layer), Effect.runPromise);
});

vectorStoreTests("ZVecVectorStore", () => store, DIM);
