// Builds evals/.work/routing-repo: a small git repo with rafoflow installed by `init`,
// so harnesses discover the package skills exactly as they would in a real repo.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { init } from "../../dist/init.js";
import { EVALS_ROOT } from "../lib/fixture.mjs";

const dir = join(EVALS_ROOT, ".work", "routing-repo");
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, "src"), { recursive: true });
writeFileSync(join(dir, "README.md"), "# Shop\n\nA small web shop: products, orders, subscriptions, a settings page.\n");
writeFileSync(join(dir, "src", "settings.html"), '<button id="save">Save</button>\n');
execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
init(dir, "codex");
console.log(dir);
