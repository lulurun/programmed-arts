#!/usr/bin/env python3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import json
import re


ROOT = Path(__file__).resolve().parent
DATA_ROOT = ROOT / "saved-art"
HOST = "0.0.0.0"
PORT = 4174
MAX_BODY_BYTES = 1024 * 1024


def safe_name(value):
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "_", value.strip())
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._-")
    return cleaned or "untitled"


def json_response(handler, status, payload):
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def error_response(handler, status, message):
    json_response(handler, status, {"error": message})


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length > MAX_BODY_BYTES:
        raise ValueError("Request body is too large")
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def artifact_file(art_name, artifact_type, artifact_name):
    prefix = "pattern" if artifact_type == "patterns" else "layout"
    return DATA_ROOT / safe_name(art_name) / f"{prefix}_{safe_name(artifact_name)}.json"


def load_artifacts(art_name, artifact_type):
    prefix = "pattern" if artifact_type == "patterns" else "layout"
    art_dir = DATA_ROOT / safe_name(art_name)
    artifacts = []
    for path in sorted(art_dir.glob(f"{prefix}_*.json")):
        try:
            with path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                artifacts.append(data)
        except (OSError, json.JSONDecodeError):
            continue
    return artifacts


class ArtRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api_get()
            return
        super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/api/"):
            self.handle_api_put()
            return
        error_response(self, HTTPStatus.NOT_FOUND, "Not found")

    def handle_api_get(self):
        parts = self.api_parts()
        if len(parts) == 2 and parts[0] in {"art", "files"}:
            art_name = parts[1]
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "art": safe_name(art_name),
                    "patterns": load_artifacts(art_name, "patterns"),
                    "layouts": load_artifacts(art_name, "layouts"),
                },
            )
            return
        error_response(self, HTTPStatus.NOT_FOUND, "Unknown API route")

    def handle_api_put(self):
        parts = self.api_parts()
        if len(parts) == 4 and parts[0] in {"art", "files"} and parts[2] in {"patterns", "layouts"}:
            art_name = parts[1]
            artifact_type = parts[2]
            artifact_name = parts[3]
            try:
                payload = read_json_body(self)
            except (ValueError, json.JSONDecodeError) as exc:
                error_response(self, HTTPStatus.BAD_REQUEST, str(exc))
                return

            if not isinstance(payload, dict):
                error_response(self, HTTPStatus.BAD_REQUEST, "JSON body must be an object")
                return

            path = artifact_file(art_name, artifact_type, artifact_name)
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                **payload,
                "name": payload.get("name") or artifact_name,
                "type": "pattern" if artifact_type == "patterns" else "layout",
            }
            with path.open("w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2)
                handle.write("\n")

            json_response(self, HTTPStatus.OK, {"ok": True, "path": str(path.relative_to(ROOT)), "artifact": payload})
            return

        error_response(self, HTTPStatus.NOT_FOUND, "Unknown API route")

    def api_parts(self):
        parsed = urlparse(self.path)
        return [unquote(part) for part in parsed.path.removeprefix("/api/").split("/") if part]


if __name__ == "__main__":
    DATA_ROOT.mkdir(exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), ArtRequestHandler)
    print(f"Serving HTTP on {HOST} port {PORT} (http://{HOST}:{PORT}/) ...")
    print(f"Saving art JSON under {DATA_ROOT.relative_to(ROOT)}/")
    server.serve_forever()
