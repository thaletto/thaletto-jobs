export { VectorStore, type VectorStoreShape } from "./adapters/zvec/vector-store.ts";
export { VectorStoreLive } from "./adapters/zvec/vector-store-live.ts";
export { InMemoryVectorStoreLive } from "./adapters/in-memory/vector-store.ts";
export { ZVecCollection, ZVecCollectionConfig, ZVecCollectionLive } from "./adapters/zvec/collection.ts";
export { VectorMetadata, VectorId, StoredEntry, SearchResult, SearchOptions, SerializedRow } from "./schema/index.ts";
export { VectorStoreError, VectorNotFoundError, VectorDecodeError, type VectorStoreErrors } from "./errors/index.ts";