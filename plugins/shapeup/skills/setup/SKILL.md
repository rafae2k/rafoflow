---
name: setup
description: "Make a repo agent-ready: find every environment variable the code really uses, name and comment them all in a .env.example, wire the real env file safely, and write the agent rules plus the real-data commands those variables unlock. Use when env is missing or undocumented, when onboarding a repo, or when /cycle, /engineer or /debug need real data and cannot reach it."
argument-hint: "[optional: path to the target repo, defaults to the current one]"
---

# Setup: Make the Repo Agent-Ready

A model works far better when every environment variable is named and commented: the person only fills in values, and the agent knows where real data comes from. This skill builds that once, for any stack, so `/cycle`, `/engineer` and `/debug` never have to guess.

The deliverable is a repo where: the `.example` file lists every variable with a one-line comment, the real env file is git-ignored and filled by the human, the agent rules say how to use it, and the real-data commands are written down.

## Process

### 1. Detect the stack

Read the manifests before scanning code. Look for any of: `package.json`, `wrangler.toml` / `wrangler.jsonc`, `pyproject.toml` / `requirements.txt`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `docker-compose.yml`, `Dockerfile`, `Makefile`, CI files under `.github/workflows/`, and any existing `.env*`, `.envrc`, `.dev.vars`.

Pick the example filename the stack already uses (see the table), and never invent a second convention next to an existing one.

| Stack signal | Example file | Real file |
| --- | --- | --- |
| Node, Python, Go, Ruby, Docker Compose (default) | `.env.example` | `.env` |
| Cloudflare Workers local dev | `.dev.vars.example` | `.dev.vars` |
| Repo already uses direnv | `.envrc.example` | `.envrc` |
| Monorepo with per-package env | one example per package that has its own runtime | matching real file |

Cloudflare note: `wrangler.toml` `[vars]` are public config, while secrets (`wrangler secret put`) only exist as names. Both belong in the example, flagged accordingly.

### 2. Scan the code for variables really used

Search for actual reads, not guesses. Patterns by language:

- JS/TS: `process.env.X`, `process.env["X"]`, `import.meta.env.X`, `env.X` (Workers bindings), `Deno.env.get("X")`
- Python: `os.environ["X"]`, `os.getenv("X")`, `settings.X` fed by env, pydantic `BaseSettings` fields
- Go: `os.Getenv("X")`; Ruby: `ENV["X"]`; Rust: `env::var("X")`; PHP: `getenv('X')`, `$_ENV`
- Config: `${X}` in compose and CI files, `wrangler` bindings and secrets, framework conventions (`NEXT_PUBLIC_*`, `VITE_*`)
- Typed env schemas (zod, envalid, t3-env) are the best source: read them first

Reconcile three lists and report the differences: used in code, declared in the existing example, present in the real file (names only). A name used but undocumented is the main gap this skill closes. A name documented but unused is a candidate for removal, never deleted silently.

Never open or print a real env file's values. To list names that exist there, extract names only (see step 5).

### 3. Write the .example

Create or update the example file. Rules:

- Every variable is present, grouped by section (App, Database, Auth, Payments, Email, Observability, Third-party APIs, Feature flags).
- Each variable has a one-line comment above it: what it is, where to get it (panel URL), required or optional, and a FAKE example value.
- Values are empty or an obviously fake placeholder. Never a real secret, never a real internal hostname.
- Sections use a visible divider; order puts required variables first inside a section.
- Updating keeps existing comments the human improved. Add what is missing, mark what looks stale with `# UNUSED?`, and do not reorder what is already good.

If you do not know where a vendor issues a key, say `where: <unknown, ask the owner>` rather than inventing a URL. Use the vendor's documented dashboard path only when you are sure of it.

The full commented template is in [references/env-example-template.md](references/env-example-template.md). Copy its shape.

### 4. Protect the real file

1. Make sure the real file (and variants such as `.env.local`, `.env.*.local`) is in `.gitignore`, and the `.example` is not. Add the lines if missing.
2. Check it was never committed: `git ls-files | grep -E '(^|/)\.(env|envrc|dev\.vars)'` and, if hits exist, tell the human it needs rotation and history cleanup. That is their call.
3. Create the real file from the example only if it does not exist: `[ -e .env ] || cp .env.example .env`. Never overwrite.

### 5. Report what is still empty, by name only

List the variables with no value yet, without ever printing a value:

```bash
grep -E '^[A-Za-z_][A-Za-z0-9_]*=$' .env | cut -d= -f1
```

Adapt to the file format (`export X=` for `.envrc`, `X=""`). Group the answer by required first, then optional, with the panel URL from the comment. The human fills the values; the agent does not ask them to paste secrets into chat.

### 6. Write the agent section

Create or update the agent rules file the repo already uses (`AGENTS.md`, else `CLAUDE.md`; if both exist, put it in `AGENTS.md` and make sure `CLAUDE.md` imports it). Add or refresh one section, short and in the repo's language:

```md
## Environment and real data

- Variable names and meaning live in `.env.example`. Read it to know what exists; read the real file only to load it, never to display it.
- Load the env before fetching real data: `<load command for this stack>`.
- Never print, cat, echo, log or commit secret values. Report names and status only.
- Every new variable goes into `.env.example` with its comment in the same commit that introduces it.
- Real-data commands that these variables enable are listed under "Real-data commands" below.
```

Replace the load command with the stack's real one: `set -a; source .env; set +a`, `source .envrc`, `direnv allow`, `--env-file .env`, or `wrangler dev` reading `.dev.vars`.

### 7. Record the real-data commands

Under "Real-data commands" in the same agent file, list only commands the filled variables truly enable, each with one line on what it answers and whether it is read-only. Derive them from the variables found, for example:

| Variable family | Command to record | Mode |
| --- | --- | --- |
| Database URL | `psql "$DATABASE_URL" -c "select ..."` or the ORM's studio | read-only role preferred |
| Cloudflare token + account | `npx wrangler d1 execute <db> --remote --command "select ..."` | read |
| Log platform token | the vendor CLI or query API for recent errors | read |
| Third-party API key | one `curl` GET against a list endpoint | read |
| Object storage keys | list or head an object | read |

Rules: prefer a read-only credential and say so in the `.example` comment; mark every write command as human-run with a dry-run first (see `/debug` → Fixing Production Data); do not record commands whose variables the repo does not define. Do not execute them in this skill, only document them.

### 8. Verify and hand off

- The example parses (no syntax error), every used variable is in it, the real file is ignored (`git check-ignore -v .env`).
- Nothing secret was read into the conversation or written to a tracked file.
- Commit the `.example`, `.gitignore` and agent file together with a simple message. Never commit the real file.

Finish with a short answer: what stack was detected, how many variables are documented (new vs existing), which names are still empty and where to get them, and which real-data commands are now available.

## Rules

- Variable names come from the code, never from memory of what a stack "usually" has.
- A secret value never appears in the chat, a log, a commit or a tracked file.
- Never overwrite the real env file; never delete an existing variable without saying so.
- Fake examples must be visibly fake (`sk_test_xxx`, `postgres://user:pass@localhost:5432/app`).
- If the repo has no agent file and no env usage at all, say so and stop; do not fabricate a setup.
- Other skills point here: when `/cycle`, `/engineer` or `/debug` need real data and the env is missing or undocumented, they stop and ask for `/setup` instead of guessing.
