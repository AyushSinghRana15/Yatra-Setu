"""Central configuration. Values can be overridden with environment variables or a .env file."""
import hashlib
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# Load a project-root .env if present (never commit secrets). Do this before reading env vars.
load_dotenv(BASE_DIR.parent / ".env")

DB_PATH = Path(os.getenv("YATRASETU_DB", BASE_DIR.parent / "yatrasetu.db"))

# Retrieval: minimum similarity for an answer to be considered grounded (FR-04)
RETRIEVAL_THRESHOLD = float(os.getenv("YATRASETU_RETRIEVAL_THRESHOLD", "0.12"))
CONTENT_THRESHOLD = float(os.getenv("YATRASETU_CONTENT_THRESHOLD", "0.05"))
TOP_K = 3

# --- AI provider: OpenRouter via LangChain (optional; offline extractive mode is the default) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "recursive/flint-v1.0:free")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://127.0.0.1:8000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "YatraSetu AI")
OPENROUTER_FALLBACK_MODELS = [
    m.strip() for m in os.getenv("OPENROUTER_FALLBACK_MODELS", "").split(",") if m.strip()
]
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "600"))
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "25"))

# Legacy/self-hosted OpenAI-compatible endpoint (used only when OPENROUTER_API_KEY is unset)
LLM_API_URL = os.getenv("LLM_API_URL", "")          # e.g. https://api.example.com/v1
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")

# Optional Bhashini pipeline credentials (translation / ASR / TTS for more languages)
BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "")
BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "")

# Officials' dashboard accounts. The defaults are for the demo only: set EDITOR_PASSWORD and APPROVER_PASSWORD
# in production. Passwords are never kept in memory as text; only a salted scrypt hash is.
_DEFAULTS = {"editor": "editor123", "approver": "approver123"}
_SALT = secrets.token_bytes(16)


def hash_password(password: str) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=_SALT, n=2 ** 14, r=8, p=1)


ADMIN_USERS = {name: {"hash": hash_password(os.getenv(f"{name.upper()}_PASSWORD", default)), "role": name}
               for name, default in _DEFAULTS.items()}
USING_DEFAULT_PASSWORDS = any(os.getenv(f"{n.upper()}_PASSWORD", d) == d for n, d in _DEFAULTS.items())
SESSION_HOURS = float(os.getenv("SESSION_HOURS", "8"))                       # dashboard logins expire
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "yatrasetu-verify")  # set your own for a real webhook
LIVE_WEATHER = os.getenv("LIVE_WEATHER", "1") != "0"                         # allow fetching rain forecasts (Open-Meteo)

# Crowd bands relative to carrying capacity (FR-10)
CROWD_BANDS = [(0.60, "Low"), (0.85, "Moderate"), (1.00, "High"), (float("inf"), "Over capacity")]
