"""
web/server.py — 本地服务：托管播放器页面与资源

用法：
    python web/server.py                # 起服务并自动打开浏览器
    python web/server.py --port 8899 --no-open

只用 Python 标准库，无需安装任何依赖。
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))          # web/
PROJ = os.path.dirname(ROOT)                               # 包根

mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/json", ".json")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        pass                                                # 静音访问日志

    def _send(self, code, body: bytes, ctype="application/octet-stream", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _safe_path(self, rel: str):
        """把 URL 路径映射到磁盘路径，禁止越出包根。"""
        rel = rel.split("?", 1)[0].lstrip("/")
        if not rel:
            rel = "index.html"
        # 允许两种前缀：/  -> web/ ；  /pkg/ -> 包根
        if rel.startswith("pkg/"):
            base, rel = PROJ, rel[4:]
        else:
            base = ROOT
        p = os.path.normpath(os.path.join(base, rel))
        if not p.startswith(os.path.normpath(base)):
            return None
        return p

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/ping":
            body = b'{"ok": true}'
            return self._send(200, body, "application/json; charset=utf-8")

        p = self._safe_path(self.path)
        if not p or not os.path.isfile(p):
            return self._send(404, b"not found", "text/plain; charset=utf-8")

        ctype = mimetypes.guess_type(p)[0] or "application/octet-stream"
        with open(p, "rb") as f:
            data = f.read()

        # 音轨支持 Range 请求（浏览器据此实现 seek）
        rng = self.headers.get("Range")
        if rng and ctype.startswith("audio/"):
            try:
                a, _, b = rng.replace("bytes=", "").partition("-")
                start = int(a) if a else 0
                end = int(b) if b else len(data) - 1
                end = min(end, len(data) - 1)
                chunk = data[start:end + 1]
                return self._send(206, chunk, ctype, {
                    "Content-Range": f"bytes {start}-{end}/{len(data)}",
                    "Accept-Ranges": "bytes",
                })
            except Exception:
                pass
        self._send(200, data, ctype, {"Accept-Ranges": "bytes"})

    def do_HEAD(self):
        self.do_GET()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()

    url = f"http://127.0.0.1:{args.port}/index.html"
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("=" * 58)
    print("  world.execute(me);")
    print(f"  地址: {url}")
    print("  按 Ctrl+C 停止")
    print("=" * 58)
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
