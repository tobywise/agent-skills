import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ANSWERS = new Set(["ok", "not_ok", "change", "explain"]);
const IMPORTANCE = new Set(["critical", "important", "minor"]);

export function reviewPaths(root, id) {
  if (!ID.test(id)) throw new Error("Review ID must use lowercase letters, numbers, and hyphens");
  const folder = path.join(path.resolve(root), ".plan-review", id);
  return {
    folder,
    plan: path.join(folder, "plan.json"),
    answers: path.join(folder, "answers.json"),
    state: path.join(folder, "state.json"),
    decisions: path.join(folder, "DECISIONS.md"),
    round: (number) => path.join(folder, "rounds", String(number)),
  };
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    const { rm } = await import("node:fs/promises");
    await rm(temporary, { force: true });
    throw error;
  }
}

export function decisionsIn(plan) {
  return plan.pages.flatMap((page) => page.decisions ?? []);
}

export function validatePlan(plan, expectedId) {
  const errors = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["Plan must be an object"];
  if (plan.version !== 1) errors.push("version must be 1");
  if (plan.id !== expectedId) errors.push(`id must be ${expectedId}`);
  if (!filled(plan.title)) errors.push("title is required");
  if (!filled(plan.summary)) errors.push("summary is required");
  if (!Array.isArray(plan.pages) || plan.pages.length === 0) return [...errors, "pages must contain at least one page"];
  const pageIds = new Set();
  const decisionIds = new Set();
  for (const page of plan.pages) {
    if (!validId(page?.id) || pageIds.has(page.id)) errors.push(`page id is missing, invalid, or repeated: ${page?.id}`);
    else pageIds.add(page.id);
    if (!filled(page?.title)) errors.push(`page ${page?.id}: title is required`);
    if (!Array.isArray(page?.decisions) || page.decisions.length === 0) {
      errors.push(`page ${page?.id}: decisions must contain at least one decision`);
      continue;
    }
    for (const decision of page.decisions) {
      const label = `decision ${decision?.id ?? "?"}`;
      if (!validId(decision?.id) || decisionIds.has(decision.id)) errors.push(`${label}: id is invalid or repeated`);
      else decisionIds.add(decision.id);
      for (const field of ["title", "why", "proposal"]) {
        if (!filled(decision?.[field])) errors.push(`${label}: ${field} is required`);
      }
      if (decision?.importance !== undefined && !IMPORTANCE.has(decision.importance)) errors.push(`${label}: importance must be critical, important, or minor`);
      if (decision?.options !== undefined) {
        if (!Array.isArray(decision.options)) errors.push(`${label}: options must be a list`);
        else {
          const optionIds = new Set();
          for (const option of decision.options) {
            if (!validId(option?.id) || optionIds.has(option.id)) errors.push(`${label}: option id is invalid or repeated`);
            else optionIds.add(option.id);
            if (!filled(option?.title)) errors.push(`${label}: option title is required`);
            if (option?.recommended !== undefined && typeof option.recommended !== "boolean") errors.push(`${label}: recommended must be true or false`);
            for (const field of ["pros", "cons"]) {
              if (option?.[field] !== undefined && (!Array.isArray(option[field]) || option[field].some((item) => !filled(item)))) errors.push(`${label}: ${field} must be a list of text`);
            }
          }
        }
      }
      if (decision?.revision !== undefined && (!Number.isInteger(decision.revision?.round) || decision.revision.round < 2 || !filled(decision.revision?.note))) errors.push(`${label}: revision needs a round of 2 or later and a note`);
    }
  }
  if (decisionIds.size < 2) errors.push("the review needs at least two decisions");
  return errors;
}

function filled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validId(value) {
  return typeof value === "string" && ID.test(value);
}

export function validateAnswer(decision, answer, round) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) throw new Error("Answer must be an object");
  if (!ANSWERS.has(answer.status)) throw new Error("Choose OK, Not OK, Change, or Explain");
  if (answer.round !== round) throw new Error("Answer belongs to another round");
  for (const field of ["comment", "rewrite"]) {
    if (answer[field] !== undefined && (typeof answer[field] !== "string" || answer[field].length > 10000)) throw new Error(`${field} must be text under 10,000 characters`);
  }
  if (answer.optionId !== undefined && !decision.options?.some((option) => option.id === answer.optionId)) throw new Error("Selected option is not in this decision");
  if (answer.status === "change" && !filled(answer.comment) && !filled(answer.rewrite)) throw new Error("Describe the change or rewrite the proposal");
  if (answer.status === "explain" && !filled(answer.comment)) throw new Error("Write the question to explain");
}

export async function loadReview(root, id) {
  const files = reviewPaths(root, id);
  const [plan, answers, state] = await Promise.all([readJson(files.plan), readJson(files.answers), readJson(files.state)]);
  const errors = validatePlan(plan, id);
  if (errors.length) throw new Error(`Invalid plan:\n${errors.join("\n")}`);
  return { files, plan, answers, state };
}

export async function createReview(root, id, title) {
  if (!filled(title)) throw new Error("Title is required");
  const files = reviewPaths(root, id);
  await mkdir(files.folder, { recursive: true });
  const plan = {
    version: 1,
    id,
    title,
    summary: "Explain the proposed change and what the person needs to decide.",
    pages: [{ id: "first-theme", title: "First theme", intro: "Set the context for these decisions.", decisions: [{ id: "first-decision", title: "What should we do?", importance: "important", why: "Explain what this choice affects.", proposal: "Describe the proposed choice." }] }],
  };
  await writeFile(files.plan, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  await writeFile(files.answers, "{}\n", { flag: "wx" });
  await writeFile(files.state, `${JSON.stringify({ round: 1, status: "review" }, null, 2)}\n`, { flag: "wx" });
  return files;
}

export async function saveAnswer(root, id, decisionId, answer) {
  const { files, plan, answers, state } = await loadReview(root, id);
  if (state.status !== "review") throw new Error("This round is closed");
  const decision = decisionsIn(plan).find((item) => item.id === decisionId);
  if (!decision) throw new Error("Decision does not exist");
  validateAnswer(decision, answer, state.round);
  answers[decisionId] = { status: answer.status, round: state.round, comment: answer.comment?.trim() ?? "", rewrite: answer.rewrite?.trim() ?? "", ...(answer.optionId ? { optionId: answer.optionId } : {}) };
  await writeJson(files.answers, answers);
  return answers[decisionId];
}

export async function importAnswers(root, id, packet) {
  const { files, plan, answers, state } = await loadReview(root, id);
  if (state.status !== "review" || packet?.id !== id || packet?.round !== state.round || !packet.answers || typeof packet.answers !== "object" || Array.isArray(packet.answers)) throw new Error("Answer file does not match the open review round");
  const byId = new Map(decisionsIn(plan).map((decision) => [decision.id, decision]));
  for (const [decisionId, answer] of Object.entries(packet.answers)) {
    const decision = byId.get(decisionId);
    if (!decision) throw new Error(`Unknown decision: ${decisionId}`);
    validateAnswer(decision, answer, state.round);
  }
  Object.assign(answers, packet.answers);
  await writeJson(files.answers, answers);
  return Object.keys(packet.answers).length;
}

export function summarize(plan, answers) {
  const revise = [];
  const pending = [];
  const accepted = [];
  const rejected = [];
  for (const decision of decisionsIn(plan)) {
    const answer = answers[decision.id];
    const item = { id: decision.id, title: decision.title, answer };
    if (!answer) pending.push(item);
    else if (answer.status === "change" || answer.status === "explain") revise.push(item);
    else if (answer.status === "not_ok") rejected.push(item);
    else accepted.push(item);
  }
  return { revise, pending, accepted, rejected };
}

export async function submitRound(root, id) {
  const { files, plan, answers, state } = await loadReview(root, id);
  if (state.status !== "review") throw new Error("This round was already sent");
  const folder = files.round(state.round);
  await mkdir(folder, { recursive: true });
  await writeJson(path.join(folder, "plan.json"), plan);
  await writeJson(path.join(folder, "answers.json"), answers);
  await writeJson(files.state, { round: state.round, status: "submitted" });
  return summarize(plan, answers);
}

export async function nextRound(root, id) {
  const { files, plan, answers, state } = await loadReview(root, id);
  if (state.status !== "submitted") throw new Error("Send the current round before opening another");
  const previous = await readJson(path.join(files.round(state.round), "plan.json"));
  const previousById = new Map(decisionsIn(previous).map((decision) => [decision.id, decision]));
  const currentById = new Map(decisionsIn(plan).map((decision) => [decision.id, decision]));
  const nextNumber = state.round + 1;
  for (const oldDecision of decisionsIn(previous)) {
    const answer = answers[oldDecision.id];
    const current = currentById.get(oldDecision.id);
    if (!current) throw new Error(`Decision disappeared: ${oldDecision.id}`);
    if (answer?.status === "change" || answer?.status === "explain") {
      if (current.revision?.round !== nextNumber) throw new Error(`Decision ${oldDecision.id} needs a revision note for round ${nextNumber}`);
    } else if (!isDeepStrictEqual(current, oldDecision)) {
      throw new Error(`Decision ${oldDecision.id} changed without a request for revision`);
    }
  }
  for (const decision of decisionsIn(plan)) {
    if (!previousById.has(decision.id) && decision.revision) throw new Error(`New decision ${decision.id} must start without a revision note`);
  }
  for (const item of summarize(previous, answers).revise) delete answers[item.id];
  await writeJson(files.answers, answers);
  await writeJson(files.state, { round: nextNumber, status: "review" });
  return nextNumber;
}

export async function finishReview(root, id) {
  const { files, plan, answers, state } = await loadReview(root, id);
  if (state.status !== "submitted") throw new Error("Send the last round before finishing");
  const submittedPlan = await readJson(path.join(files.round(state.round), "plan.json"));
  if (!isDeepStrictEqual(plan, submittedPlan)) throw new Error("The plan changed after the last round was sent");
  const summary = summarize(plan, answers);
  if (summary.revise.length || summary.pending.length) throw new Error("Resolve every change, question, and unanswered decision before finishing");
  const lines = [`# Decisions: ${plan.title}`, "", plan.summary, ""];
  for (const page of plan.pages) {
    lines.push(`## ${page.title}`, "");
    for (const decision of page.decisions) {
      const answer = answers[decision.id];
      lines.push(`### ${decision.title}`, "", `Status: ${answer.status === "ok" ? "Accepted" : "Rejected"}`, "", `Proposal: ${decision.proposal}`, "", `Why: ${decision.why}`, "");
      if (answer.status === "ok" && answer.optionId) {
        const option = decision.options?.find((item) => item.id === answer.optionId);
        if (option) lines.push(`Selected option: ${option.title}`, "");
      }
      if (answer.comment) lines.push(`Comment: ${answer.comment}`, "");
    }
  }
  await writeFile(files.decisions, `${lines.join("\n")}\n`, { flag: "wx" });
  await writeJson(files.state, { round: state.round, status: "complete" });
  return files.decisions;
}
