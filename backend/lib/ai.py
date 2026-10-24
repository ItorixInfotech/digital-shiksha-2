"""Claude (Anthropic, owner's own ANTHROPIC_API_KEY) via emergentintegrations LlmChat. Model: Claude Sonnet 5.5."""
import json
import logging
import os
import re
import uuid
from typing import AsyncIterator

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

logger = logging.getLogger(__name__)
MODEL = ("anthropic", "claude-sonnet-5-5")


class AIError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _chat(system: str, history: list[dict] | None = None, max_tokens: int = 1500) -> LlmChat:
    if not configured():
        raise AIError(503, "AI is not set up yet — add the Anthropic API key")
    return (LlmChat(api_key=os.environ["ANTHROPIC_API_KEY"], session_id=str(uuid.uuid4()), system_message=system,
                    initial_messages=history or None)
            .with_model(*MODEL).with_params(max_tokens=max_tokens))


def _friendly(exc: Exception) -> AIError:
    msg = str(exc)
    logger.error("Claude call failed: %s", msg[:300])
    if "authentication" in msg or "x-api-key" in msg or "401" in msg:
        return AIError(502, "The Anthropic API key was rejected — please update it")
    if "429" in msg or "rate" in msg.lower():
        return AIError(429, "AI is busy right now — please try again in a minute")
    if "529" in msg or "overloaded" in msg.lower():
        return AIError(503, "AI is overloaded right now — please try again shortly")
    return AIError(502, "AI could not answer right now — please try again")


async def complete_json(system: str, prompt: str, max_tokens: int = 2000) -> dict:
    """Single-shot structured output (admin tools): asks for one JSON object and parses it."""
    chat = _chat(system + "\nReply with ONE valid JSON object only — no markdown, no commentary.", max_tokens=max_tokens)
    try:
        text = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise _friendly(exc) from exc
    m = re.search(r"\{.*\}", text or "", re.S)
    try:
        return json.loads(m.group(0) if m else text)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.error("Claude returned non-JSON: %s", (text or "")[:200])
        raise AIError(502, "AI returned an unexpected answer — please try again") from exc


async def complete_text(system: str, prompt: str, max_tokens: int = 600) -> str:
    try:
        return (await _chat(system, max_tokens=max_tokens).send_message(UserMessage(text=prompt)) or "").strip()
    except AIError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _friendly(exc) from exc


async def stream_reply(system: str, history: list[dict], message: str) -> AsyncIterator[str]:
    """Student chat: yields text deltas as they arrive."""
    chat = _chat(system, history, max_tokens=900)
    try:
        async for ev in chat.stream_message(UserMessage(text=message)):
            if isinstance(ev, TextDelta) and ev.content:
                yield ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as exc:  # noqa: BLE001
        raise _friendly(exc) from exc
