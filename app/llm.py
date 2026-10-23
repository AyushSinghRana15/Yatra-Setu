"""Optional generative step for RAG, with a grounding guardrail (NFR-12, NFR-19).

If LLM_API_URL / LLM_API_KEY / LLM_MODEL are configured, retrieved passages are sent to an
OpenAI-compatible chat-completions endpoint with strict instructions to answer only from
them. The reply is then checked: every number in the answer must appear in the passages,
otherwise the system falls back to the extractive answer.
"""
import re

from .config import LLM_API_KEY, LLM_API_URL, LLM_MODEL

SYSTEM_PROMPT = (
    "You are YatraSetu, a safety assistant for pilgrims in Uttarakhand. Answer ONLY from the numbered "
    "passages provided. If the passages do not contain the answer, reply exactly: NOT_FOUND. "
    "Never give medical diagnoses. Keep answers under 90 words, in the same language as the question, "
    "and end with the passage numbers you used in square brackets, e.g. [1]."
)


def enabled() -> bool:
    return bool(LLM_API_URL and LLM_API_KEY and LLM_MODEL)


def redact(text: str) -> str:
    """Remove phone numbers and e-mail addresses before text leaves the system (NFR-16)."""
    text = re.sub(r"\b\d{10,12}\b", "[PHONE]", text)
    return re.sub(r"\S+@\S+", "[EMAIL]", text)


def numbers_grounded(answer: str, passages: list[str]) -> bool:
    nums = set(re.findall(r"\d[\d,\.]*", answer)) - {str(i) for i in range(1, 10)}
    joined = " ".join(passages)
    return all(n.rstrip(".,") in joined for n in nums)


def generate(question: str, passages: list[str]):
    if not enabled():
        return None
    import requests
    ctx = "\n".join(f"[{i + 1}] {p}" for i, p in enumerate(passages))
    body = {"model": LLM_MODEL, "temperature": 0.1, "max_tokens": 300,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                         {"role": "user", "content": f"Passages:\n{ctx}\n\nQuestion: {redact(question)}"}]}
    try:
        r = requests.post(LLM_API_URL, json=body, timeout=20, headers={"Authorization": f"Bearer {LLM_API_KEY}"})
        r.raise_for_status()
        ans = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None                       # NFR-05 graceful degradation
    if "NOT_FOUND" in ans or not numbers_grounded(ans, passages):
        return None
    return ans
