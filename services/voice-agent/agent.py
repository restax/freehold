"""
Freehold voice search — a LiveKit agent that answers questions about a
workspace's own data, out loud.

Pipeline: Silero VAD → Deepgram STT → Claude → ElevenLabs TTS.

The agent holds no database credentials and decides nothing about what it may
read. When a session opens, the web app puts a short-lived HMAC-signed
*capability grant* in the room metadata describing exactly this conversation's
scope (a workspace, a guest's assigned files, or one portal link). The agent
relays that grant back to the app on every lookup; the app re-verifies the
signature and serves only what the grant allows. A compromised agent can
therefore read nothing it wasn't already handed.

Run it:  ./.venv/bin/python agent.py dev
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import function_tool
from livekit.plugins import anthropic, deepgram, elevenlabs, silero

# Local dev reads the repo-root .env so there's no second copy of the keys to
# drift. Deployed, there is no such file — LiveKit Cloud injects the secrets as
# real environment variables — so this is best-effort and must not assume any
# particular depth above this file.
for _parent in Path(__file__).resolve().parents:
    _candidate = _parent / ".env"
    if _candidate.is_file():
        load_dotenv(_candidate)
        break

logger = logging.getLogger("freehold-voice")

APP_URL = os.environ.get("FREEHOLD_APP_URL", "http://localhost:3010").rstrip("/")
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "YY7fzZmDizFQQv8XPAIY")
LLM_MODEL = os.environ.get("FREEHOLD_VOICE_MODEL", "claude-sonnet-4-6")

class FreeholdAssistant(Agent):
    def __init__(self, grant: str, allowed: set[str], instructions: str) -> None:
        self._grant = grant
        # The app told us which tools this grant may use; anything else is
        # dropped rather than offered to the model. The marketing scope gets
        # none at all — it answers about Freehold, not about anyone's data.
        tools = [t for t in ALL_TOOLS if t.info.name in allowed]
        super().__init__(instructions=instructions, tools=tools)
        logger.info("assistant ready with tools: %s", sorted(t.info.name for t in tools))

    async def lookup(self, tool: str, **params: object) -> str:
        """Run one tool against the app under this session's grant."""
        payload = {"tool": tool, "input": {k: v for k, v in params.items() if v is not None}}
        try:
            async with aiohttp.ClientSession() as http:
                async with http.post(
                    f"{APP_URL}/api/voice/data",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._grant}"},
                    timeout=aiohttp.ClientTimeout(total=20),
                ) as res:
                    if res.status == 401:
                        return "This session has expired. Please start a new one."
                    if res.status != 200:
                        logger.warning("lookup %s failed: HTTP %s", tool, res.status)
                        return "That lookup failed."
                    body = await res.json()
                    return json.dumps(body.get("result"))
        except Exception:
            logger.exception("lookup %s errored", tool)
            return "That lookup failed."


# --- Tools -----------------------------------------------------------------
# Declared statically so their schemas are typed and reviewable. Which ones an
# actual session gets is decided by the server, not here.


@function_tool
async def workspace_summary(ctx: RunContext) -> str:
    """Counts across the workspace: active and closed transactions, clients,
    contacts, and open tasks. Use for "how many" or "how's business"."""
    return await ctx.session.current_agent.lookup("workspace_summary")


@function_tool
async def search_transactions(
    ctx: RunContext, query: str | None = None, status: str | None = None
) -> str:
    """Find transactions by property address or client name.

    Args:
        query: Address or client name; partial matches are fine. Omit to list recent ones.
        status: Optional filter — LISTING, UNDER_CONTRACT, PENDING, CLOSED, CANCELLED.
    """
    return await ctx.session.current_agent.lookup(
        "search_transactions", query=query, status=status
    )


@function_tool
async def upcoming_deadlines(ctx: RunContext, days: int = 7) -> str:
    """Open tasks and closings coming up. Use for "what's due", "what's
    closing", "what's coming up this week".

    Args:
        days: How many days ahead to look. Defaults to 7.
    """
    return await ctx.session.current_agent.lookup("upcoming_deadlines", days=days)


@function_tool
async def find_people(ctx: RunContext, query: str) -> str:
    """Search contacts and clients by name, email, or phone — "what's Jordan's
    number", "who's the lender".

    Args:
        query: Name, email, or phone fragment.
    """
    return await ctx.session.current_agent.lookup("find_people", query=query)


@function_tool
async def my_files(ctx: RunContext) -> str:
    """The transaction(s) this person can see, with status and key dates. Use
    for "where are we", "what's the status", "when do we close"."""
    return await ctx.session.current_agent.lookup("my_files")


@function_tool
async def my_dates(ctx: RunContext) -> str:
    """Upcoming milestones and deadlines visible to this person."""
    return await ctx.session.current_agent.lookup("my_dates")


@function_tool
async def my_documents(ctx: RunContext) -> str:
    """Names of documents shared with this person."""
    return await ctx.session.current_agent.lookup("my_documents")


ALL_TOOLS = [
    workspace_summary,
    search_transactions,
    upcoming_deadlines,
    find_people,
    my_files,
    my_dates,
    my_documents,
]


async def fetch_brief(grant: str) -> dict | None:
    """Ask the app what this grant may do: its tools, its persona, and its
    opening line. None on failure — we would rather not serve at all than
    guess at a scope."""
    try:
        async with aiohttp.ClientSession() as http:
            async with http.get(
                f"{APP_URL}/api/voice/data",
                headers={"Authorization": f"Bearer {grant}"},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as res:
                if res.status != 200:
                    logger.error("brief rejected: HTTP %s", res.status)
                    return None
                body = await res.json()
                return {
                    "tools": {t["name"] for t in body.get("tools", [])},
                    "instructions": body.get("instructions") or "",
                    "greeting": body.get("greeting") or "",
                }
    except Exception:
        logger.exception("could not fetch brief")
        return None


def prewarm(proc: JobProcess) -> None:
    """Load the VAD once when the worker boots, not on every call. Loading a
    model on the hot path is dead time the caller hears as extra silence before
    the greeting; doing it here means a warm worker starts talking sooner."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    # Timing marks (t0 = the moment the agent picks up the job). These print to
    # the worker logs so it's clear which step owns the wait — dispatch, the
    # brief round-trip to the app, or the first reply. See README → Latency.
    t0 = time.monotonic()

    def elapsed() -> str:
        return f"{time.monotonic() - t0:.2f}s"

    await ctx.connect()
    logger.info("connected to room at %s", elapsed())

    raw = ctx.room.metadata or "{}"
    try:
        grant = json.loads(raw).get("grant")
    except json.JSONDecodeError:
        grant = None

    if not grant:
        logger.error("room %s carries no grant — refusing to serve", ctx.room.name)
        return

    brief = await fetch_brief(grant)
    # A brief with no instructions means the app didn't vouch for this grant.
    # An empty tool list is legitimate (the marketing scope has none), so it is
    # the instructions — not the tools — that gate whether we serve.
    if not brief or not brief["instructions"]:
        logger.error("grant not honoured by the app — refusing to serve")
        return
    logger.info(
        "grant accepted for room %s at %s; tools: %s",
        ctx.room.name,
        elapsed(),
        sorted(brief["tools"]) or "none",
    )

    session = AgentSession(
        # Reuse the VAD loaded in prewarm() rather than loading it per session.
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(model="nova-3", smart_format=True),
        llm=anthropic.LLM(model=LLM_MODEL),
        # Passed explicitly: the plugin looks for ELEVEN_API_KEY, but the repo
        # names it ELEVENLABS_API_KEY like every other vendor key.
        #
        # chunk_length_schedule disables the plugin's default auto_mode, which
        # flushes to ElevenLabs once per sentence — each flush starts a new
        # streaming "generation," and the seam between generations is audible
        # as a small stutter on any reply longer than one sentence. Buffering
        # by character count instead (ElevenLabs' own recommended schedule)
        # sends one continuous stream for a short reply and only a couple of
        # smooth flushes for a longer one — first-word latency is essentially
        # unchanged since the first chunk is still just ~120 characters.
        tts=elevenlabs.TTS(
            voice_id=VOICE_ID,
            model="eleven_turbo_v2_5",
            api_key=os.environ["ELEVENLABS_API_KEY"],
            chunk_length_schedule=[120, 160, 250, 290],
        ),
        # Voice answers should resolve fast; a long tool chain means a long
        # silence, and every step costs money.
        max_tool_steps=3,
    )

    await session.start(
        room=ctx.room,
        agent=FreeholdAssistant(grant, brief["tools"], brief["instructions"]),
    )
    logger.info("session live at %s", elapsed())
    await session.generate_reply(instructions=brief["greeting"])
    logger.info("greeting dispatched at %s", elapsed())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
