# thaletto-jobs

## Commands

```bash
bun install          # Install dependencies
bun run index.ts     # Run the app
```

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.

To update later: `git -C ~/.local/share/effect-solutions/effect pull --depth 1`

## Rules

- Prefer named `function` over named `() => {}` function. Use arrow function in inline otherwise use `function` keyword, this makes it easy
- Use `Effect.gen` instead of piping long operations
- Never type annotate an Effect for example `sample: Effect.Effect<number, string, never>`
- Always create Service and Layers while creating a module, check documentation by running `bunx effect-solutions services-and-layers`
- If unsure about using Effect check the local repository, for quick information to core concepts run `bunx effect-solutions list`