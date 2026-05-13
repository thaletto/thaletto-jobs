import { Context, Effect, Layer } from "effect";
import {makeCollectionSchema, type ZVecConfig } from "./schema.ts";
import { ZVecCreateAndOpen, ZVecInitialize, type ZVecCollection as RawCollection } from "@zvec/zvec";
import * as Path from "node:path"
import * as Fs from "node:fs"

let initialized = false;

function ensureInit() {
    if (!initialized) {
        ZVecInitialize({ logLevel: 1, logType: "console" });
        initialized = true;
    }
}

export class ZVecCollectionConfig extends Context.Service<ZVecCollectionConfig, ZVecConfig>()("adapters/ZVec/ZVecCollectionConfig") { }

export class ZVecCollection extends Context.Service<ZVecCollection, RawCollection>()("adapters/ZVec/ZVecCollection") { }

export const ZVecCollectionLive = Layer.effect(
    ZVecCollection,
    Effect.gen(function* () {
        const config = yield* ZVecCollectionConfig
        ensureInit();

        const dir = ".cortex";
        if (!Fs.existsSync(dir)) {
            Fs.mkdirSync(dir, { recursive: true });
        }

        const collection = ZVecCreateAndOpen(
            Path.join(dir, "data"),
            makeCollectionSchema(config.dimension)
        );
        return collection;
    })
)