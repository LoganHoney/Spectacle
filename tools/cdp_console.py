"""Launches headless Edge with remote debugging, opens the app, and prints
every console message + uncaught exception via raw CDP over a hand-rolled
WebSocket client (no external deps available in this environment).
"""
import base64
import hashlib
import json
import os
import socket
import struct
import subprocess
import sys
import time
import urllib.request

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333
URL = "http://127.0.0.1:8420/index.html"
PROFILE = os.path.join(os.path.dirname(__file__), "..", ".edge-cdp-profile")


def start_edge():
    os.makedirs(PROFILE, exist_ok=True)
    args = [
        EDGE, "--headless=new", "--disable-gpu", "--no-sandbox",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={PROFILE}",
        "about:blank",
    ]
    log = open(os.path.join(os.path.dirname(__file__), "..", ".edge-launch.log"), "wb")
    return subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT)


def get_ws_url():
    last_err = None
    for _ in range(75):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as r:
                json.loads(r.read())
            req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
            with urllib.request.urlopen(req, timeout=1) as r:
                tab = json.loads(r.read())
            return tab["webSocketDebuggerUrl"]
        except Exception as e:
            last_err = e
            time.sleep(0.2)
    raise RuntimeError(f"Could not reach DevTools endpoint: {last_err!r}")


class WS:
    def __init__(self, url):
        assert url.startswith("ws://")
        rest = url[5:]
        host, path = rest.split("/", 1)
        path = "/" + path
        if ":" in host:
            host, port = host.split(":")
            port = int(port)
        else:
            port = 80
        self.sock = socket.create_connection((host, port), timeout=10)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)
        accept_expected = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
        ).decode()
        if accept_expected.encode() not in resp:
            raise RuntimeError("WebSocket handshake failed: " + resp.decode(errors="replace"))
        self.buf = b""
        self._id = 0

    def send(self, obj):
        payload = json.dumps(obj).encode()
        header = bytearray([0x81])  # FIN + text frame
        length = len(payload)
        mask = os.urandom(4)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", length)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def call(self, method, params=None):
        self._id += 1
        mid = self._id
        self.send({"id": mid, "method": method, "params": params or {}})
        return mid

    def recv_frame(self, timeout=1.0):
        self.sock.settimeout(timeout)
        try:
            while True:
                if len(self.buf) >= 2:
                    b0, b1 = self.buf[0], self.buf[1]
                    opcode = b0 & 0x0F
                    masked = b1 & 0x80
                    length = b1 & 0x7F
                    idx = 2
                    if length == 126:
                        if len(self.buf) < 4:
                            self.buf += self.sock.recv(4096)
                            continue
                        length = struct.unpack(">H", self.buf[2:4])[0]
                        idx = 4
                    elif length == 127:
                        if len(self.buf) < 10:
                            self.buf += self.sock.recv(4096)
                            continue
                        length = struct.unpack(">Q", self.buf[2:10])[0]
                        idx = 10
                    mask_key = b""
                    if masked:
                        if len(self.buf) < idx + 4:
                            self.buf += self.sock.recv(4096)
                            continue
                        mask_key = self.buf[idx:idx + 4]
                        idx += 4
                    if len(self.buf) < idx + length:
                        self.buf += self.sock.recv(65536)
                        continue
                    payload = self.buf[idx:idx + length]
                    if masked:
                        payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
                    self.buf = self.buf[idx + length:]
                    if opcode == 0x1:
                        return json.loads(payload.decode())
                    elif opcode == 0x8:
                        return None
                    else:
                        continue
                else:
                    chunk = self.sock.recv(4096)
                    if not chunk:
                        return None
                    self.buf += chunk
        except socket.timeout:
            return "TIMEOUT"


def disable_cache(ws):
    """Call right after WS(...) and before Page.navigate, in every test script.

    The persistent .edge-cdp-profile this suite reuses across runs (so cookies/
    IndexedDB persist between test scripts on purpose) also means headless
    Edge's HTTP cache persists — and it has been observed to serve a stale copy
    of a .js module across repeated Page.navigate calls to the same URL even
    with the server sending Cache-Control: no-cache. Symptom: a change you just
    made and confirmed via `curl` doesn't show up in the page, with no error —
    the page is just silently running old code. Confirmed via debugging on
    2026-08-27: identical test, identical server response, only difference was
    this call — without it, template/comment version-sync checks read stale
    data; with it, fresh. Cheap and has no downside, so just always call it.
    """
    ws.call("Network.enable")
    ws.call("Network.setCacheDisabled", {"cacheDisabled": True})


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Log.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})

        end = time.time() + 8
        events = []
        while time.time() < end:
            msg = ws.recv_frame(timeout=0.5)
            if msg is None:
                break
            if msg == "TIMEOUT":
                continue
            method = msg.get("method")
            if method in ("Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Log.entryAdded"):
                events.append(msg)

        for e in events:
            m = e["method"]
            p = e["params"]
            if m == "Runtime.consoleAPICalled":
                args = [a.get("value", a.get("description", "")) for a in p.get("args", [])]
                print(f"[console.{p['type']}] " + " ".join(str(a) for a in args))
            elif m == "Runtime.exceptionThrown":
                ex = p["exceptionDetails"]
                text = ex.get("exception", {}).get("description") or ex.get("text")
                print(f"[EXCEPTION] {text}  @ {ex.get('url')}:{ex.get('lineNumber')}:{ex.get('columnNumber')}")
            elif m == "Log.entryAdded":
                entry = p["entry"]
                print(f"[log.{entry['level']}] {entry.get('text')}  {entry.get('url','')}")

        if not events:
            print("No console/exception events captured.")

        # Ask the live page directly for its actual state (real wall-clock time,
        # no --virtual-time-budget involved, so this reflects true IndexedDB timing).
        check_id = ws.call("Runtime.evaluate", {
            "expression": (
                "JSON.stringify({"
                "bootHidden: document.getElementById('boot')?.hidden,"
                "topbarHidden: document.getElementById('topbar')?.hidden,"
                "viewHidden: document.getElementById('view')?.hidden,"
                "viewHtmlLen: document.getElementById('view')?.innerHTML.length,"
                "bootMarkup: document.getElementById('boot')?.outerHTML"
                "})"
            ),
            "returnByValue": True,
        })
        deadline = time.time() + 3
        result = None
        while time.time() < deadline:
            msg = ws.recv_frame(timeout=0.5)
            if msg == "TIMEOUT" or msg is None:
                continue
            if msg.get("id") == check_id:
                result = msg
                break
        print("---- live state check ----")
        print(json.dumps(result, indent=2) if result else "no response")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
