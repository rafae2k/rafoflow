import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryFs } from "../src/fs/memory-fs.ts";

describe("MemoryFs", () => {
  it("reads, writes and lists", async () => {
    const fs = new MemoryFs({ "/a/b.txt": "B", "/a/c/d.txt": "D" });
    assert.equal(await fs.readFile("a/b.txt"), "B");
    const names = (await fs.readdir("/a")).map((e) => `${e.name}:${e.isDirectory}`).sort();
    assert.deepEqual(names, ["b.txt:false", "c:true"]);
  });

  it("requires the parent directory when writing", async () => {
    const fs = new MemoryFs();
    await assert.rejects(fs.writeFile("/x/y.txt", "1"), /ENOENT/);
    await fs.mkdir("/x");
    await fs.writeFile("/x/y.txt", "1");
    assert.equal(await fs.readFile("/x/y.txt"), "1");
  });

  it("removes trees", async () => {
    const fs = new MemoryFs({ "/a/b/c.txt": "C", "/ab.txt": "keep" });
    await fs.rm("/a");
    assert.equal(await fs.exists("/a/b/c.txt"), false);
    assert.equal(await fs.exists("/a"), false);
    assert.deepEqual(Object.keys(fs.snapshot()), ["/ab.txt"]);
  });
});
