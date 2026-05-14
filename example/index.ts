/**
 * Real-world demo: chunk a text file, store vectors, search via CLI.
 * Run: bun run example/index.ts [path-to-file]
 * Default: example/sample.txt
 */

import { Effect, Layer, Schema as S } from "effect";

import {
	VectorStore,
	VectorStoreLive,
	ZVecCollectionLive,
	ZVecCollectionConfig,
	VectorMetadata,
	VectorId
} from "../src/index.ts";

import {
	readFileSync,
	existsSync,
	rmSync,
} from "node:fs";

import readline from "node:readline/promises";

import {
	stdin as input,
	stdout as output,
} from "node:process";

// Start fresh
rmSync(".cortex", {
	recursive: true,
	force: true,
});

const DIM = 128;

function textToVector(
	text: string,
	dim: number = DIM,
): Float32Array {
	const vector = new Float32Array(dim);

	const lower = text.toLowerCase();

	for (let i = 0; i < lower.length - 2; i++) {
		const hash =
			lower.charCodeAt(i)! * 97 +
			lower.charCodeAt(i + 1)! * 31 +
			lower.charCodeAt(i + 2)!;

		vector[Math.abs(hash) % dim]! += 1;
	}

	let magnitude = 0;

	for (let i = 0; i < dim; i++) {
		magnitude += vector[i]! * vector[i]!;
	}

	magnitude = Math.sqrt(magnitude);

	if (magnitude > 0) {
		for (let i = 0; i < dim; i++) {
			vector[i]! /= magnitude;
		}
	}

	return vector;
}

function chunkText(
	text: string,
	maxWords: number = 80,
	overlap: number = 20,
): Array<{
	text: string;
	index: number;
}> {
	const words = text.split(/\s+/);

	const chunks: Array<{
		text: string;
		index: number;
	}> = [];

	let start = 0;
	let index = 0;

	while (start < words.length) {
		const end = Math.min(
			start + maxWords,
			words.length,
		);

		chunks.push({
			text: words
				.slice(start, end)
				.join(" "),
			index,
		});

		index++;

		if (end >= words.length) {
			break;
		}

		start += maxWords - overlap;
	}

	return chunks;
}

const ConfigLayer = Layer.succeed(
	ZVecCollectionConfig,
	{
		dimension: DIM,
	},
);

const CollectionLayer =
	Layer.provideMerge(
		ZVecCollectionLive,
		ConfigLayer,
	);

const MainLayer =
	Layer.provideMerge(
		VectorStoreLive,
		CollectionLayer,
	);

const question = (
	rl: readline.Interface,
	text: string,
) =>
	Effect.promise(() =>
		rl.question(text),
	);

const program = Effect.gen(function* () {
	const store =
		yield* VectorStore;

	const filePath =
		process.argv[2] ??
		"./example/sample.txt";

	if (!existsSync(filePath)) {
		console.log(
			`File not found: ${filePath}`,
		);

		return;
	}

	const text = readFileSync(
		filePath,
		"utf-8",
	);

	const chunks = chunkText(text);

	console.log(
		`\nLoaded ${chunks.length} chunks\n`,
	);

	for (const chunk of chunks) {
		const id = S.decodeSync(
			VectorId,
		)(`chunk-${chunk.index}`);

		const metadata =
			new VectorMetadata({
				content: chunk.text,
				category: "knowledge",
				tags: [],
				metadata: {
					source: filePath,
				},
				expiresAt: null,
			});

		yield* store.store(
			id,
			textToVector(chunk.text),
			metadata,
		);
	}

	console.log("Ready.\n");

	const rl = readline.createInterface({
		input,
		output,
	});

	while (true) {
		const query = yield* question(
			rl,
			"Search > ",
		);

		const inputText =
			query.trim();

		if (
			inputText === "quit" ||
			inputText === "exit"
		) {
			break;
		}

		const results =
			yield* store.search(
				textToVector(inputText),
				{
					limit: 3,
				},
			);

		if (results.length === 0) {
			console.log(
				"\nNo matches.\n",
			);

			continue;
		}

		console.log("");

		for (const result of results) {
			console.log(
				`[${result.score.toFixed(3)}] ${result.content.substring(0, 120)}`,
			);
		}

		console.log("");
	}

	rl.close();
});

Effect.runPromise(
	Effect.provide(
		program,
		MainLayer,
	),
);