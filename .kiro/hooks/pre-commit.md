# Hook: Pre-Commit

**Event**: `pre_commit`

## What it does

Before committing, verify the repo is in a submittable state:

1. Run type-check on both apps (`pnpm check`).
2. Run the linter (`pnpm lint`).
3. Confirm `.kiro/` is NOT in `.gitignore` — the hackathon requires it to be committed.
4. Confirm a `LICENSE` file exists at the repo root.
5. Confirm `README.md` describes how to run the project locally.

## Commands

```bash
pnpm check
pnpm lint
```

If either command fails, block the commit and report which files have errors.
