"""Minimal stand-in for the Upstash Redis REST API, for local testing only.
Implements just what backend/app.py uses: SET key value EX seconds / GET key / DEL key.
"""
import http.server
import json
import threading
import time

STORE = {}
LOCK = threading.Lock()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length) or b'[]')
        cmd = body[0].upper()
        result = None
        with LOCK:
            if cmd == 'SET':
                key, value = body[1], body[2]
                ex = None
                if len(body) >= 5 and body[3].upper() == 'EX':
                    ex = time.time() + float(body[4])
                STORE[key] = (value, ex)
                result = 'OK'
            elif cmd == 'GET':
                key = body[1]
                entry = STORE.get(key)
                if entry and (entry[1] is None or entry[1] > time.time()):
                    result = entry[0]
                else:
                    STORE.pop(key, None)
                    result = None
            elif cmd == 'DEL':
                key = body[1]
                result = 1 if STORE.pop(key, None) else 0
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'result': result}).encode())


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8987
    print(f'Fake Upstash on :{port}')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
