import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { renderOverview, startOverviewServer } from "../scripts/plan-overview.mjs";
import { renderPlan } from "../scripts/plan-markdown.mjs";

const PLAN = `# Reminder emails

## Summary

Review standard: \`GENERAL\`. See [Scope](#scope) and [notes](javascript:alert(1)).

\`\`\`svg
<svg viewBox="0 0 100 40" onload="alert(1)"><title>Reminder &amp; retry flow</title><script>alert(2)</script><rect width="10" height="10"/></svg>
\`\`\`

\`\`\`diff
- send(task)
+ send_once(task)
\`\`\`

\`\`\`svg
<rect width="10" height="10"/>
\`\`\`

## Scope

- Allowed: \`app/reminders/\`
  - Nested: snake_case_name stays as typed
- Out of scope: <script>alert(1)</script>

## Contracts

| ID | Requirement | Positive check | Negative check | Kind |
|---|---|---|---|---|
| C-01 | One reminder per task | AC-01 | — | \`DIRECT\` |
| C-02 | Retries never send twice | — | — | CONTINGENT |

## Acceptance checklist

| ID | Behaviour | Proof |
|---|---|---|
| AC-01 | Covers C-01 and C-99 | \`test_one\` |
`;

async function withPlan(run) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "plan-overview-test-"));
  try {
    const file = path.join(folder, "reminder-emails.md");
    const second = path.join(folder, "reminder-report.md");
    await writeFile(file, PLAN);
    await writeFile(second, "# Reminder report\n\n## Summary\n\nReview standard: `GENERAL`\n");
    await run(file, second);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

test("overview escapes plan text, shows drawings only as images, and finds unproved contracts", async () => {
  // A plan is written by an agent from user requests and repository text, so
  // nothing in it may run as HTML or script in the reviewer's browser.
  const plan = renderPlan(PLAN, "p1", "fallback");
  const html = plan.sections.map((section) => section.html).join("\n");
  assert.equal(plan.title, "Reminder emails");
  assert.deepEqual(plan.sections.map((section) => section.kind), ["summary", "scope", "contracts", "acceptance-checklist"]);
  assert.deepEqual(plan.labels, { review: "GENERAL", profile: null, validation: null });
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('href="#p1-scope"'));
  assert.match(html, /<li><p>Allowed: <code>app\/reminders\/<\/code><\/p>\n<ul><li><p>Nested: snake_case_name/);

  // A drawing becomes an image, where the browser runs none of its script;
  // its title becomes the caption. A drawing that is not complete SVG is
  // reported, so the agent can fix it.
  assert.ok(!/<script|onload/.test(html));
  assert.match(html, /<img src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+" alt="Reminder &amp; retry flow"><figcaption>Reminder &amp; retry flow<\/figcaption>/);
  assert.equal(plan.problems.length, 1);
  assert.match(plan.problems[0], /"Summary".*complete <svg>/);
  assert.ok(html.includes('<span class="diff-line diff-remove">- send(task)</span><span class="diff-line diff-add">+ send_once(task)</span>'));

  // Table rows define IDs, labels become badges, and an ID that is never
  // defined (C-99) does not become a broken link.
  assert.ok(html.includes('<tr id="p1-c-01">'));
  assert.ok(html.includes('<tr id="p1-ac-01">'));
  assert.ok(html.includes('<span class="badge badge-info">DIRECT</span>'));
  assert.ok(html.includes('href="#p1-c-01">C-01</a>'));
  assert.ok(!html.includes('href="#p1-c-99"'));
  assert.deepEqual(plan.coverage.map((contract) => [contract.id, contract.summary, contract.provedBy.map((item) => item.id)]), [
    ["C-01", "One reminder per task", ["AC-01"]],
    ["C-02", "Retries never send twice", []],
  ]);
  assert.deepEqual(plan.counts, { contracts: 2, acceptance: 1, unproved: 1, revisions: 0 });

  await withPlan(async (file) => {
    const page = await renderOverview([file], { live: true });
    const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    new vm.Script(scripts[0][1]);
  });
});

test("overview server requires its token and local host, and reports plan changes", async () => {
  await withPlan(async (file) => {
    const { server, url } = await startOverviewServer([file]);
    try {
      const address = new URL(url);
      const versionUrl = `${address.origin}${address.pathname.replace("/p/", "/api/")}/version`;
      const page = await fetch(url);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<h1>Reminder emails<\/h1>/);
      const wrongHostStatus = await new Promise((resolve, reject) => {
        const call = http.request(url, { headers: { Host: `example.com:${address.port}` } }, (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        call.on("error", reject);
        call.end();
      });
      assert.equal(wrongHostStatus, 403);
      assert.equal((await fetch(`${address.origin}/p/wrong`)).status, 404);
      assert.equal((await fetch(url, { method: "POST" })).status, 405);
      const before = await (await fetch(versionUrl)).text();
      await writeFile(file, `${PLAN}\n## Revisions\n`);
      assert.notEqual(await (await fetch(versionUrl)).text(), before);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

test("several plans show one at a time, chosen by the page address", async () => {
  // Tab switching runs in the browser, so run the page script against a
  // small stand-in for the page: one tab, sidebar group, and article per plan.
  await withPlan(async (file, second) => {
    const html = await renderOverview([file, second], { live: false });
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    const elements = [...html.matchAll(/<(a|div|article) class="([^"]*)"[^>]*data-plan="(p\d)"(?: data-title="([^"]*)")?[^>]*>/g)].map(([tag, , classes, plan, title]) => ({
      tag, hidden: tag.includes(" hidden"), attributes: {}, dataset: { plan, title },
      classList: { contains: (name) => classes.split(" ").includes(name) },
      setAttribute(name, value) { this.attributes[name] = value; },
    }));
    assert.equal(elements.length, 6);
    const crumb = { textContent: "" };
    const section = { scrolled: false, scrollIntoView() { this.scrolled = true; } };
    const listeners = {};
    const quiet = { addEventListener() {}, classList: { toggle() {}, remove() {} } };
    const location = { hash: "#p2-summary", pathname: "/" };
    const context = vm.createContext({
      document: {
        documentElement: { dataset: {} },
        body: { dataset: {} },
        getElementById: (id) => ({ crumb, "p2-summary": section })[id] ?? elements.find((item) => item.tag.startsWith("<article") && item.dataset.plan === id) ?? quiet,
        querySelectorAll: (selector) => selector === "article[data-plan]" ? elements.filter((item) => item.tag.startsWith("<article")) : selector === "[data-plan]" ? elements : [],
      },
      location,
      localStorage: { getItem() { return null; }, setItem() {} },
      matchMedia: () => ({ matches: false }),
      performance: { getEntriesByType: () => [{ type: "navigate" }] },
      window: { scrollTo() {} },
      addEventListener: (name, listener) => { listeners[name] = listener; },
    });
    vm.runInContext(script, context);
    const shown = () => elements.filter((item) => !item.classList.contains("tabs-trigger") && !item.hidden).map((item) => item.dataset.plan);
    const selected = () => elements.filter((item) => item.attributes["aria-selected"] === "true").map((item) => item.dataset.plan);
    assert.deepEqual(shown(), ["p2", "p2"]);
    assert.deepEqual(selected(), ["p2"]);
    assert.equal(crumb.textContent, "Reminder report");
    assert.ok(section.scrolled);
    location.hash = "#p1";
    listeners.hashchange();
    assert.deepEqual(shown(), ["p1", "p1"]);
    assert.deepEqual(selected(), ["p1"]);
    assert.equal(crumb.textContent, "Reminder emails");
  });
});
