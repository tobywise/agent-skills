import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadReview, saveAnswer, submitRound } from "./review-data.mjs";

const htmlFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/review.html");
const assetFolder = path.dirname(htmlFile);
const BODY_LIMIT = 64 * 1024;

async function readPage() {
  const [template, sans, mono, ...styles] = await Promise.all([
    readFile(htmlFile, "utf8"),
    readFile(path.join(assetFolder, "fluidplan/geist-latin-wght-normal.woff2")),
    readFile(path.join(assetFolder, "fluidplan/geist-mono-latin-wght-normal.woff2")),
    ...["tokens.css", "base.css", "components.css", "app.css"].map(name => readFile(path.join(assetFolder, "fluidplan", name), "utf8")),
    readFile(path.join(assetFolder, "review.css"), "utf8"),
  ]);
  const fonts = `@font-face{font-family:"Geist Variable";src:url(data:font/woff2;base64,${sans.toString("base64")}) format("woff2");font-weight:100 900;font-display:swap}\n@font-face{font-family:"Geist Mono Variable";src:url(data:font/woff2;base64,${mono.toString("base64")}) format("woff2");font-weight:100 900;font-display:swap}`;
  return template.replace("__STYLE__", [fonts, ...styles].join("\n"));
}

export function embedData(html, data) {
  const encoded = JSON.stringify(data).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
  return html.replace("__BOOT_DATA__", encoded);
}

export async function exportPage(root, id) {
  const { files, plan, answers, state } = await loadReview(root, id);
  const html = embedData(await readPage(), { standalone: true, id, plan, answers, state });
  const output = path.join(files.folder, "review.html");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(output, html);
  return output;
}

export async function startServer(root, id) {
  await loadReview(root, id);
  const token = randomBytes(24).toString("base64url");
  const html = embedData(await readPage(), { standalone: false, id });
  let queue = Promise.resolve();
  const server = http.createServer((request, response) => {
    const run = async () => {
      const address = server.address();
      const host = `127.0.0.1:${address.port}`;
      if (request.headers.host !== host) return respond(response, 403, "Forbidden");
      const url = new URL(request.url, `http://${host}`);
      const pagePath = `/p/${token}`;
      const apiPath = `/api/${token}`;
      if (request.method === "GET" && url.pathname === pagePath) return respond(response, 200, html, "text/html; charset=utf-8");
      if (request.method === "GET" && url.pathname === `${apiPath}/bundle`) {
        const { plan, answers, state } = await loadReview(root, id);
        return respond(response, 200, { plan, answers, state });
      }
      if (request.method === "GET" && url.pathname === `${apiPath}/state`) {
        const { state } = await loadReview(root, id);
        return respond(response, 200, state);
      }
      if (request.method === "POST" && (url.pathname === `${apiPath}/answer` || url.pathname === `${apiPath}/submit`)) {
        if (request.headers.origin !== `http://${host}`) return respond(response, 403, "Origin rejected");
        const task = async () => {
          if (url.pathname.endsWith("/answer")) {
            const body = await readBody(request);
            const saved = await saveAnswer(root, id, body?.decisionId, body?.answer);
            return respond(response, 200, { saved });
          }
          const summary = await submitRound(root, id);
          return respond(response, 200, summary);
        };
        const current = queue.then(task, task);
        queue = current.catch(() => {});
        return current;
      }
      return respond(response, 404, "Not found");
    };
    run().catch((error) => respond(response, error.message.includes("closed") || error.message.includes("already sent") ? 409 : 400, error.message));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/p/${token}` };
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("Answer is too large");
    chunks.push(chunk);
  }
  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") throw new Error("Expected JSON");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(response, status, value, type) {
  if (response.headersSent) return;
  const body = typeof value === "string" ? value : JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": type ?? (typeof value === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8"),
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
  });
  response.end(body);
}
