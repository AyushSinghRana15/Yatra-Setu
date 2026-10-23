"""Generative RAG step: LangChain + OpenRouter, with a numeric-grounding guardrail.

The chain is a small LCEL pipeline:

    ChatPromptTemplate -> ChatOpenAI(OpenRouter) -> StrOutputParser

It is only constructed when an API key is configured. Without one the application
runs fully offline and ``generate`` returns ``None``, so the assistant falls back to
its extractive answer (NFR-05 graceful degradation).

OpenRouter is OpenAI-compatible, so ``langchain-openai``'s ``ChatOpenAI`` is pointed at
https://openrouter.ai/api/v1 with the recommended attribution headers. Any OpenRouter
model can be selected with OPENROUTER_MODEL; a comma-separated fallback list is passed
through OpenRouter's ``models`` routing parameter.

Guardrail (NFR-12, NFR-19): every number in the generated answer must also appear in
the retrieved passages, otherwise the answer is rejected and the extractive response
is used instead.
"""
import re
from collections import OrderedDict

from . import config

SYSTEM_PROMPT = (
    "You are YatraSetu, a safety assistant for pilgrims in Uttarakhand. Answer ONLY from the numbered "
    "passages provided. If the passages do not contain the answer, reply exactly: NOT_FOUND. "
    "Never give medical diagnoses. Keep answers under 90 words, in the same language as the question, "
    "and end with the passage numbers you used in square brackets, e.g. [1]."
)
HUMAN_TEMPLATE = "Passages:\n{context}\n\nQuestion: {question}"

# Small in-process cache: repeated demo questions do not spend tokens.
_CACHE: "OrderedDict[tuple, str]" = OrderedDict()
_CACHE_MAX = 256
_CHAINS: dict = {}
_LAST_ERROR = ""


# ---------- provider configuration ----------
def provider_config() -> dict | None:
    """Resolve the active LLM provider, or ``None`` for offline extractive mode."""
    if config.OPENROUTER_API_KEY:
        return {
            "provider": "openrouter",
            "framework": "LangChain",
            "base_url": config.OPENROUTER_BASE_URL,
            "api_key": config.OPENROUTER_API_KEY,
            "model": config.OPENROUTER_MODEL,
            "fallbacks": config.OPENROUTER_FALLBACK_MODELS,
            "headers": {
                "HTTP-Referer": config.OPENROUTER_SITE_URL,
                "X-Title": config.OPENROUTER_APP_NAME,
            },
        }
    if config.LLM_API_URL and config.LLM_API_KEY and config.LLM_MODEL:
        base = config.LLM_API_URL.rstrip("/")
        if base.endswith("/chat/completions"):
            base = base[: -len("/chat/completions")]
        return {
            "provider": "openai-compatible",
            "framework": "LangChain",
            "base_url": base,
            "api_key": config.LLM_API_KEY,
            "model": config.LLM_MODEL,
            "fallbacks": [],
            "headers": {},
        }
    return None


def enabled() -> bool:
    return provider_config() is not None


def status() -> dict:
    """Safe-to-expose provider status for the UI and the /api/ai/status endpoint."""
    cfg = provider_config()
    if not cfg:
        return {
            "enabled": False,
            "provider": "offline",
            "framework": "LangChain (idle)",
            "model": None,
            "mode": "extractive",
            "detail": "Set OPENROUTER_API_KEY to enable generative answers; retrieval and safety rules still run.",
        }
    return {
        "enabled": True,
        "provider": cfg["provider"],
        "framework": cfg["framework"],
        "model": cfg["model"],
        "mode": "llm-rag",
        "detail": f"Grounded generation via {cfg['provider']} through LangChain LCEL.",
    }


# ---------- guardrails ----------
def redact(text: str) -> str:
    """Remove phone numbers and e-mail addresses before text leaves the system (NFR-16)."""
    text = re.sub(r"\b\d{10,12}\b", "[PHONE]", text)
    return re.sub(r"\S+@\S+", "[EMAIL]", text)


def numbers_grounded(answer: str, passages: list[str]) -> bool:
    nums = set(re.findall(r"\d[\d,\.]*", answer)) - {str(i) for i in range(1, 10)}
    joined = " ".join(passages)
    return all(n.rstrip(".,") in joined for n in nums)


def build_context(passages: list[str]) -> str:
    return "\n".join(f"[{i + 1}] {p}" for i, p in enumerate(passages))


# ---------- LangChain LCEL chain ----------
def _chain_for(cfg: dict):
    """Build (and memoise) the prompt | model | parser chain for this provider config."""
    key = (cfg["provider"], cfg["base_url"], cfg["model"])
    if key in _CHAINS:
        return _CHAINS[key]

    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_TEMPLATE),
    ])
    kwargs = {
        "model": cfg["model"],
        "api_key": cfg["api_key"],
        "base_url": cfg["base_url"],
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": config.LLM_MAX_TOKENS,
        "timeout": config.LLM_TIMEOUT,
        "max_retries": 1,
        "default_headers": cfg.get("headers") or None,
    }
    if cfg.get("fallbacks"):
        kwargs["extra_body"] = {"models": [cfg["model"], *cfg["fallbacks"]]}
    model = ChatOpenAI(**kwargs)
    chain = prompt | model | StrOutputParser()
    _CHAINS[key] = chain
    return chain


# ---------- public API used by the assistant ----------
def generate(question: str, passages: list[str]):
    """Return a grounded generated answer, or None to fall back to extractive mode."""
    global _LAST_ERROR
    if not passages:
        return None
    cfg = provider_config()
    if not cfg:
        return None

    cache_key = (question.strip().lower(), tuple(passages))
    if cache_key in _CACHE:
        _CACHE.move_to_end(cache_key)
        return _CACHE[cache_key]

    try:
        chain = _chain_for(cfg)
        answer = chain.invoke({
            "context": build_context(passages),
            "question": redact(question),
        }).strip()
    except Exception as exc:                      # network, auth, quota, model errors -> degrade
        _LAST_ERROR = f"{type(exc).__name__}: {exc}"[:240]
        return None

    _LAST_ERROR = ""
    if not answer or "NOT_FOUND" in answer.upper() or not numbers_grounded(answer, passages):
        return None                               # guardrail: never show unverified numbers

    _CACHE[cache_key] = answer
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return answer


def reset_cache() -> None:
    """Clear the answer cache and memoised chains (used by tests / after env changes)."""
    _CACHE.clear()
    _CHAINS.clear()
