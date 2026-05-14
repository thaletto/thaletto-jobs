export { 
    InMemoryVectorStoreLive 
} from "./adapters/in-memory/index.ts";
export { 
    ZVecCollection,
    ZVecCollectionConfig,
    ZVecCollectionLive,
    VectorStore,
    VectorStoreLive,
    type VectorStoreShape
} from "./adapters/zvec/index.ts";
export {
    VectorMetadata,
    VectorId,
    StoredEntry,
    SearchResult,
    SearchOptions,
    SerializedRow
} from "./schema/index.ts";
export { 
    VectorStoreError,
    VectorNotFoundError,
    VectorDecodeError,
    type VectorStoreErrors
} from "./errors/index.ts";