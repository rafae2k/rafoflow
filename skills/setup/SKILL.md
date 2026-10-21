---
name: setup
description: Set up the environment of a repository — find which environment variables the code reads, write the .env.example, ignore the real .env and create it for the person to fill in. Use when the user asks to configure, set up or onboard a repository, when a command fails for a missing variable, or after adding code that reads a new variable.
---

# Setup

The guarantees live in the `rafoflow` CLI. Run the commands; do not replace them with your own judgment.

1. Run `rafoflow env`. It detects the stack, scans the code for variables it actually reads, and writes `.env.example` (and `.dev.vars.example` for Cloudflare Workers): every name, grouped, each with a one-line comment (what it is, where to get it, required or optional, a fake example). An existing example keeps its lines; only missing names are appended.
2. It also adds the real file to `.gitignore` and creates it from the example without overwriting an existing one.
3. Tell the user the NAMES to fill in, from the command output. Ask them to put the values in the real file themselves. Never ask for a value in chat, and never print or open the real file.
4. Check that a variable is set by name only (`[ -n "$NAME" ]`, or the stack's loader reporting a missing key), never by showing its value.
5. When you add code that reads a new variable, run `rafoflow env` and commit the example file in the same commit. `rafoflow env --check` fails when a name is missing, so it can be a gate step (`commands.env: rafoflow env --check`).

If a comment says "ask the team", the scan could not infer what the variable is: improve the comment by reading the code that uses it, and keep it to one line.
