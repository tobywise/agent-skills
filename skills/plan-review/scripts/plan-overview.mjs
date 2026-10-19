#!/usr/bin/env node
// Show one or more finished Markdown plans as a read-only HTML overview, so a
// person can read and check a plan in a browser before work starts.
//
//   plan-overview <plan.md> [<plan.md> ...]         serve the overview
//   plan-overview --file <plan.md> [<plan.md> ...]  write one HTML file
//
// Serving prints a local address and, when Tailscale runs on this machine, an
// address that the person's other devices on their tailnet can open. The page
// reads the plan files again on every load and reloads itself when a file
// changes, so a revised plan shows without a new server.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { escapeHtml, renderPlan } from "./plan-markdown.mjs";
import { readStyles, respond } from "./review-server.mjs";
import { findTailnetAddress, startTailnetProxy } from "./tailnet-proxy.mjs";

const ICONS = {
  alert: '<path d="m10.3 3.9-8.1 14A2 2 0 0 0 3.9 21h16.2a2 2 0 0 0 1.7-3.1l-8.1-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  audit: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checklist: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
  coverage: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  steps: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>',
};
// The icon for each section the `planning` skill requires; others get `file`.
const SECTION_ICONS = {
  summary: "info",
  scope: "target",
  contracts: "shield",
  "tests-and-verification": "flask",
  "implementation-steps": "steps",
  "forbidden-patterns": "ban",
  "complexity-budget": "gauge",
  "acceptance-checklist": "checklist",
  revisions: "history",
  "existing-codebase-audit": "audit",
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/**
 * Check that every path names a readable Markdown file.
 *
 * @param {string[]} files The plan paths given on the command line.
 * @returns {Promise<string[]>} The absolute paths, in the order given.
 */
export async function checkPlanFiles(files) {
  if (!files.length) throw new Error("Usage: plan-overview [--file] <plan.md> [<plan.md> ...]");
  return Promise.all(files.map(async (file) => {
    const absolute = path.resolve(file);
    if (!absolute.endsWith(".md")) throw new Error(`Not a Markdown plan: ${file}`);
    if (!(await stat(absolute)).isFile()) throw new Error(`Not a file: ${file}`);
    return absolute;
  }));
}

/**
 * Make a short value that changes whenever any plan file changes. The page
 * compares it with the value it was built from to know when to reload.
 *
 * @param {string[]} files Absolute plan paths.
 * @returns {Promise<string>} A hash of the files' contents.
 */
export async function plansVersion(files) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update("\u0000").update(await readFile(file)).update("\u0000");
  return hash.digest("hex").slice(0, 16);
}

/**
 * Read and render every plan.
 *
 * @param {string[]} files Absolute plan paths, in reading order.
 * @param {string} root The folder that shown paths are relative to.
 * @returns {Promise<object[]>} Each rendered plan from `renderPlan`, with its
 *   page ID, shown path, and the time the file last changed.
 */
export async function readPlans(files, root = process.cwd()) {
  return Promise.all(files.map(async (file, index) => {
    const text = await readFile(file, "utf8");
    const plan = renderPlan(text, `p${index + 1}`, path.basename(file, ".md"));
    // Show a path inside the project relative to it, and any other path in full.
    const relative = path.relative(root, file);
    const shownPath = relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : file;
    return { ...plan, id: `p${index + 1}`, shownPath, changed: (await stat(file)).mtime };
  }));
}

function labelBadges(plan) {
  const { review, profile, validation } = plan.labels;
  const badge = (name, value, tone = "badge-outline") => `<span class="badge ${tone}">${name} <b class="mono">${escapeHtml(value)}</b></span>`;
  return [
    review ? badge("Review standard", review, review === "SCIENTIFIC_ANALYSIS" ? "badge-info" : "badge-outline") : '<span class="badge badge-danger-outline">Review standard not stated</span>',
    profile ? badge("Delivery profile", profile) : "",
    validation ? badge("Validation", validation) : "",
  ].join("");
}

function statTiles(plan) {
  const { contracts, acceptance, unproved, revisions } = plan.counts;
  const tile = (label, value, symbol, tone = "") => `<div class="stat-tile ${tone}"><div class="stat-label">${icon(symbol)}<span>${label}</span></div><div class="stat-value">${value}</div></div>`;
  return `<div class="stat-grid">${[
    tile("Contracts", contracts, "shield"),
    tile("Acceptance items", acceptance, "checklist"),
    unproved ? tile("Contracts with no proof", unproved, "alert", "tone-modify") : tile("Contracts with no proof", 0, "check", "tone-ok"),
    tile("Revisions", revisions, "history"),
  ].join("")}</div>`;
}

// One row per contract, with the acceptance items that prove it, so a gap in
// the plan's proof is visible before the plan is accepted.
function coverageCard(plan) {
  if (!plan.coverage.length) return "";
  const rows = plan.coverage.map((contract) => {
    const proof = contract.retired
      ? '<span class="badge badge-secondary">Retired</span>'
      : contract.provedBy.length
        ? contract.provedBy.map((item) => `<a class="badge badge-outline badge-mono plan-ref" href="${item.href}">${item.id}</a>`).join(" ")
        : '<span class="badge badge-warning">No acceptance item</span>';
    return `<tr><td><a class="badge badge-outline badge-mono plan-ref" href="${contract.href}">${contract.id}</a></td><td>${escapeHtml(contract.summary)}</td><td class="overview-proof">${proof}</td></tr>`;
  }).join("");
  return `
        <section class="card overview-section" id="${plan.id}-coverage" data-kind="coverage">
          <div class="card-header"><h2 class="card-title overview-title">${icon("coverage")}<span>Contract coverage</span></h2><p class="card-description">Which acceptance items prove each contract.</p></div>
          <div class="card-content overview-body"><div class="table-wrap"><table class="table"><thead><tr><th>Contract</th><th>Requirement</th><th>Proved by</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        </section>`;
}

/**
 * Build the overview page for the plans.
 *
 * @param {string[]} files Absolute plan paths, in reading order.
 * @param {{live: boolean, root?: string}} options `live` is true when a
 *   server sends the page, so the page checks for changes; `root` is the
 *   folder that shown paths are relative to.
 * @returns {Promise<string>} The complete HTML page.
 */
export async function renderOverview(files, { live, root = process.cwd() }) {
  const [styles, version, plans] = await Promise.all([readStyles(["overview.css"]), plansVersion(files), readPlans(files, root)]);
  const heading = plans.length === 1 ? plans[0].title : `${plans.length} plans`;
  const navLink = (href, symbol, title) => `<a class="nav-link" href="${href}"><span class="nav-icon">${icon(symbol)}</span><span class="nav-text">${escapeHtml(title)}</span></a>`;

  const nav = plans.map((plan) => {
    const links = plan.sections.map((section) => navLink(`#${section.id}`, SECTION_ICONS[section.kind] ?? "file", section.title));
    if (plan.coverage.length) links.unshift(navLink(`#${plan.id}-coverage`, "coverage", "Contract coverage"));
    return `
      <div class="nav-group">
        <a class="nav-label overview-plan-link" href="#${plan.id}">${escapeHtml(plan.title)}</a>
        ${links.join("\n        ")}
      </div>`;
  }).join("");

  const articles = plans.map((plan, index) => {
    const problems = plan.problems.length
      ? `<div class="alert alert-warning">${icon("alert")}<div class="alert-title">Part of this plan cannot be shown</div><div class="alert-description"><ul>${plan.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ul></div></div>`
      : "";
    const sections = plan.sections.map((section) => `
        <section class="card overview-section" id="${section.id}" data-kind="${section.kind}">
          <div class="card-header"><h2 class="card-title overview-title">${icon(SECTION_ICONS[section.kind] ?? "file")}<span>${section.titleHtml}</span></h2></div>
          <div class="card-content overview-body">${section.html}</div>
        </section>`).join("");
    const position = plans.length > 1 ? `Plan ${index + 1} of ${plans.length} · ` : "";
    return `
      <article class="page overview-plan" id="${plan.id}">
        <header class="page-header">
          <div class="kicker">${position}<span class="mono">${escapeHtml(plan.shownPath)}</span> · changed ${escapeHtml(plan.changed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</div>
          <h1>${escapeHtml(plan.title)}</h1>
          <div class="home-badges">${labelBadges(plan)}</div>
        </header>
        ${problems}${statTiles(plan)}${coverageCard(plan)}${sections}
      </article>`;
  }).join("");

  const state = live ? "● Live: updates when the plan changes" : "Saved copy";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Plan overview: ${escapeHtml(heading)}</title>
  <style>${styles}</style>
</head>
<body${live ? ` data-version="${version}"` : ""}>
  <div class="app" id="app">
    <aside class="sidebar">
      <div class="side-brand">
        <div class="side-logo">${icon("list")}</div>
        <div class="side-titles"><div class="side-title">${escapeHtml(heading)}</div><div class="side-sub">Plan overview</div></div>
      </div>
      <div class="side-scroll"><nav class="nav">${nav}
      </nav></div>
    </aside>
    <button type="button" class="mobile-scrim" id="scrim" aria-label="Close menu"></button>
    <main class="main-col">
      <header class="topbar">
        <button type="button" class="btn btn-ghost btn-icon menu-button" id="menu" aria-label="Open menu">${icon("menu")}</button>
        <div class="crumbs"><span>Plan overview</span><span class="crumb-sep">/</span><span class="crumb-current">${escapeHtml(heading)}</span></div>
        <div class="topbar-right">
          <span class="save-state" id="live-state">${state}</span>
          <button type="button" class="btn btn-ghost btn-icon" id="theme" aria-label="Switch light or dark theme">${icon("theme")}</button>
        </div>
      </header>
      <div class="content-wrap"><div class="content">${articles}
      </div></div>
    </main>
  </div>
  <script>
    const page = document.documentElement;
    const app = document.getElementById("app");
    const themeKey = "plan-review:theme";
    let savedTheme;
    try { savedTheme = localStorage.getItem(themeKey); } catch { /* Local files may block browser storage. */ }
    page.dataset.accent = "blue";
    page.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.getElementById("theme").addEventListener("click", () => {
      page.dataset.theme = page.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(themeKey, page.dataset.theme); } catch { /* Keep this choice for the open page. */ }
    });
    document.getElementById("menu").addEventListener("click", () => app.classList.toggle("review-sidebar-open"));
    document.getElementById("scrim").addEventListener("click", () => app.classList.remove("review-sidebar-open"));
    for (const link of document.querySelectorAll(".sidebar a")) link.addEventListener("click", () => app.classList.remove("review-sidebar-open"));
    // A served page asks every few seconds whether a plan file changed, and
    // reloads when one did. If the server has stopped, it says so.
    const version = document.body.dataset.version;
    if (version) {
      const api = location.pathname.replace(/^\\/p\\//, "/api/");
      const state = document.getElementById("live-state");
      setInterval(async () => {
        try {
          const response = await fetch(api + "/version", { cache: "no-store" });
          if (!response.ok) throw new Error(String(response.status));
          if ((await response.text()) !== version) location.reload();
          state.textContent = "● Live: updates when the plan changes";
        } catch {
          state.textContent = "Not updating: the overview server has stopped";
        }
      }, 3000);
    }
  </script>
</body>
</html>
`;
}

/**
 * Serve the overview on 127.0.0.1 at an address with a secret token.
 *
 * The server answers only requests addressed to its own local host name, as
 * the decision review server does, so other web pages and other machines
 * cannot read the plans. Use the Tailscale proxy to share it.
 *
 * @param {string[]} files Absolute plan paths, in reading order.
 * @param {{root?: string}} options `root` is the folder shown paths are
 *   relative to.
 * @returns {Promise<{server: http.Server, url: string}>} The server and the
 *   page address.
 */
export async function startOverviewServer(files, { root } = {}) {
  // Build the page once now, so an unreadable plan stops the command at once.
  await renderOverview(files, { live: true, root });
  const token = randomBytes(24).toString("base64url");
  const server = http.createServer((request, response) => {
    const run = async () => {
      const host = `127.0.0.1:${server.address().port}`;
      if (request.headers.host !== host) return respond(response, 403, "Forbidden");
      if (request.method !== "GET") return respond(response, 405, "Only reading is allowed");
      const { pathname } = new URL(request.url, `http://${host}`);
      if (pathname === `/p/${token}`) return respond(response, 200, await renderOverview(files, { live: true, root }), "text/html; charset=utf-8");
      if (pathname === `/api/${token}/version`) return respond(response, 200, await plansVersion(files));
      return respond(response, 404, "Not found");
    };
    run().catch((error) => respond(response, 500, `Could not read the plan: ${error.message}`));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/p/${token}` };
}

async function main() {
  const args = process.argv.slice(2);
  const toFile = args[0] === "--file";
  const files = await checkPlanFiles(toFile ? args.slice(1) : args);
  // Report drawings the page cannot show, so the agent can fix the plan.
  for (const plan of await readPlans(files)) {
    for (const problem of plan.problems) console.error(`Warning: ${plan.shownPath}: ${problem}`);
  }
  if (toFile) {
    const output = path.resolve(".plan-review", "overview", `${path.basename(files[0], ".md")}.html`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, await renderOverview(files, { live: false }));
    console.log(output);
    return;
  }
  const { url } = await startOverviewServer(files);
  console.log(`Local: ${url}`);
  const address = await findTailnetAddress();
  if (!address) {
    console.log("Tailnet: none; Tailscale is not running on this machine, so give the person the local address.");
    return;
  }
  // A failed proxy leaves the local page working, so report it and go on.
  try {
    console.log(`Tailnet: ${(await startTailnetProxy(url, address)).url}`);
  } catch (error) {
    console.error(`Tailnet: failed (${error.message}); give the person the local address.`);
  }
}

// Run only when started as a command, also through a symlinked skill folder.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
