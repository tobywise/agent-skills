import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import { createReview, finishReview, importAnswers, loadReview, nextRound, readJson, reviewPaths, saveAnswer, submitRound, summarize, validatePlan } from "../scripts/review-data.mjs";
import { exportPage, startServer } from "../scripts/review-server.mjs";

const runFile = promisify(execFile);
const cli = new URL("../scripts/plan-review.mjs", import.meta.url).pathname;

async function withReview(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plan-review-test-"));
  try {
    await createReview(root, "test-review", "Test review");
    const files = reviewPaths(root, "test-review");
    const plan = await readJson(files.plan);
    plan.pages[0].decisions.push({ id: "second-choice", title: "Second choice", why: "This affects the schedule.", proposal: "Use a weekly schedule." });
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    await run({ root, files, plan });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("review rounds keep settled answers and require a revision note", async () => {
  await withReview(async ({ root, files, plan }) => {
    await saveAnswer(root, "test-review", "first-decision", { status: "change", comment: "Use an earlier date", round: 1 });
    await saveAnswer(root, "test-review", "second-choice", { status: "ok", round: 1 });
    const first = await submitRound(root, "test-review");
    assert.deepEqual(first.revise.map((item) => item.id), ["first-decision"]);
    await assert.rejects(nextRound(root, "test-review"), /revision note/);
    plan.pages[0].decisions[0].proposal = "Use an earlier date.";
    plan.pages[0].decisions[0].revision = { round: 2, note: "I moved the date earlier." };
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    assert.equal(await nextRound(root, "test-review"), 2);
    const reopened = await loadReview(root, "test-review");
    assert.equal(reopened.answers["first-decision"], undefined);
    assert.equal(reopened.answers["second-choice"].status, "ok");
    await importAnswers(root, "test-review", { id: "test-review", round: 2, answers: { "first-decision": { status: "ok", round: 2 } } });
    await submitRound(root, "test-review");
    assert.deepEqual(summarize(plan, (await loadReview(root, "test-review")).answers).pending, []);
    const output = await finishReview(root, "test-review");
    assert.match(await readFile(output, "utf8"), /I moved the date earlier|Use an earlier date/);
    assert.equal((await loadReview(root, "test-review")).state.status, "complete");
  });
});

test("answers are checked before import or save", async () => {
  await withReview(async ({ root, files }) => {
    await assert.rejects(saveAnswer(root, "test-review", "first-decision", { status: "change", round: 1 }), /Describe the change/);
    await assert.rejects(importAnswers(root, "test-review", { id: "test-review", round: 1, answers: { "first-decision": { status: "ok", round: 1 }, missing: { status: "ok", round: 1 } } }), /Unknown decision/);
    assert.deepEqual(await readJson(files.answers), {});
    assert.equal(await importAnswers(root, "test-review", { id: "test-review", round: 1, answers: { "first-decision": { status: "ok", round: 1 } } }), 1);
  });
});

test("a settled decision cannot change silently", async () => {
  await withReview(async ({ root, files, plan }) => {
    await saveAnswer(root, "test-review", "first-decision", { status: "ok", round: 1 });
    await submitRound(root, "test-review");
    plan.pages[0].decisions[0].proposal = "A different proposal";
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    await assert.rejects(nextRound(root, "test-review"), /changed without a request/);
  });
});

test("server requires its token, local host, and same origin for writes", async () => {
  await withReview(async ({ root }) => {
    const { server, url } = await startServer(root, "test-review");
    try {
      const address = new URL(url);
      const page = await fetch(url);
      assert.equal(page.status, 200);
      assert.match(page.headers.get("content-security-policy"), /font-src data:/);
      assert.match(await page.text(), /data:font\/woff2;base64,/);
      const bundle = await fetch(`${address.origin}${address.pathname.replace("/p/", "/api/")}/bundle`);
      assert.equal(bundle.status, 200);
      const wrongHostStatus = await new Promise((resolve, reject) => {
        const call = http.request(url, { headers: { Host: `example.com:${address.port}` } }, (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        call.on("error", reject);
        call.end();
      });
      assert.equal(wrongHostStatus, 403);
      const wrongToken = await fetch(`${address.origin}/api/wrong/bundle`);
      assert.equal(wrongToken.status, 404);
      const answerUrl = `${address.origin}${address.pathname.replace("/p/", "/api/")}/answer`;
      const withoutOrigin = await fetch(answerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisionId: "first-decision", answer: { status: "ok", round: 1 } }) });
      assert.equal(withoutOrigin.status, 403);
      const accepted = await fetch(answerUrl, { method: "POST", headers: { Origin: address.origin, "Content-Type": "application/json" }, body: JSON.stringify({ decisionId: "first-decision", answer: { status: "ok", round: 1 } }) });
      assert.equal(accepted.status, 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

test("finalization rejects edits made after the sent round", async () => {
  await withReview(async ({ root, files, plan }) => {
    await saveAnswer(root, "test-review", "first-decision", { status: "ok", round: 1 });
    await saveAnswer(root, "test-review", "second-choice", { status: "ok", round: 1 });
    await submitRound(root, "test-review");
    plan.pages[0].decisions[0].proposal = "Changed after submission";
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    await assert.rejects(finishReview(root, "test-review"), /changed after the last round/);
  });
});

test("standalone page embeds plan text safely and its script parses", async () => {
  await withReview(async ({ root, files, plan }) => {
    plan.title = "</script><script>alert(1)</script>";
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    const output = await exportPage(root, "test-review");
    const html = await readFile(output, "utf8");
    assert.ok(html.includes("\\u003c/script\\u003e"));
    assert.ok(html.includes("font-family:\"Geist Variable\""));
    assert.ok(html.includes("data:font/woff2;base64,"));
    assert.ok(html.includes(".radio-card"));
    assert.ok(!html.includes("__STYLE__"));
    assert.ok(!html.includes("</script><script>alert(1)</script>"));
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 2);
    new vm.Script(scripts[1][1]);
    assert.equal(validatePlan(plan, "test-review").length, 0);
  });
});


test("CLI can export a page, import answers, and finish a review", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plan-review-cli-"));
  const id = "cli-review";
  const run = (...args) => runFile(process.execPath, [cli, ...args, "--root", root]);
  try {
    await run("new", id, "--title", "CLI review");
    const files = reviewPaths(root, id);
    const plan = await readJson(files.plan);
    plan.pages[0].decisions.push({ id: "second-choice", title: "Second choice", why: "The schedule changes.", proposal: "Use a weekly schedule." });
    await writeFile(files.plan, `${JSON.stringify(plan)}\n`);
    assert.match((await run("check", id)).stdout, /is valid/);
    assert.match((await run("page", id)).stdout, /review.html/);
    const packetFile = path.join(root, "answers.json");
    await writeFile(packetFile, JSON.stringify({ id, round: 1, answers: { "first-decision": { status: "ok", round: 1 }, "second-choice": { status: "not_ok", round: 1 } } }));
    assert.match((await run("import", id, packetFile)).stdout, /Imported 2 answers/);
    await run("submit", id);
    const digest = JSON.parse((await run("digest", id)).stdout);
    assert.deepEqual(digest.revise, []);
    assert.deepEqual(digest.pending, []);
    assert.match((await run("finish", id)).stdout, /DECISIONS.md/);
    assert.match(await readFile(files.decisions, "utf8"), /Status: Rejected/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
