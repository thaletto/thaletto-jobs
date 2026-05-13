import { Data } from "effect";

export class VectorStoreError extends Data.TaggedError("VectorStoreError")<{
    readonly cause: unknown;
    readonly message?: string;
}> {
    get description() {
        return this.message ?? (this.cause instanceof Error ? this.cause.message : String(this.cause))
    }
}

export class VectorNotFoundError extends Data.TaggedError("VectorNotFoundError")<{
    readonly id: string;
}> { }

export class VectorDecodeError extends Data.TaggedError("VectorDecodeError")<{
    readonly cause: unknown;
    readonly field?: string;
}> { }

export type VectorStoreErrors =
    | VectorStoreError
    | VectorNotFoundError
    | VectorDecodeError;