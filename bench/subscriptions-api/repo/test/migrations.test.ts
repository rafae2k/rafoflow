import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { applyMigrations, MIGRATIONS } from "../src/db/migrations.ts";

describe("migrations", () => {
  it("applies every migration once, in order", () => {
    const db = new DatabaseSync(":memory:");
    assert.deepEqual(
      applyMigrations(db),
      MIGRATIONS.map((m) => m.id),
    );
    assert.deepEqual(applyMigrations(db), []);
  });

  it("stores money columns as INTEGER", () => {
    const db = new DatabaseSync(":memory:");
    applyMigrations(db);
    for (const [table, column] of [
      ["plans", "price_cents"],
      ["charges", "amount_cents"],
    ] as const) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[];
      assert.equal(cols.find((c) => c.name === column)?.type, "INTEGER");
    }
  });
});
