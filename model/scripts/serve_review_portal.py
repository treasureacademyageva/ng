#!/usr/bin/env python3
"""Serve the private review portal with authenticated workspace persistence."""
from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import urllib.parse
from datetime import date, datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "data/staging/review-workbooks/START-REVIEWING.html"
PROGRESS = ROOT / "data/staging/review-progress/current.json"
REGISTRY = ROOT / "data/source-candidates.json"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
MAX_BODY = 131_072
ROLE_BY_TRACK = {
    "candidate_licence": "authorised_licence_reviewer",
    "candidate_teacher": "qualified_nigerian_primary_teacher",
    "candidate_safeguarding": "designated_safeguarding_lead",
    "pilot_teacher": "qualified_nigerian_primary_teacher",
    "pilot_safeguarding": "designated_safeguarding_lead",
    "conditional_legal": "qualified_legal_counsel",
}
DECISIONS_BY_TRACK = {
    "candidate_licence": {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"},
    "candidate_teacher": {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"},
    "candidate_safeguarding": {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"},
    "pilot_teacher": {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"},
    "pilot_safeguarding": {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"},
    "conditional_legal": {"PENDING", "CLEARED", "NOT_CLEARED", "MORE_INFORMATION_REQUIRED"},
}
NOTES_REQUIRED = {"CHANGES_REQUIRED", "REJECTED", "NOT_CLEARED", "MORE_INFORMATION_REQUIRED"}


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def allowed_records() -> dict[str, dict[str, str]]:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))["items"]
    all_candidates = {row["id"]: row["extracted_sha256"] for row in registry}
    ready = {row["id"]: row["extracted_sha256"] for row in registry if row["staging_status"] == "STAGED_UNAPPROVED"}
    excluded = {row["id"]: row["extracted_sha256"] for row in registry if row["staging_status"] == "LICENSE_EXCLUDED"}
    pilot = {row["sample_id"]: row["content_sha256"] for row in load_csv(PILOT)}
    return {
        "candidate_licence": all_candidates,
        "candidate_teacher": ready,
        "candidate_safeguarding": ready,
        "pilot_teacher": pilot,
        "pilot_safeguarding": pilot,
        "conditional_legal": excluded,
    }


def empty_state() -> dict:
    return {
        "schema": "treasure-private-review-workspace-v1",
        "updatedAt": None,
        "trainingApprovalGranted": False,
        "reviews": {},
    }


def load_state() -> dict:
    if not PROGRESS.exists():
        return empty_state()
    state = json.loads(PROGRESS.read_text(encoding="utf-8"))
    if state.get("schema") != "treasure-private-review-workspace-v1" or state.get("trainingApprovalGranted") is not False:
        raise ValueError("stored review state has invalid schema or approval flag")
    if not isinstance(state.get("reviews"), dict):
        raise ValueError("stored review state is malformed")
    return state


def save_state(state: dict) -> None:
    PROGRESS.parent.mkdir(parents=True, exist_ok=True)
    state["updatedAt"] = datetime.now(timezone.utc).isoformat()
    state["trainingApprovalGranted"] = False
    temporary = PROGRESS.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(PROGRESS)


def validate_review(payload: dict, allowed: dict[str, dict[str, str]]) -> tuple[str, dict]:
    if set(payload) != {"track", "itemId", "review"}:
        raise ValueError("request must contain only track, itemId and review")
    track = payload.get("track")
    item_id = payload.get("itemId")
    review = payload.get("review")
    if track not in allowed or item_id not in allowed[track] or not isinstance(review, dict):
        raise ValueError("unknown review track or item")
    permitted_fields = {
        "reviewerName", "reviewerRole", "reviewedAt", "decision", "notes",
        "confirmed", "contentSha256", "savedAt",
    }
    if not set(review) <= permitted_fields:
        raise ValueError("review contains unsupported fields")
    clean = {
        "reviewerName": str(review.get("reviewerName", "")).strip(),
        "reviewerRole": str(review.get("reviewerRole", "")).strip(),
        "reviewedAt": str(review.get("reviewedAt", "")).strip(),
        "decision": str(review.get("decision", "PENDING")).strip(),
        "notes": str(review.get("notes", "")).strip(),
        "confirmed": review.get("confirmed") is True,
        "contentSha256": str(review.get("contentSha256", "")).strip(),
        "savedAt": datetime.now(timezone.utc).isoformat(),
    }
    if clean["contentSha256"] != allowed[track][item_id]:
        raise ValueError("content hash does not match the current manifest")
    if clean["decision"] not in DECISIONS_BY_TRACK[track]:
        raise ValueError("decision is not allowed for this track")
    if len(clean["reviewerName"]) > 160 or len(clean["notes"]) > 20_000:
        raise ValueError("reviewer name or notes exceed the permitted size")
    if clean["decision"] != "PENDING":
        if not clean["reviewerName"] or not clean["reviewedAt"] or not clean["confirmed"]:
            raise ValueError("non-pending decision requires real name, date and confirmation")
        if clean["reviewerRole"] != ROLE_BY_TRACK[track]:
            raise ValueError("reviewer role does not match this track")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean["reviewedAt"]):
            raise ValueError("review date must use YYYY-MM-DD")
        try:
            parsed = date.fromisoformat(clean["reviewedAt"])
        except ValueError as exc:
            raise ValueError("review date is invalid") from exc
        if parsed > date.today():
            raise ValueError("review date cannot be in the future")
        if clean["decision"] in NOTES_REQUIRED and not clean["notes"]:
            raise ValueError("this decision requires explanatory notes")
    return f"{track}:{item_id}", clean


def export_state(state: dict) -> dict:
    rows = []
    for key, review in sorted(state["reviews"].items()):
        track, item_id = key.split(":", 1)
        rows.append({"track": track, "itemId": item_id, **review})
    return {
        "schema": "treasure-human-review-export-v1",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "branch": "preview",
        "trainingApprovalGranted": False,
        "reviews": rows,
    }


def login_page(error: str = "") -> bytes:
    message = f"<p class=\"error\">{error}</p>" if error else ""
    return f"""<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Private Review Login</title><style>body{{margin:0;background:#eef3f8;color:#152238;font:16px/1.5 system-ui}}main{{max-width:520px;margin:10vh auto;background:white;padding:30px;border-radius:16px;border:1px solid #d7deea;box-shadow:0 8px 30px #1232}}h1{{color:#0b2e59}}input,button{{width:100%;font:inherit;padding:12px;border-radius:8px}}input{{border:1px solid #aeb9c9}}button{{margin-top:14px;border:0;background:#1769aa;color:white;font-weight:700}}.error{{color:#9c2f2f;font-weight:700}}.note{{background:#fff9e8;border-left:4px solid #f2b134;padding:12px}}</style></head><body><main><h1>Treasure Private Review Portal</h1><p class=\"note\">Enter the temporary access code supplied in chat. Reviews save directly into the private workspace. This is not the public school website.</p>{message}<form method=\"post\" action=\"/unlock\"><label for=\"code\">Access code</label><input id=\"code\" name=\"code\" type=\"password\" autocomplete=\"current-password\" required autofocus><button type=\"submit\">Open review portal</button></form></main></body></html>""".encode("utf-8")


class ReviewHandler(BaseHTTPRequestHandler):
    server_version = "TreasureReview/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    @property
    def configured(self):
        return self.server  # type: ignore[return-value]

    def security_headers(self, content_type: str, length: int, *, attachment: str | None = None) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'",
        )
        if attachment:
            self.send_header("Content-Disposition", f'attachment; filename="{attachment}"')

    def cookie_ok(self) -> bool:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        value = cookie.get("review_session")
        return bool(value and hmac.compare_digest(value.value, self.configured.session_token))

    def same_origin_ok(self) -> bool:
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        return not origin or not host or urllib.parse.urlsplit(origin).netloc == host

    def send_bytes(self, status: int, data: bytes, content_type: str, *, attachment: str | None = None) -> None:
        self.send_response(status)
        self.security_headers(content_type, len(data), attachment=attachment)
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, status: int, value: dict, *, attachment: str | None = None) -> None:
        self.send_bytes(status, (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8"), "application/json; charset=utf-8", attachment=attachment)

    def send_error_text(self, status: int, message: str) -> None:
        self.send_bytes(status, message.encode("utf-8"), "text/plain; charset=utf-8")

    def body(self) -> bytes:
        length_text = self.headers.get("Content-Length", "0")
        if not length_text.isdigit() or int(length_text) > MAX_BODY:
            raise ValueError("request body is too large")
        return self.rfile.read(int(length_text))

    def do_GET(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if path == "/healthz":
            self.send_json(HTTPStatus.OK, {"status": "ok", "portal": PORTAL.exists()})
            return
        if path == "/logout":
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Set-Cookie", "review_session=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/")
            self.send_header("Location", "/")
            self.end_headers()
            return
        if not self.cookie_ok():
            self.send_bytes(HTTPStatus.OK, login_page(), "text/html; charset=utf-8")
            return
        if path == "/":
            if not PORTAL.exists():
                self.send_error_text(HTTPStatus.SERVICE_UNAVAILABLE, "Portal has not been generated")
                return
            content = PORTAL.read_text(encoding="utf-8").replace(
                "</head>", "<script>window.__WORKSPACE_SERVER__=true</script></head>", 1
            ).encode("utf-8")
            self.send_bytes(HTTPStatus.OK, content, "text/html; charset=utf-8")
        elif path == "/api/reviews":
            try:
                with self.configured.state_lock:
                    state = load_state()
                self.send_json(HTTPStatus.OK, state)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                self.send_error_text(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        elif path == "/api/export":
            try:
                with self.configured.state_lock:
                    exported = export_state(load_state())
                self.send_json(HTTPStatus.OK, exported, attachment="treasure-review-export.json")
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                self.send_error_text(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        else:
            self.send_error_text(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if path == "/unlock":
            try:
                values = urllib.parse.parse_qs(self.body().decode("utf-8"), strict_parsing=True)
                code = values.get("code", [""])[0]
            except (ValueError, UnicodeDecodeError):
                self.send_bytes(HTTPStatus.BAD_REQUEST, login_page("Invalid request."), "text/html; charset=utf-8")
                return
            if not hmac.compare_digest(code, self.configured.access_code):
                self.send_bytes(HTTPStatus.UNAUTHORIZED, login_page("Incorrect access code."), "text/html; charset=utf-8")
                return
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Set-Cookie", f"review_session={self.configured.session_token}; HttpOnly; Secure; SameSite=Strict; Path=/")
            self.send_header("Location", "/")
            self.end_headers()
            return
        if not self.cookie_ok():
            self.send_error_text(HTTPStatus.UNAUTHORIZED, "Authentication required")
            return
        if not self.same_origin_ok():
            self.send_error_text(HTTPStatus.FORBIDDEN, "Cross-origin request rejected")
            return
        if path != "/api/reviews":
            self.send_error_text(HTTPStatus.NOT_FOUND, "Not found")
            return
        try:
            payload = json.loads(self.body())
            key, review = validate_review(payload, self.configured.allowed)
            with self.configured.state_lock:
                state = load_state()
                state["reviews"][key] = review
                save_state(state)
            self.send_json(HTTPStatus.OK, {"saved": True, "key": key, "workspacePath": str(PROGRESS.relative_to(ROOT))})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_error_text(HTTPStatus.BAD_REQUEST, str(exc))
        except OSError as exc:
            self.send_error_text(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))


class ReviewServer(ThreadingHTTPServer):
    def __init__(self, address, access_code: str):
        super().__init__(address, ReviewHandler)
        self.access_code = access_code
        secret = secrets.token_bytes(32)
        self.session_token = hmac.new(secret, access_code.encode("utf-8"), hashlib.sha256).hexdigest()
        self.allowed = allowed_records()
        self.state_lock = threading.Lock()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    access_code = os.environ.get("REVIEW_ACCESS_CODE", "")
    if len(access_code) < 12:
        raise SystemExit("REVIEW_ACCESS_CODE must contain at least 12 characters")
    if not PORTAL.exists():
        raise SystemExit("generate START-REVIEWING.html before starting the server")
    server = ReviewServer((args.host, args.port), access_code)
    print(f"Private review portal listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
