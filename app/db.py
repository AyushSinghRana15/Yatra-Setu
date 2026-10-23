"""SQLite persistence layer (PostgreSQL in production; SQLite keeps the prototype dependency-free)."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_hash TEXT NOT NULL,
    display_phone TEXT NOT NULL,
    language TEXT NOT NULL,
    shrine TEXT NOT NULL,
    segments TEXT NOT NULL,           -- JSON list of route-segment ids
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    group_size INTEGER DEFAULT 1,
    consent INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS road_status (
    segment_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,             -- Open | Restricted | Closed
    reason TEXT,
    eta TEXT,
    updated_by TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS weather_alerts (
    district TEXT PRIMARY KEY,
    level TEXT NOT NULL,              -- None | Yellow | Orange | Red
    rain_mm REAL DEFAULT 0,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS advisories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body_en TEXT NOT NULL,
    body_hi TEXT,
    category TEXT NOT NULL,
    segments TEXT NOT NULL,           -- JSON list
    valid_until TEXT NOT NULL,
    status TEXT NOT NULL,             -- pending | published | expired
    author TEXT NOT NULL,
    approver TEXT,
    created_at TEXT NOT NULL,
    published_at TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER,
    advisory_id INTEGER,
    channel TEXT NOT NULL,            -- whatsapp | sms
    message TEXT NOT NULL,
    status TEXT NOT NULL,             -- delivered | failed | queued
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS query_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT, intent TEXT, grounded INTEGER, top_score REAL,
    sources TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT, action TEXT, object TEXT, created_at TEXT
);
"""


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with connect() as c:
        c.executescript(SCHEMA)


def rows(sql, params=()):
    with connect() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def execute(sql, params=()):
    with connect() as c:
        cur = c.execute(sql, params)
        return cur.lastrowid


def audit(actor, action, obj):
    execute("INSERT INTO audit_log(actor, action, object, created_at) VALUES (?,?,?,?)",
            (actor, action, json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj, now()))
