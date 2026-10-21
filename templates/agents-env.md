### Environment variables

- Read variable NAMES from `.env.example`. Never open, print or paste `.env` or `.dev.vars`.
- Load the environment before fetching real data, with the stack's loader (`node --env-file=.env`, `dotenv run --`, `set -a; . ./.env; set +a`). Check a variable by name only: `[ -n "$NAME" ]`.
- Never print, log, echo or commit a secret value, in code, tests, docs, commit messages or chat. If one leaks, say so and rotate it.
- A new variable enters `.env.example` with a one-line comment (what it is, where to get it, required or optional, a fake example) in the same commit as the code that reads it. `rafoflow env` writes it; `rafoflow env --check` verifies it.
