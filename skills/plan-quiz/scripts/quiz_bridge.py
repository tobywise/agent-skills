#!/usr/bin/env python3
"""Serve one plan quiz locally and save its submitted answers."""

import argparse
import json
import os
import secrets
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

MAX_ANSWERS_BYTES = 256 * 1024


def write_json_once(path, data):
    """Publish a complete JSON file without replacing an existing file.

    Args:
        path: Destination path.
        data: JSON-serializable data to publish.

    Returns:
        None: The complete file becomes visible at the destination path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as output:
            temporary = Path(output.name)
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def valid_packet(packet):
    """Check the response fields needed for a useful agent report.

    Args:
        packet: Decoded JSON value submitted by the quiz page.

    Returns:
        bool: Whether the packet identifies a plan and all question states.
    """
    if not isinstance(packet, dict) or not isinstance(packet.get("plan"), str):
        return False
    answers = packet.get("answers")
    if not packet["plan"].strip() or not isinstance(answers, list) or not answers:
        return False
    return all(
        isinstance(answer, dict)
        and isinstance(answer.get("id"), str)
        and isinstance(answer.get("question"), str)
        and answer.get("status") in {"answered", "unsure", "skipped"}
        for answer in answers
    )


class QuizServer(ThreadingHTTPServer):
    """Hold one quiz page and its one-time submission state."""

    daemon_threads = True


class QuizHandler(BaseHTTPRequestHandler):
    """Serve the quiz and accept one answer packet from its browser page."""

    def _respond(self, status, body, content_type="text/plain; charset=utf-8"):
        """Send a short HTTP response without caching it.

        Args:
            status: HTTP status code.
            body: Response body as bytes.
            content_type: MIME type of the response.

        Returns:
            None: The response is written to the client connection.
        """
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _valid_host(self):
        """Check that the request targets this loopback server.

        Returns:
            bool: Whether the Host header names this server's loopback address.
        """
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

    def do_GET(self):
        """Serve only the tokenized quiz URL.

        Returns:
            None: The HTML or an error is written to the client connection.
        """
        if not self._valid_host():
            self._respond(403, b"Forbidden")
            return
        if urlsplit(self.path).path != f"/quiz/{self.server.token}":
            self._respond(404, b"Not found")
            return
        self._respond(200, self.server.html, "text/html; charset=utf-8")

    def do_POST(self):
        """Validate and save the first answer packet sent by the quiz page.

        Returns:
            None: A receipt or an error is written to the client connection.
        """
        if not self._valid_host():
            self._respond(403, b"Forbidden")
            return
        if urlsplit(self.path).path != f"/submit/{self.server.token}":
            self._respond(404, b"Not found")
            return
        origin = self.headers.get("Origin")
        if origin and origin != f"http://127.0.0.1:{self.server.server_port}":
            self._respond(403, b"Forbidden")
            return
        if (
            self.headers.get("Content-Type", "").split(";", 1)[0].strip()
            != "application/json"
        ):
            self._respond(415, b"Expected application/json")
            return
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._respond(411, b"Content-Length required")
            return
        if not 0 < length <= MAX_ANSWERS_BYTES:
            self._respond(413, b"Answer packet too large")
            return
        self.connection.settimeout(10)
        try:
            packet = json.loads(self.rfile.read(length))
        except (ValueError, TimeoutError):
            self._respond(400, b"Invalid JSON")
            return
        if not valid_packet(packet):
            self._respond(400, b"Expected plan and question answers")
            return
        try:
            write_json_once(self.server.result, packet)
        except FileExistsError:
            self._respond(409, b"Answers already received")
            return
        self.server.received = True
        self._respond(200, b'{"status":"received"}', "application/json")

    def log_message(self, format, *args):
        """Suppress access logs so the one-time URL token is not logged.

        Args:
            format: Standard HTTP log format string.
            *args: Values for the format string.

        Returns:
            None: No log entry is written.
        """
        return None


def main():
    """Start the local bridge and wait for one submission or a timeout.

    Returns:
        int: Zero after a submission, or three after the timeout expires.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--result", required=True, type=Path)
    parser.add_argument("--ready", required=True, type=Path)
    parser.add_argument("--timeout", type=int, default=1800)
    args = parser.parse_args()
    if args.timeout < 1 or args.result == args.ready:
        parser.error("timeout must be positive and result and ready must differ")
    if args.result.exists() or args.ready.exists():
        parser.error("result and ready paths must not already exist")
    html = args.html.read_bytes()
    token = secrets.token_urlsafe(24)
    with QuizServer(("127.0.0.1", 0), QuizHandler) as server:
        server.html = html
        server.token = token
        server.result = args.result
        server.received = False
        server.timeout = 0.5
        url = f"http://127.0.0.1:{server.server_port}/quiz/{token}"
        write_json_once(args.ready, {"url": url, "result": str(args.result)})
        print(url, flush=True)
        deadline = time.monotonic() + args.timeout
        while not server.received and time.monotonic() < deadline:
            server.handle_request()
        if server.received:
            print(f"Received answers at {args.result}", flush=True)
            return 0
    print("Timed out waiting for quiz answers", file=sys.stderr)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
