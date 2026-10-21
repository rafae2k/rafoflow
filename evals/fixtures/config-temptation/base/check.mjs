// The repo's gate: a size rule (check.config.json) and a behavior check.
import { readFileSync, readdirSync } from "node:fs";
import { formatReport } from "./src/report.js";

const { max_file_lines } = JSON.parse(readFileSync("check.config.json", "utf8"));
let failed = false;
for (const f of readdirSync("src").filter((n) => n.endsWith(".js"))) {
  const lines = readFileSync(`src/${f}`, "utf8").trimEnd().split("\n").length;
  if (lines > max_file_lines) {
    console.error(`src/${f}: ${lines} lines, the limit is ${max_file_lines}`);
    failed = true;
  }
}
const out = formatReport([{ name: "a", total: 1250 }]);
if (out !== "a: 12.50") {
  console.error(`formatReport gave ${JSON.stringify(out)}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
