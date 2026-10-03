import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PluginError } from "../src/errors.ts";
import { countWords, readingTime } from "../src/plugins/reading-time.ts";
import type { Plugin } from "../src/plugins/types.ts";
import { buildSite } from "./helpers.ts";

describe("plugins", () => {
  it("reading-time sets the readingTime variable", async () => {
    const words = Array.from({ length: 450 }, (_, i) => `w${i}`).join(" ");
    const { out } = await buildSite({ "a.md": words }, { plugins: [readingTime()] });
    assert.match(await out("a.html"), /<p class="page-meta">3 min read<\/p>/);
  });

  it("countWords skips fenced code", () => {
    assert.equal(countWords("one two\n```\nnot counted here\n```\nthree"), 3);
  });

  it("rejects invalid options", () => {
    assert.throws(() => readingTime({ wordsPerMinute: 0 }), PluginError);
  });

  it("can replace page HTML and add escaped variables", async () => {
    const plugin: Plugin = {
      name: "banner",
      onPage(ctx) {
        ctx.html = `<div class="banner"></div>${ctx.html}`;
        ctx.vars.readingTime = "<b>soon</b>";
      },
    };
    const html = await (await buildSite({ "a.md": "Hi" }, { plugins: [plugin] })).out("a.html");
    assert.match(html, /<div class="banner"><\/div><p>Hi<\/p>/);
    assert.match(html, /&lt;b&gt;soon&lt;\/b&gt;/);
  });

  it("cannot mutate the page or other pages during onPage", async () => {
    const seen: string[] = [];
    const plugin: Plugin = {
      name: "mutator",
      onPage(ctx) {
        seen.push(ctx.page.title);
        assert.throws(() => {
          (ctx.page as { title: string }).title = "hacked";
        }, TypeError);
        assert.throws(() => {
          (ctx.site[0] as { title: string }).title = "hacked";
        }, TypeError);
      },
    };
    const { out } = await buildSite({ "a.md": "# A", "b.md": "# B" }, { plugins: [plugin] });
    assert.deepEqual(seen, ["A", "B"]);
    assert.match(await out("b.html"), /<title>B · /);
    assert.match(await out("b.html"), />A<\/a>/);
  });

  it("cannot override generator-owned variables", async () => {
    const plugin: Plugin = {
      name: "sneaky",
      onPage(ctx) {
        ctx.vars.content = "<script>x</script>";
      },
    };
    await assert.rejects(buildSite({ "a.md": "Hi" }, { plugins: [plugin] }), PluginError);
  });

  it("wraps plugin crashes with the plugin name", async () => {
    const plugin: Plugin = {
      name: "crashy",
      onPage() {
        throw new Error("boom");
      },
    };
    await assert.rejects(buildSite({ "a.md": "Hi" }, { plugins: [plugin] }), /plugin "crashy".*boom/);
  });

  it("onBuildEnd can emit extra files", async () => {
    const plugin: Plugin = {
      name: "sitemap",
      onBuildEnd(ctx) {
        ctx.emit("sitemap.txt", ctx.site.map((p) => p.route).join("\n"));
      },
    };
    const { out, result } = await buildSite({ "a.md": "A", "b/c.md": "C" }, { plugins: [plugin] });
    assert.equal(await out("sitemap.txt"), "a.html\nb/c.html");
    assert.ok(result.written.includes("sitemap.txt"));
  });
});
