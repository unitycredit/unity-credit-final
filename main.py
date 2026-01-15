from __future__ import annotations

import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
LOGIN_HTML = ROOT / "templates" / "login.html"


class AppHandler(BaseHTTPRequestHandler):
    server_version = "UnityCreditPython/1.0"

    def _send_html(self, html: str, *, status: int = HTTPStatus.OK) -> None:
        data = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/":
            return self._redirect("/login")

        if path == "/login":
            if not LOGIN_HTML.exists():
                return self._send_html(
                    "<h1>Missing templates/login.html</h1>", status=HTTPStatus.INTERNAL_SERVER_ERROR
                )
            return self._send_html(LOGIN_HTML.read_text(encoding="utf-8"))

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/login":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        form = parse_qs(body)
        username = (form.get("username", [""])[0] or "").strip()

        # Visual-only demo: show a friendly confirmation page.
        # Hook your real auth here (NextAuth / Supabase / RDS, etc.).
        safe_user = (
            username.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
        )
        return self._send_html(
            f"""
            <!doctype html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Login received</title></head>
            <body style="font-family:system-ui,Segoe UI,Roboto,Arial; padding:24px;">
              <h2>Login received</h2>
              <p>Username: <strong>{safe_user or "(empty)"}</strong></p>
              <p>This is the visual login page only. Next step is wiring server-side authentication.</p>
              <p><a href="/login">Back to login</a></p>
            </body></html>
            """.strip()
        )

    def log_message(self, fmt: str, *args) -> None:
        # Keep console output minimal.
        return


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")

    httpd = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Serving login page on http://{host}:{port}/login")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

