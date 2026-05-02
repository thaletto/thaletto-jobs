# Domain Docs — Multi-context

This is a **multi-context** repo.

## Layout

- `CONTEXT-MAP.md` at repo root — index of contexts
- Per-context `CONTEXT.md` files in each context directory

## Contexts

| Context | Location |
|---------|----------|
| root | `./CONTEXT.md` |
| libs/ | `libs/effect-smol/CONTEXT.md` |

## Consumer Rules

Skills that read domain docs (`diagnose`, `improve-codebase-architecture`, `tdd`):

1. Read `CONTEXT-MAP.md` to discover available contexts
2. Load context-specific `CONTEXT.md` based on the task scope
3. For monorepo-wide tasks, read all contexts and merge

## Creating New Contexts

Add new contexts to `CONTEXT-MAP.md` when adding new packages or apps.