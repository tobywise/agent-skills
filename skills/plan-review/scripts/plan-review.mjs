#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createReview, finishReview, importAnswers, loadReview, nextRound, readJson, reviewPaths, submitRound, summarize, validatePlan } from "./review-data.mjs";
import { exportPage, startServer } from "./review-server.mjs";

async function main() {
  const [command, id, ...rest] = process.argv.slice(2);
  if (!command || !id) throw new Error("Usage: plan-review <new|check|serve|page|import|submit|digest|next|finish> <id> [options]");
  const rootIndex = rest.indexOf("--root");
  const root = rootIndex < 0 ? process.cwd() : path.resolve(rest[rootIndex + 1]);
  if (rootIndex >= 0) rest.splice(rootIndex, 2);
  if (command === "new") {
    const titleIndex = rest.indexOf("--title");
    if (titleIndex < 0 || !rest[titleIndex + 1]) throw new Error("new needs --title");
    const files = await createReview(root, id, rest[titleIndex + 1]);
    console.log(files.plan);
    return;
  }
  if (command === "check") {
    const files = reviewPaths(root, id);
    const errors = validatePlan(await readJson(files.plan), id);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Plan ${id} is valid`);
    return;
  }
  if (command === "serve") {
    const { url } = await startServer(root, id);
    console.log(url);
    return;
  }
  if (command === "page") {
    console.log(await exportPage(root, id));
    return;
  }
  if (command === "import") {
    if (!rest[0]) throw new Error("import needs an answer JSON file");
    const packet = JSON.parse(await readFile(rest[0], "utf8"));
    console.log(`Imported ${await importAnswers(root, id, packet)} answers`);
    return;
  }
  if (command === "submit") {
    const groups = await submitRound(root, id);
    console.log(JSON.stringify(groups, null, 2));
    return;
  }
  if (command === "digest") {
    const { files, answers, state } = await loadReview(root, id);
    if (state.status !== "submitted") throw new Error("Send the round before reading its digest");
    const plan = await readJson(path.join(files.round(state.round), "plan.json"));
    const groups = summarize(plan, answers);
    console.log(JSON.stringify({ round: state.round, nextRound: state.round + 1, ...groups }, null, 2));
    return;
  }
  if (command === "next") {
    console.log(`Round ${await nextRound(root, id)} is open`);
    return;
  }
  if (command === "finish") {
    console.log(await finishReview(root, id));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
