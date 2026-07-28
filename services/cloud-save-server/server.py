#!/usr/bin/env python3
"""API minima e persistente para saves do Ultrafoot."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib
import json
import os
import re
import tempfile
import time

HOST = "127.0.0.1"
PORT = int(os.environ.get("ULTRAFOOT_SAVE_PORT", "8788"))
DATA_DIR = Path(os.environ.get("ULTRAFOOT_SAVE_DIR", "/var/lib/ultrafoot/saves"))
MAX_BODY = 16 * 1024 * 1024
CODE_RE = re.compile(r"^/([A-F0-9]{6})$")
RATE: dict[str, list[float]] = {}


def save_path(code: str) -> Path:
    return DATA_DIR / f"{hashlib.sha256(code.encode()).hexdigest()}.json"


class Handler(BaseHTTPRequestHandler):
    server_version = "UltrafootCloudSave/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}", flush=True)

    def reply(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def code(self) -> str | None:
        match = CODE_RE.fullmatch(self.path)
        return match.group(1) if match else None

    def rate_limited(self) -> bool:
        now = time.time()
        ip = self.client_address[0]
        recent = [stamp for stamp in RATE.get(ip, []) if now - stamp < 60]
        recent.append(now)
        RATE[ip] = recent
        return len(recent) > 60

    def do_GET(self) -> None:
        if self.path == "/health":
            self.reply(200, {"ok": True, "service": "ultrafoot-cloud-save", "version": "1.0.191"})
            return
        code = self.code()
        if not code or self.rate_limited():
            self.reply(429 if code else 404, {"error": "not_found" if not code else "rate_limited"})
            return
        path = save_path(code)
        if not path.exists():
            self.reply(404, {"error": "not_found"})
            return
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_PUT(self) -> None:
        code = self.code()
        if not code or self.rate_limited():
            self.reply(429 if code else 404, {"error": "not_found" if not code else "rate_limited"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self.reply(413, {"error": "payload_too_large"})
            return
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw)
            if data.get("version") != 2 or not isinstance(data.get("entries"), dict):
                raise ValueError("invalid bundle")
        except (json.JSONDecodeError, ValueError, AttributeError):
            self.reply(400, {"error": "invalid_save"})
            return

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".save-", dir=DATA_DIR)
        try:
            with os.fdopen(fd, "wb") as target:
                target.write(raw)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, save_path(code))
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        self.reply(200, {"ok": True, "code": code})


if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
