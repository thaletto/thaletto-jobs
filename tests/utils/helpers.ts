import { Schema as S } from "effect";
import { VectorId, VectorMetadata } from "../../src/index.ts";

export const vecId = (value: string) => S.decodeSync(VectorId)(value);

function makeVec(dim: number, a: number, b: number, c: number): Float32Array {
  const v = new Float32Array(dim);
  v[0] = a;
  v[1] = b;
  v[2] = c;
  return v;
}

export function vec(dim: number) {
  return {
    xAxis: makeVec(dim, 1, 0, 0),
    yAxis: makeVec(dim, 0, 1, 0),
    diagonal: makeVec(dim, 1, 1, 0),
  };
}

export function meta(overrides?: Partial<{
  content: string
  category: string
  tags: string[]
  metadata: Record<string, unknown>
  expiresAt: Date | null
}>): VectorMetadata {
  return new VectorMetadata({
    content: "default content",
    category: "default",
    tags: [],
    metadata: {},
    expiresAt: null,
    ...overrides,
  });
}
