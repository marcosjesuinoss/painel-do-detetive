# Servidor de desenvolvimento para Live Reload.
# Igual ao `python -m http.server`, mas envia cabecalhos "no-cache" em TODA
# resposta - assim o WebView do Capacitor sempre rebaixa os arquivos frescos,
# e suas mudancas de CSS/JS aparecem ao reabrir o app (sem precisar gerar APK
# nem limpar cache na mao).
#
# Uso:  python scripts/devserver.py   (a partir da pasta do projeto)

import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True


with ReusableServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    print(f"Dev server (no-cache) rodando em http://0.0.0.0:{PORT}")
    httpd.serve_forever()
