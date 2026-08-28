"""Local static file server for development/testing on this PC.

Serves the app at http://127.0.0.1:8420 — a secure context, so the service
worker and IndexedDB behave exactly as they will in production. This is for
testing in a desktop browser only: an iPhone/iPad on your Wi-Fi cannot reach
"127.0.0.1" on your PC, and cannot install a PWA over plain HTTP. To test or
use the app on a phone/tablet, deploy the folder to any free HTTPS static
host (GitHub Pages, Netlify, Cloudflare Pages) and open that URL in Safari.
See README.md for the three-minute deploy steps.
"""
import http.server
import socket
import socketserver
import webbrowser
import os

PORT = 8420
ROOT = os.path.dirname(os.path.abspath(__file__))


def lan_ip():
    """Best-effort local network IP, so a phone on the same Wi-Fi can reach this."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))  # no packet actually sent — just picks the outbound interface
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()

EXTRA_TYPES = {
    '.webmanifest': 'application/manifest+json',
    '.js': 'text/javascript',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        for ext, mime in EXTRA_TYPES.items():
            if path.endswith(ext):
                return mime
        return super().guess_type(path)

    def end_headers(self):
        # Nothing gets served stale during development — a browser (or a CDP test
        # harness reusing a persistent profile) will otherwise cache .js modules
        # heuristically across reloads and silently run old code after an edit.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    with ThreadingHTTPServer(('0.0.0.0', PORT), Handler) as httpd:
        local_url = f'http://127.0.0.1:{PORT}/index.html'
        print(f'On this PC:        {local_url}')
        ip = lan_ip()
        if ip:
            print(f'On your phone:     http://{ip}:{PORT}/index.html  (same Wi-Fi only — plain HTTP, no install/offline yet)')
        else:
            print('Could not detect a LAN IP — check you are connected to Wi-Fi/Ethernet.')
        print('Press Ctrl+C to stop.')
        try:
            webbrowser.open(local_url)
        except Exception:
            pass
        httpd.serve_forever()


if __name__ == '__main__':
    main()
