// Turn a Markdown implementation plan into safe HTML for the plan overview.
// It handles the Markdown that plans use: headings, paragraphs, nested
// lists, task boxes, tables, code blocks, quotes, emphasis, and links, plus
// two kinds of illustration: `diff` blocks, shown as coloured before-and-after
// lines, and `svg` blocks, shown as drawings. All plan text is escaped, so
// text in a plan never runs as HTML or script.
// Contract (C-01) and acceptance (AC-01) IDs become links to the item that
// defines them, so a reviewer can follow a cross-reference with one click.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const PLAN_ID = /\b(AC|C)-(\d+)\b/g;
// A line that defines an ID starts with it: a list item, heading, or table row.
const DEFINITION = /^\s*(?:(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?|#{1,6}\s+|\|\s*)[*_`]*((?:AC|C)-\d+)\b/gm;
const LEADING_ID = /^[*_`]*((?:AC|C)-\d+)\b/;
// Plan labels from the `planning` and `scientific-analysis` skills. In a table
// cell on their own they show as coloured badges.
const LABEL_TONES = {
  IMPLEMENTATION: "badge-info",
  INTERPRETATION: "badge-warning",
  DEFERRED: "badge-secondary",
  DIRECT: "badge-info",
  CONTINGENT: "badge-secondary",
};
// A drawing is shown as an image, where a browser runs no script and loads no
// other file. The size limit keeps the page quick to load on a phone.
const DRAWING_LIMIT = 200 * 1024;
const XML_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/**
 * Escape text so a browser shows it as text.
 *
 * @param {unknown} text The text to escape.
 * @returns {string} The escaped text.
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

/**
 * Render one Markdown plan as HTML sections, with the facts and contract
 * coverage to show above them.
 *
 * The first level-1 heading is the plan title. Each level-2 heading starts a
 * section; text before the first one becomes an "Introduction" section.
 *
 * @param {string} markdown The plan text.
 * @param {string} prefix A short, unique ID prefix for this plan, such as
 *   `p1`, so several plans on one page keep separate anchors.
 * @param {string} fallbackTitle The title to use when the plan has no
 *   level-1 heading, normally the file name.
 * @returns {{
 *   title: string,
 *   sections: {id: string, kind: string, title: string, titleHtml: string, html: string}[],
 *   labels: {review: string | null, profile: string | null, validation: string | null},
 *   counts: {contracts: number, acceptance: number, unproved: number, revisions: number},
 *   coverage: {id: string, href: string, summary: string, retired: boolean, provedBy: {id: string, href: string}[]}[],
 *   problems: string[],
 * }} The plan title; each section's anchor, kind, titles, and body; the
 *   review standard and scientific profile; summary counts; which acceptance
 *   items prove each contract; and drawings that could not be shown.
 */
export function renderPlan(markdown, prefix, fallbackTitle) {
  const text = markdown.replace(/\r\n?/g, "\n").replaceAll("\u0000", "");
  const defined = new Set([...text.matchAll(DEFINITION)].map((match) => match[1]));
  const context = { prefix, defined, anchored: new Set(), slugs: new Map(), definitions: new Map(), problems: [], section: "" };
  const blocks = parseBlocks(text.split("\n"));
  const titleIndex = blocks.findIndex((block) => block.type === "heading" && block.level === 1);
  const title = titleIndex >= 0 ? plainText(blocks.splice(titleIndex, 1)[0].text) : fallbackTitle;

  // Group the blocks into one section per level-2 heading.
  const groups = [];
  let current = { title: "Introduction", blocks: [] };
  for (const block of blocks) {
    if (block.type === "heading" && block.level === 2) {
      if (current.blocks.length) groups.push(current);
      current = { title: plainText(block.text), heading: block.text, blocks: [] };
    } else current.blocks.push(block);
  }
  if (current.blocks.length || current.heading) groups.push(current);

  const sections = groups.map((section) => {
    context.section = section.title;
    return {
      id: anchorFor(context, section.title),
      kind: section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: section.title,
      titleHtml: section.heading ? inline(section.heading, context) : escapeHtml(section.title),
      html: renderBlocks(section.blocks, context),
    };
  });

  const coverage = contractCoverage(context);
  const revisions = groups.find((section) => /^revisions$/i.test(section.title));
  return {
    title,
    sections,
    labels: planLabels(text),
    counts: {
      contracts: coverage.length,
      acceptance: [...defined].filter((id) => id.startsWith("AC-")).length,
      unproved: coverage.filter((contract) => !contract.retired && !contract.provedBy.length).length,
      revisions: revisions ? revisions.blocks.filter((block) => block.type === "list").reduce((total, list) => total + list.items.length, 0) : 0,
    },
    coverage,
    problems: context.problems,
  };
}

/**
 * Find the review standard and scientific profile the plan declares.
 *
 * @param {string} text The plan text.
 * @returns {{review: string | null, profile: string | null, validation: string | null}}
 *   Each label, or null when the plan does not state it.
 */
function planLabels(text) {
  // Labels are written as in the `planning` skill, for example
  // "Review standard: `SCIENTIFIC_ANALYSIS`" or "**Delivery profile:** SINGLE_USE".
  const find = (label) => text.match(new RegExp(`${label}[*_\`:|\\s]*([A-Z][A-Z_]{2,})\\b`))?.[1] ?? null;
  return { review: find("[Rr]eview standard"), profile: find("[Dd]elivery profile"), validation: find("Validation") };
}

/**
 * Link each contract to the acceptance items that prove it. An acceptance
 * item proves a contract when either one's definition names the other, so
 * both "AC-01 … (C-01)" and "C-01 … Proof: AC-01" count.
 *
 * @param {{prefix: string, definitions: Map<string, {text: string, summary: string}>}} context
 *   The render state, holding the text that defines each ID.
 * @returns {{id: string, href: string, summary: string, retired: boolean, provedBy: {id: string, href: string}[]}[]}
 *   One entry per contract, in number order.
 */
function contractCoverage(context) {
  const byNumber = (a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]);
  const ids = [...context.definitions.keys()];
  const mentions = (id, other) => new RegExp(`\\b${other}\\b`).test(context.definitions.get(id).text);
  const href = (id) => `#${context.prefix}-${id.toLowerCase()}`;
  const acceptance = ids.filter((id) => id.startsWith("AC-")).sort(byNumber);
  return ids.filter((id) => id.startsWith("C-")).sort(byNumber).map((id) => ({
    id,
    href: href(id),
    summary: context.definitions.get(id).summary,
    retired: /retired in revision/i.test(context.definitions.get(id).text),
    provedBy: acceptance.filter((item) => mentions(item, id) || mentions(id, item)).map((item) => ({ id: item, href: href(item) })),
  }));
}

function parseBlocks(lines) {
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(FENCE);
    if (fence) {
      const close = new RegExp(`^\\s{0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body = [];
      index += 1;
      while (index < lines.length && !close.test(lines[index])) body.push(lines[index++]);
      index += 1;
      blocks.push({ type: "code", language: fence[2].toLowerCase(), text: body.join("\n") });
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }
    if (line.includes("|") && lines[index + 1]?.includes("|") && TABLE_RULE.test(lines[index + 1])) {
      const table = { type: "table", head: cells(line), align: cells(lines[index + 1]).map(alignment), rows: [] };
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) table.rows.push(cells(lines[index++]));
      blocks.push(table);
      continue;
    }
    if (QUOTE.test(line)) {
      const body = [];
      while (index < lines.length && lines[index].trim()) {
        const quoted = lines[index].match(QUOTE);
        if (!quoted && startsBlock(lines[index])) break;
        body.push(quoted ? quoted[1] : lines[index]);
        index += 1;
      }
      blocks.push({ type: "quote", blocks: parseBlocks(body) });
      continue;
    }
    if (ITEM.test(line)) {
      const list = parseList(lines, index);
      blocks.push(list.block);
      index = list.next;
      continue;
    }
    const body = [];
    while (index < lines.length && lines[index].trim() && !(body.length && startsBlock(lines[index]))) body.push(lines[index++].trim());
    blocks.push({ type: "paragraph", text: body.join("\n") });
  }
  return blocks;
}

function startsBlock(line) {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);
}

// A list runs while items of the same kind start at the same indent. Lines
// indented past the marker, and unindented text that directly continues an
// item, belong to that item and are parsed again as blocks, which is how
// nested lists work.
function parseList(lines, start) {
  const first = lines[start].match(ITEM);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const sameKind = (line) => {
    const match = line?.match(ITEM);
    return match && match[1].length === indent && /\d/.test(match[2]) === ordered ? match : null;
  };
  const items = [];
  let index = start;
  let match = first;
  while (match) {
    const contentIndent = match[1].length + match[2].length + 1;
    const body = [match[3]];
    index += 1;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        const next = nextFilled(lines, index);
        if (next < lines.length && leadingSpaces(lines[next]) > indent) {
          body.push(...Array(next - index).fill(""));
          index = next;
          continue;
        }
        break;
      }
      const spaces = leadingSpaces(line);
      if (spaces > indent) body.push(line.slice(Math.min(spaces, contentIndent)));
      else if (!startsBlock(line) && body.at(-1).trim()) body.push(line.trim());
      else break;
      index += 1;
    }
    items.push(listItem(body));
    // Items separated by blank lines still belong to one list.
    const next = nextFilled(lines, index);
    match = sameKind(lines[next]);
    if (match) index = next;
  }
  const number = Number.parseInt(first[2], 10);
  return { block: { type: "list", ordered, start: ordered ? number : 1, items }, next: index };
}

function listItem(body) {
  const task = body[0].match(/^\[([ xX])\]\s+(.*)$/);
  if (task) body[0] = task[2];
  return { task: task ? task[1].toLowerCase() === "x" : null, text: body.join("\n"), blocks: parseBlocks(body) };
}

function nextFilled(lines, index) {
  while (index < lines.length && !lines[index].trim()) index += 1;
  return index;
}

function leadingSpaces(line) {
  return line.match(/^\s*/)[0].replace(/\t/g, "    ").length;
}

function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll("\\|", "|"));
}

function alignment(rule) {
  if (rule.startsWith(":") && rule.endsWith(":")) return "center";
  return rule.endsWith(":") ? "right" : "";
}

function renderBlocks(blocks, context) {
  return blocks.map((block) => renderBlock(block, context)).join("\n");
}

function renderBlock(block, context) {
  if (block.type === "heading") {
    const level = Math.min(block.level + 1, 6);
    const id = definitionAnchor(block.text, block.text, context) ?? anchorFor(context, plainText(block.text));
    return `<h${level} id="${id}">${inline(block.text, context)}</h${level}>`;
  }
  if (block.type === "paragraph") return `<p>${inline(block.text, context)}</p>`;
  if (block.type === "code") return renderCode(block, context);
  if (block.type === "rule") return "<hr>";
  if (block.type === "quote") return `<blockquote>${renderBlocks(block.blocks, context)}</blockquote>`;
  if (block.type === "table") return renderTable(block, context);
  const tag = block.ordered ? "ol" : "ul";
  const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : "";
  const items = block.items.map((item) => {
    const first = item.blocks[0];
    const id = first?.type === "paragraph" ? definitionAnchor(first.text, item.text, context) : null;
    const box = item.task === null ? "" : `<span class="plan-task-box" role="img" aria-label="${item.task ? "Done" : "Not done"}">${item.task ? "☑" : "☐"}</span> `;
    const attributes = `${id ? ` id="${id}"` : ""}${item.task === null ? "" : ' class="plan-task"'}`;
    const content = renderBlocks(item.blocks, context);
    return `<li${attributes}>${content.startsWith("<p>") ? `<p>${box}${content.slice(3)}` : box + content}</li>`;
  });
  return `<${tag}${start}>${items.join("")}</${tag}>`;
}

function renderTable(block, context) {
  const cell = (tag, value, column) => {
    const align = block.align[column] ? ` class="align-${block.align[column]}"` : "";
    const label = value.replace(/`/g, "").trim();
    const html = LABEL_TONES[label] ? `<span class="badge ${LABEL_TONES[label]}">${label}</span>` : inline(value, context);
    return `<${tag}${align}>${html}</${tag}>`;
  };
  const head = block.head.map((value, column) => cell("th", value, column)).join("");
  const rows = block.rows.map((row) => {
    // The contract or acceptance text is the first column after the ID.
    const id = definitionAnchor(row[0] ?? "", row.join(" | "), context, row[1] ?? "");
    return `<tr${id ? ` id="${id}"` : ""}>${row.map((value, column) => cell("td", value, column)).join("")}</tr>`;
  });
  return `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function renderCode(block, context) {
  if (block.language === "svg") return renderDrawing(block.text, context);
  if (block.language === "diff") {
    // Colour each line by its first character, as in a code review: "+" for
    // added, "-" for removed, "@@" for the position of a change.
    const lines = block.text.split("\n").map((line) => {
      let kind = "same";
      if (/^(\+\+\+|---)(\s|$)/.test(line)) kind = "file";
      else if (line.startsWith("+")) kind = "add";
      else if (line.startsWith("-")) kind = "remove";
      else if (line.startsWith("@@")) kind = "hunk";
      return `<span class="diff-line diff-${kind}">${escapeHtml(line) || " "}</span>`;
    });
    return `<pre class="code-block overview-diff"><code>${lines.join("")}</code></pre>`;
  }
  const language = block.language ? ` data-language="${escapeHtml(block.language)}"` : "";
  return `<pre class="code-block"${language}><code>${escapeHtml(block.text)}</code></pre>`;
}

// Show an `svg` block as a picture with its <title> as the caption. A block
// that is not one complete SVG drawing is shown as text with a warning, and
// listed as a problem so the agent can fix it.
function renderDrawing(source, context) {
  let svg = source.trim().replace(/^<\?xml[^>]*>\s*/, "");
  const problem = !/^<svg[\s>]/.test(svg) || !/<\/svg>$/.test(svg)
    ? "it must be one complete <svg> … </svg> element"
    : Buffer.byteLength(svg) > DRAWING_LIMIT ? `it is larger than ${DRAWING_LIMIT / 1024} KB` : null;
  if (problem) {
    context.problems.push(`A drawing in "${context.section}" cannot be shown: ${problem}.`);
    return `<div class="alert alert-warning"><div class="alert-description">This drawing cannot be shown: ${escapeHtml(problem)}.</div></div><pre class="code-block"><code>${escapeHtml(source)}</code></pre>`;
  }
  // A browser shows an SVG image only when it names the SVG namespace.
  if (!/^<svg[^>]*\sxmlns=/.test(svg)) svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const title = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1].replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]).trim();
  const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : "";
  return `<figure class="overview-figure"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" alt="${escapeHtml(title || "Plan illustration")}">${caption}</figure>`;
}

// Give the first item that starts with a contract or acceptance ID an anchor,
// so every mention of that ID can link to it, and keep its text for the
// coverage table.
function definitionAnchor(lead, text, context, summary = text) {
  const id = lead.match(LEADING_ID)?.[1];
  if (!id || context.anchored.has(id)) return null;
  context.anchored.add(id);
  const short = plainText(summary).replace(LEADING_ID, "").replace(/^[\s:.–—-]+/, "").split("\n")[0];
  context.definitions.set(id, { text, summary: short.length > 110 ? `${short.slice(0, 107).trimEnd()}…` : short });
  return `${context.prefix}-${id.toLowerCase()}`;
}

function anchorFor(context, title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
  const count = context.slugs.get(slug) ?? 0;
  context.slugs.set(slug, count + 1);
  return `${context.prefix}-${slug}${count ? `-${count + 1}` : ""}`;
}

function plainText(text) {
  return text.replace(/[*_`]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
}

// Inline Markdown. Code, links, and IDs are rendered first and set aside, so
// later steps cannot change text inside them; the rest is escaped before
// emphasis is added.
function inline(text, context, inLink = false) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  // A code span opens and closes with backtick runs of the same length.
  let out = text.replace(/(?<!`)(`+)(?!`)([\s\S]+?)(?<!`)\1(?!`)/g, (_, ticks, code) => keep(`<code>${escapeHtml(code.trim())}</code>`));
  out = out.replace(/<(https?:\/\/[^\s>]+)>/g, (_, url) => keep(link(url, escapeHtml(url), context)));
  if (!inLink) {
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, url) => keep(link(url, inline(label, context, true), context)));
  }
  out = escapeHtml(out);
  out = out.replace(PLAN_ID, (id) => {
    if (inLink || !context.defined.has(id)) return keep(`<span class="badge badge-outline badge-mono">${id}</span>`);
    return keep(`<a class="badge badge-outline badge-mono plan-ref" href="#${context.prefix}-${id.toLowerCase()}">${id}</a>`);
  });
  out = out
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, number) => stash[Number(number)]);
}

// Web and mail links open normally, and `#section` links go to this plan's
// own headings. Links to local files cannot open from the page, so they show
// as text with the target in a tooltip.
function link(url, labelHtml, context) {
  if (/^(https?:\/\/|mailto:)/i.test(url)) return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;
  if (/^#[\w-]+$/.test(url)) return `<a href="#${context.prefix}-${escapeHtml(url.slice(1).toLowerCase())}">${labelHtml}</a>`;
  return `<span class="plan-file-link" title="${escapeHtml(url)}">${labelHtml}</span>`;
}
