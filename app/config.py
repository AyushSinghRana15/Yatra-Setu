"""Central configuration. Values can be overridden with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("YATRASETU_DB", BASE_DIR.parent / "yatrasetu.db"))

# Retrieval: minimum similarity for an answer to be considered grounded (FR-04)
RETRIEVAL_THRESHOLD = float(os.getenv("YATRASETU_RETRIEVAL_THRESHOLD", "0.12"))
CONTENT_THRESHOLD = float(os.getenv("YATRASETU_CONTENT_THRESHOLD", "0.05"))
TOP_K = 3

# Optional LLM (any OpenAI-compatible chat-completions endpoint). If unset, the
# assistant composes extractive answers from retrieved passages (offline mode).
LLM_API_URL = os.getenv("LLM_API_URL", "")          # e.g. https://api.example.com/v1/chat/completions
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")

# Optional Bhashini pipeline credentials (translation / ASR / TTS for more languages)
BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "")
BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "")

# Demo admin credentials for the officials' dashboard (change in production!)
ADMIN_USERS = {
    "editor": {"password": os.getenv("EDITOR_PASSWORD", "editor123"), "role": "editor"},
    "approver": {"password": os.getenv("APPROVER_PASSWORD", "approver123"), "role": "approver"},
}

# Crowd bands relative to carrying capacity (FR-10)
CROWD_BANDS = [(0.60, "Low"), (0.85, "Moderate"), (1.00, "High"), (float("inf"), "Over capacity")]
