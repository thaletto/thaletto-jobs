import { describe, it, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { VectorStore, type VectorStoreShape } from "../../src/adapters/zvec/vector-store.ts";
import { VectorNotFoundError } from "../../src/errors/index.ts";
import { vecId, vec, meta } from "./helpers.ts";

export function vectorStoreTests(
  label: string,
  provider: Layer.Layer<VectorStore> | (() => VectorStoreShape),
  dim = 3
) {
  const v = vec(dim);

  const withStore = <A, E>(f: (store: VectorStoreShape) => Effect.Effect<A, E>): Effect.Effect<A, E> =>
    typeof provider === "function"
      ? f(provider())
      : Effect.gen(function* () {
          const store = yield* VectorStore;
          return yield* f(store);
        }).pipe(Effect.provide(provider as Layer.Layer<VectorStore>));

  describe(label, () => {

    it.live("round-trips a single entry", () =>
      withStore(store =>
        Effect.gen(function* () {
          const id = vecId("doc-1");
          yield* store.store(id, v.xAxis, meta({ content: "hello" }));
          const entry = yield* store.getEntry(id);
          expect(entry.id).toBe(id);
          expect(entry.content).toBe("hello");
          expect(entry.createdAt).toBeInstanceOf(Date);
        })
      )
    );

    it.live("returns VectorNotFoundError for missing entry", () =>
      withStore(store =>
        Effect.gen(function* () {
          const error = yield* store.getEntry(vecId("missing")).pipe(Effect.flip);
          expect(error).toBeInstanceOf(VectorNotFoundError);
          expect(error._tag).toBe("VectorNotFoundError");
          if (error._tag === "VectorNotFoundError") {
            expect(error.id).toBe("missing");
          }
        })
      )
    );

    it.live("correct cosine similarity scores for orthogonal vectors", () =>
      withStore(store =>
        Effect.gen(function* () {
          yield* store.store(vecId("same"), v.xAxis, meta());
          yield* store.store(vecId("orthogonal"), v.yAxis, meta());

          const results = yield* store.search(v.xAxis, { limit: 10 });

          const same = results.find(r => r.id === vecId("same"));
          const orth = results.find(r => r.id === vecId("orthogonal"));
          expect(same).toBeDefined();
          expect(orth).toBeDefined();
          expect(same!.score).toBeCloseTo(1, 5);
          expect(orth!.score).toBeCloseTo(0, 5);
        })
      )
    );

    describe("search", () => {
      it.live("returns results sorted by cosine similarity descending", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("x"), v.xAxis, meta({ content: "x axis" }));
            yield* store.store(vecId("y"), v.yAxis, meta({ content: "y axis" }));
            yield* store.store(vecId("diag"), v.diagonal, meta({ content: "diagonal" }));

            const results = yield* store.search(v.xAxis, { limit: 10 });

            const xResult = results.find(r => r.id === vecId("x"));
            const yResult = results.find(r => r.id === vecId("y"));
            const diagResult = results.find(r => r.id === vecId("diag"));
            expect(xResult).toBeDefined();
            expect(yResult).toBeDefined();
            expect(diagResult).toBeDefined();
            expect(xResult!.score).toBeCloseTo(1, 5);
            expect(results.indexOf(xResult!)).toBeLessThan(results.indexOf(diagResult!));
            expect(results.indexOf(diagResult!)).toBeLessThan(results.indexOf(yResult!));
          })
        )
      );

      it.live("filters by category", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("a"), v.xAxis, meta({ content: "cat a", category: "a" }));
            yield* store.store(vecId("b"), v.xAxis, meta({ content: "cat b", category: "b" }));

            const results = yield* store.search(v.xAxis, { limit: 10, category: "a" });

            expect(results).toHaveLength(1);
            expect(results[0]!.content).toBe("cat a");
          })
        )
      );

      it.live("filters by tags", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("a"), v.xAxis, meta({ content: "has tag", tags: ["foo", "bar"] }));
            yield* store.store(vecId("b"), v.xAxis, meta({ content: "no match", tags: ["baz"] }));

            const results = yield* store.search(v.xAxis, { limit: 10, tags: ["foo"] });

            expect(results.some(r => r.content === "has tag")).toBe(true);
            expect(results.some(r => r.content === "no match")).toBe(false);
          })
        )
      );

      it.live("excludes expired entries", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("active"), v.xAxis, meta({ content: "active", expiresAt: null }));
            yield* store.store(vecId("expired"), v.xAxis, meta({
              content: "expired",
              expiresAt: new Date(Date.now() - 60_000),
            }));

            const results = yield* store.search(v.xAxis, { limit: 10 });

            expect(results.some(r => r.content === "active")).toBe(true);
            expect(results.some(r => r.content === "expired")).toBe(false);
          })
        )
      );

      it.live("respects limit option", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("a"), v.xAxis, meta({ content: "a" }));
            yield* store.store(vecId("b"), v.yAxis, meta({ content: "b" }));
            yield* store.store(vecId("c"), v.diagonal, meta({ content: "c" }));

            const results = yield* store.search(v.xAxis, { limit: 2 });

            expect(results).toHaveLength(2);
          })
        )
      );

      it.live("defaults limit to 10 when not provided", () =>
        withStore(store =>
          Effect.gen(function* () {
            for (let i = 0; i < 15; i++) {
              yield* store.store(vecId(`doc-${i}`), v.xAxis, meta({ content: `doc ${i}` }));
            }

            const results = yield* store.search(v.xAxis, {});

            expect(results).toHaveLength(10);
          })
        )
      );

      it.live("combines category + tags + TTL filters", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("pass"), v.xAxis, meta({
              content: "pass", category: "important", tags: ["urgent"],
            }));
            yield* store.store(vecId("wrong-cat"), v.xAxis, meta({
              content: "wrong-cat", category: "other", tags: ["urgent"],
            }));
            yield* store.store(vecId("wrong-tag"), v.xAxis, meta({
              content: "wrong-tag", category: "important", tags: ["normal"],
            }));
            yield* store.store(vecId("expired"), v.xAxis, meta({
              content: "expired", category: "important", tags: ["urgent"],
              expiresAt: new Date(Date.now() - 60_000),
            }));

            const results = yield* store.search(v.xAxis, {
              limit: 10, category: "important", tags: ["urgent"],
            });

            expect(results).toHaveLength(1);
            expect(results[0]!.content).toBe("pass");
          })
        )
      );
    });

    describe("deleteEntry", () => {
      it.live("no-ops silently when entry does not exist", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.deleteEntry(vecId("nonexistent"));
          })
        )
      );
    });

    describe("upsert", () => {
      it.live("replaces existing entry with same id", () =>
        withStore(store =>
          Effect.gen(function* () {
            const id = vecId("replaceable");
            yield* store.store(id, v.xAxis, meta({ content: "original" }));
            yield* store.store(id, v.yAxis, meta({ content: "replaced" }));

            const entry = yield* store.getEntry(id);
            expect(entry.content).toBe("replaced");

            const results = yield* store.search(v.yAxis, { limit: 10 });
            expect(results[0]!.id).toBe(id);
            expect(results[0]!.score).toBeCloseTo(1, 5);
          })
        )
      );
    });

    describe("edge cases", () => {
      it.live("stores and retrieves entry with all metadata fields", () =>
        withStore(store =>
          Effect.gen(function* () {
            const id = vecId("rich");
            const expiresAt = new Date(Date.now() + 86_400_000);

            yield* store.store(id, v.xAxis, {
              content: "rich content",
              category: "test",
              tags: ["a", "b", "c"],
              metadata: { nested: { key: "val" }, count: 42 },
              expiresAt,
            });

            const entry = yield* store.getEntry(id);
            expect(entry.content).toBe("rich content");
            expect(entry.category).toBe("test");
            expect(entry.tags).toEqual(["a", "b", "c"]);
            expect(entry.metadata).toEqual({ nested: { key: "val" }, count: 42 });
            expect(entry.expiresAt).toBeInstanceOf(Date);
            expect(entry.expiresAt!.getTime()).toBeCloseTo(expiresAt.getTime(), -2);
          })
        )
      );

      it.live("search with no matching filters returns empty", () =>
        withStore(store =>
          Effect.gen(function* () {
            yield* store.store(vecId("a"), v.xAxis, meta({ category: "cat-a" }));
            const results = yield* store.search(v.xAxis, { limit: 10, category: "nonexistent" });
            expect(results).toEqual([]);
          })
        )
      );
    });
  });
}
