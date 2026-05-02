# Thaletto Jobs - Agent Instructions

## Agent skills

### Issue tracker

Linear issues via Linear API. See `docs/agents/issue-tracker.md`.

### Triage labels

needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — CONTEXT-MAP.md at root with libs/, root contexts. See `docs/agents/domain.md`.

## Effect Best Practices

**IMPORTANT:** Always search `libs/effect-smol` for real Effect implementations before writing Effect code.

The Effect v4 source is available locally at `libs/effect-smol/packages/effect/src` - use this to find:
- Real implementation patterns
- Type definitions
- API usage examples

Avoid guessing at Effect patterns - check the source first.