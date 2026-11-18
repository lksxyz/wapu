# Hook: Post File Save

**Event**: `file_save`  
**Trigger**: any file saved inside `apps/`

## What it does

After saving a TypeScript or Svelte file, remind Kiro to verify the call graph still matches the implementation:

1. If the saved file is under `apps/api/src/`, check that the Effect-TS pattern is followed: `Effect.gen` body contains only the happy path (A channel), and all error handling is in `.pipe()` after the gen block.
2. If the saved file is under `apps/platform/src/`, check that void states (empty, loading, error) are explicit markup branches, not CSS-only solutions.
3. If the saved file touches the agent prompt (`apps/api/src/ai/prompt.ts`), confirm the intake and build contracts are intact: intake uses `ask_user` only, build produces one `html` block only.

## Verification commands

```bash
# Type-check the API
pnpm --filter api check

# Type-check the platform
pnpm --filter platform check

# Lint everything
pnpm lint
```
