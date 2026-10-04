#!/usr/bin/env node
// Make a running review page reachable from the person's other devices over
// Tailscale. The review server only answers requests addressed to 127.0.0.1,
// so this proxy listens on the machine's private Tailscale address, accepts
// only requests made to that address by this review's page, and passes them
// on rewritten as local requests. On a machine without Tailscale it does
// nothing, so the agent can run it everywhere.
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const PREFERRED_PORT = 8765;

/**
 * Find this machine's Tailscale IPv4 address.
 *
 * @returns {Promise<string | null>} The 100.x address, or null when Tailscale
 *   is not installed, not running, or has no address.
 */
export async function findTailnetAddress() {
  try {
    const { stdout } = await runFile("tailscale", ["ip", "-4"], { timeout: 5000 });
    const address = stdout.trim().split("\n")[0];
    return /^100\.\d+\.\d+\.\d+$/.test(address) ? address : null;
  } catch {
    return null;
  }
}

/**
 * Start a proxy from a listen address to a local review server.
 *
 * @param {string} pageUrl The review page URL printed by `serve`.
 * @param {string} listenAddress The address to listen on.
 * @param {number} port The port to try first; 0 picks any free port.
 * @returns {Promise<{server: http.Server, url: string}>} The proxy and the page
 *   URL to give the person.
 */
export async function startTailnetProxy(pageUrl, listenAddress, port = PREFERRED_PORT) {
  const local = new URL(pageUrl);
  if (local.protocol !== "http:" || local.hostname !== "127.0.0.1") {
    throw new Error("The review page must be the local http://127.0.0.1 URL printed by serve.");
  }
  let publicOrigin = "";
  const server = http.createServer((request, response) => {
    // Accept only requests addressed to this proxy, and writes only from this
    // review's own page, as the review server does for local requests.
    if (request.headers.host !== new URL(publicOrigin).host) {
      response.writeHead(403).end("Host rejected");
      return;
    }
    const origin = request.headers.origin;
    if ((origin && origin !== publicOrigin) || (request.method === "POST" && !origin)) {
      response.writeHead(403).end("Origin rejected");
      return;
    }
    const headers = { ...request.headers, host: local.host };
    if (origin) headers.origin = local.origin;
    delete headers.connection;
    // Forward the original path, so the review's secret page and API URLs
    // still have to match.
    const forwarded = http.request(
      { hostname: local.hostname, port: local.port, path: request.url, method: request.method, headers },
      (reply) => {
        response.writeHead(reply.statusCode, reply.headers);
        reply.on("error", () => response.destroy());
        reply.pipe(response);
      },
    );
    forwarded.on("error", () => {
      if (response.headersSent) response.destroy();
      else response.writeHead(502).end("The local review server is unavailable.");
    });
    forwarded.setTimeout(30000, () => forwarded.destroy());
    request.on("aborted", () => forwarded.destroy());
    request.pipe(forwarded);
  });
  await listen(server, port, listenAddress).catch((error) => {
    // Another review may already use the usual port; take any free one.
    if (error.code !== "EADDRINUSE" || port === 0) throw error;
    return listen(server, 0, listenAddress);
  });
  publicOrigin = `http://${listenAddress}:${server.address().port}`;
  return { server, url: `${publicOrigin}${local.pathname}` };
}

function listen(server, port, address) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, address, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function main() {
  const [pageUrl] = process.argv.slice(2);
  if (!pageUrl) throw new Error("Usage: tailnet-proxy <page URL printed by serve>");
  const address = await findTailnetAddress();
  if (!address) {
    console.log("Tailscale is not running on this machine; give the person the local URL.");
    return;
  }
  const { url } = await startTailnetProxy(pageUrl, address);
  console.log(url);
}

// Run only when started as a command, also through a symlinked skill folder.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
