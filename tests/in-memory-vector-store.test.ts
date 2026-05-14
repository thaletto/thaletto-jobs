import { describe, it, expect } from "@effect/vitest";
import { Effect } from "effect";
import { VectorStore } from "../src/adapters/zvec/vector-store.ts";
import { InMemoryVectorStoreLive } from "../src/adapters/in-memory/vector-store.ts";
import { vectorStoreTests } from "./utils/shared-vector-store.ts";
import { vecId, vec, meta } from "./utils/helpers.ts";

vectorStoreTests("InMemoryVectorStore", InMemoryVectorStoreLive);

const v = vec(3);

describe("InMemoryVectorStore (isolated-state tests)", () => {
  it.live("removes entry and decrements size", () =>
    Effect.gen(function* () {
      const store = yield* VectorStore;
      const id = vecId("to-delete");

      yield* store.store(id, v.xAxis, meta());
      expect(yield* store.size).toBe(1);

      yield* store.deleteEntry(id);

      expect(yield* store.size).toBe(0);
    }).pipe(Effect.provide(InMemoryVectorStoreLive))
  );

  it.live("search returns empty array when store is empty", () =>
    Effect.gen(function* () {
      const store = yield* VectorStore;

      const results = yield* store.search(v.xAxis, { limit: 10 });

      expect(results).toEqual([]);
    }).pipe(Effect.provide(InMemoryVectorStoreLive))
  );

  it.live("deleteEntry does not affect other entries", () =>
    Effect.gen(function* () {
      const store = yield* VectorStore;

      yield* store.store(vecId("keep"), v.xAxis, meta({ content: "keep" }));
      yield* store.store(vecId("delete"), v.yAxis, meta({ content: "delete" }));
      yield* store.deleteEntry(vecId("delete"));

      expect(yield* store.size).toBe(1);

      const entry = yield* store.getEntry(vecId("keep"));
      expect(entry.content).toBe("keep");
    }).pipe(Effect.provide(InMemoryVectorStoreLive))
  );
});
