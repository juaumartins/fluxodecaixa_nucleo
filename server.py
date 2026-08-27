#!/usr/bin/env python3
"""
Servidor Local - Fluxo de Caixa Núcleo Jardim Florido
Executa um servidor HTTP local simples e abre o navegador automaticamente.
"""

import http.server
import socketserver
import webbrowser
import os
import json
import sqlite3
import secrets
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")
COOKIE_SECURE = "; Secure" if os.environ.get("HTTPS_ENABLED", "0") == "1" else ""
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(DIRECTORY, "fluxo_caixa.sqlite3")


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return base64.b64encode(salt).decode(), base64.b64encode(digest).decode()


def verify_password(password, salt, expected):
    _, digest = hash_password(password, base64.b64decode(salt))
    return secrets.compare_digest(digest, expected)


def init_database():
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'manager',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        if "role" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'manager'")
        if "created_at" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN created_at TEXT")
            connection.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS shared_data (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        existing_data = connection.execute("SELECT data FROM user_data ORDER BY user_id LIMIT 1").fetchone()
        shared_data = connection.execute("SELECT id FROM shared_data WHERE id = 1").fetchone()
        if existing_data and not shared_data:
            connection.execute("INSERT INTO shared_data (id, data) VALUES (1, ?)", (existing_data[0],))
        connection.execute("""
            CREATE TABLE IF NOT EXISTS user_data (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        user = connection.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
        if not user:
            salt, digest = hash_password(os.environ.get("NJF_ADMIN_PASSWORD", "admin123"))
            connection.execute(
                "INSERT INTO users (username, password_salt, password_hash) VALUES (?, ?, ?)",
                ("admin", salt, digest)
            )
        connection.execute("UPDATE users SET role = 'admin' WHERE username = 'admin'")


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.now(timezone.utc).isoformat(),))
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash(token), user_id, expires_at.isoformat())
        )
    return token


def get_shared_data():
    with sqlite3.connect(DATABASE) as connection:
        row = connection.execute("SELECT data FROM shared_data WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else None


def save_shared_data(data):
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("""
            INSERT INTO shared_data (id, data) VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        """, (json.dumps(data, ensure_ascii=False),))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def current_user(self):
        cookie = self.headers.get("Cookie", "")
        token = next((item.split("=", 1)[1] for item in cookie.split("; ") if item.startswith("session=")), None)
        if not token:
            return None
        with sqlite3.connect(DATABASE) as connection:
            row = connection.execute("""
                SELECT users.id, users.username, users.role
                FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """, (token_hash(token), datetime.now(timezone.utc).isoformat())).fetchone()
        return {"id": row[0], "username": row[1], "role": row[2]} if row else None

    def require_admin(self):
        user = self.current_user()
        if not user or user["role"] != "admin":
            self.send_json({"error": "Acesso de administrador necessário."}, 403 if user else 401)
            return None
        return user

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/fluxo-caixa-njf-completo.html":
            self.send_response(302)
            self.send_header("Location", "/")
            self.end_headers()
            return
        if path == "/api/session":
            user = self.current_user()
            self.send_json({"authenticated": bool(user), "username": user["username"] if user else None, "role": user["role"] if user else None})
            return
        if path == "/api/data":
            user = self.current_user()
            if not user:
                self.send_json({"error": "Não autenticado"}, 401)
                return
            self.send_json({"data": get_shared_data()})
            return
        if path == "/api/users":
            if not self.require_admin():
                return
            with sqlite3.connect(DATABASE) as connection:
                users = connection.execute("SELECT id, username, role, created_at FROM users ORDER BY username").fetchall()
            self.send_json({"users": [dict(zip(("id", "username", "role", "createdAt"), row)) for row in users]})
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            try:
                payload = self.read_json()
                username = str(payload.get("username", "")).strip()
                password = str(payload.get("password", ""))
                with sqlite3.connect(DATABASE) as connection:
                    user = connection.execute(
                        "SELECT id, username, password_salt, password_hash, role FROM users WHERE username = ?",
                        (username,)
                    ).fetchone()
                if not user or not verify_password(password, user[2], user[3]):
                    self.send_json({"error": "Usuário ou senha inválidos."}, 401)
                    return
                token = create_session(user[0])
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Set-Cookie", f"session={token}; HttpOnly; SameSite=Strict; Path=/{COOKIE_SECURE}")
                self.end_headers()
                self.wfile.write(json.dumps({"username": user[1], "role": user[4]}).encode("utf-8"))
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "Requisição inválida."}, 400)
            return
        if path == "/api/logout":
            cookie = self.headers.get("Cookie", "")
            token = next((item.split("=", 1)[1] for item in cookie.split("; ") if item.startswith("session=")), None)
            if token:
                with sqlite3.connect(DATABASE) as connection:
                    connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
            self.send_response(204)
            self.send_header("Set-Cookie", f"session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/{COOKIE_SECURE}")
            self.end_headers()
            return
        if path == "/api/data":
            user = self.current_user()
            if not user:
                self.send_json({"error": "Não autenticado"}, 401)
                return
            try:
                save_shared_data(self.read_json())
                self.send_json({"saved": True})
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "Dados inválidos."}, 400)
            return
        if path == "/api/password":
            user = self.current_user()
            if not user:
                self.send_json({"error": "Não autenticado."}, 401)
                return
            try:
                payload = self.read_json()
                current = str(payload.get("currentPassword", ""))
                new_password = str(payload.get("newPassword", ""))
                if len(new_password) < 8:
                    self.send_json({"error": "A nova senha deve ter pelo menos 8 caracteres."}, 400)
                    return
                with sqlite3.connect(DATABASE) as connection:
                    row = connection.execute("SELECT password_salt, password_hash FROM users WHERE id = ?", (user["id"],)).fetchone()
                    if not row or not verify_password(current, row[0], row[1]):
                        self.send_json({"error": "Senha atual inválida."}, 401)
                        return
                    salt, digest = hash_password(new_password)
                    connection.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt, digest, user["id"]))
                self.send_json({"changed": True})
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "Requisição inválida."}, 400)
            return
        if path == "/api/users":
            if not self.require_admin():
                return
            try:
                payload = self.read_json()
                username = str(payload.get("username", "")).strip()
                password = str(payload.get("password", ""))
                role = str(payload.get("role", "manager"))
                if len(username) < 3 or len(password) < 8 or role not in ("admin", "manager"):
                    self.send_json({"error": "Usuário, senha ou papel inválido."}, 400)
                    return
                salt, digest = hash_password(password)
                with sqlite3.connect(DATABASE) as connection:
                    cursor = connection.execute(
                        "INSERT INTO users (username, password_salt, password_hash, role) VALUES (?, ?, ?, ?)",
                        (username, salt, digest, role)
                    )
                self.send_json({"id": cursor.lastrowid, "username": username, "role": role}, 201)
            except sqlite3.IntegrityError:
                self.send_json({"error": "Esse usuário já existe."}, 409)
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "Requisição inválida."}, 400)
            return
        self.send_json({"error": "Rota não encontrada."}, 404)

def main():
    init_database()
    os.chdir(DIRECTORY)
    with socketserver.ThreadingTCPServer((HOST, PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("🌿 FLUXO DE CAIXA - NÚCLEO JARDIM FLORIDO")
        print(f"Servidor iniciado em: {url}")
        print("Pressione CTRL + C para encerrar.")
        print("=" * 60)
        
        if os.environ.get("OPEN_BROWSER", "1") == "1":
            try:
                webbrowser.open(url)
            except Exception:
                pass
            
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado com sucesso.")

if __name__ == "__main__":
    main()
