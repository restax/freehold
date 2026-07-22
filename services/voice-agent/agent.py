"""
Freehold voice search — a LiveKit agent that answers questions about a
workspace's own data, out loud.

Pipeline: Silero VAD → STT → Claude → TTS. STT runs through LiveKit's own
hosted inference (livekit.agents.inference) — billed per-minute through
LiveKit, no Deepgram key needed — and which model it uses is
admin-configurable at /admin/settings, read fresh from fetch_brief() below on
every session so a change there takes effect on the very next call with no
redeploy. TTS stays a DIRECT ElevenLabs call: LiveKit's inference proxy only
has ElevenLabs' shared voice library, not our private/custom voice (confirmed
live — it 400s "voice does not exist" for a custom voice ID). The LLM stays a
direct Anthropic call too: Claude isn't in LiveKit's inference catalog.

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

import asyncio
import json
import logging
import os
import time
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from google.protobuf.duration_pb2 import Duration
from livekit import api
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    RunContext,
    WorkerOptions,
    cli,
    get_job_context,
    inference,
)
from livekit.agents.llm import StopResponse, function_tool
from livekit.plugins import anthropic, elevenlabs, silero

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

# Holds references to fire-and-forget tasks so the event loop doesn't GC them
# mid-flight (the standard asyncio.create_task footgun).
_BACKGROUND_TASKS: set[asyncio.Task] = set()

APP_URL = os.environ.get("FREEHOLD_APP_URL", "http://localhost:3010").rstrip("/")
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "YY7fzZmDizFQQv8XPAIY")
LLM_MODEL = os.environ.get("FREEHOLD_VOICE_MODEL", "claude-sonnet-4-6")

# The homepage demo's "call the developer" feature. Both unset means the tool
# is simply never usable — nothing in this file assumes they're present.
#
# A bare SIP username (e.g. "paulslazas"), NOT a full "sip:user@host" URI and
# NOT a phone number: LiveKit's own hosted numbers turned out to be
# inbound-only, so this dials a SIP account instead of going through the PSTN
# — no carrier, no E911/compliance step, no per-minute billing. The host lives
# on the outbound trunk's --address (FOUNDER_SIP_TRUNK_ID), not here — the API
# rejects a full URI in sip_call_to with "should be a phone number or SIP
# user, not a full SIP URI".
FOUNDER_CALL_DESTINATION = os.environ.get("FOUNDER_CALL_DESTINATION")
FOUNDER_SIP_TRUNK_ID = os.environ.get("FOUNDER_SIP_TRUNK_ID")

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


@function_tool
async def call_the_founder(ctx: RunContext) -> str:
    """Bring the developer onto this call live. Only offered on the public
    marketing demo, and only when the app has approved it (the app checks its
    own kill switch and cooldown; a room only ever gets this tool at all when
    the app already decided it's on). See instructions for when to use it."""
    # The app decides yes/no and atomically claims the cooldown slot — this
    # call never dials anything on a permission it granted itself.
    approved = await ctx.session.current_agent.lookup("call_the_founder")
    try:
        decision = json.loads(approved)
    except (json.JSONDecodeError, TypeError):
        decision = None
    if not isinstance(decision, dict) or not decision.get("ok"):
        reason = decision.get("reason") if isinstance(decision, dict) else None
        logger.info("call_the_founder: app declined (%s)", reason or "no reason given")
        return reason or "That's not available right now."

    if not FOUNDER_CALL_DESTINATION or not FOUNDER_SIP_TRUNK_ID:
        logger.error("call_the_founder: app approved but no SIP config is set locally")
        return "Something's not configured right on my end — sorry about that."

    job_ctx = get_job_context()
    logger.info("call_the_founder: dialing %s via trunk %s", FOUNDER_CALL_DESTINATION, FOUNDER_SIP_TRUNK_ID)
    try:
        await job_ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                room_name=job_ctx.room.name,
                sip_trunk_id=FOUNDER_SIP_TRUNK_ID,
                sip_call_to=FOUNDER_CALL_DESTINATION,
                participant_identity="founder",
                participant_name="The developer",
                play_ringtone=True,
                # Ring only briefly — if he's not right there, we don't want the
                # visitor sitting in silence. The cover task below resumes the
                # conversation at ~12s; keeping the ring to 12s means the phone
                # stops about when the agent moves on, so he can't join late
                # into an already-resumed chat. Hard-cap a connected call too.
                ringing_timeout=Duration(seconds=12),
                max_call_duration=Duration(seconds=180),
            )
        )
    except api.ServerError as e:
        # SipCallError adds the actual SIP response (e.g. 480 Temporarily
        # Unavailable = not registered, 486 Busy Here) on top of the generic
        # server error — surface that specifically when it's there, since
        # "it didn't work" is useless for debugging a call that never rings.
        sip_err = api.SipCallError.from_server_error(e)
        logger.error("call_the_founder: SIP dial-out failed: %s", sip_err)
        return "Hmm, that call didn't go through. Let's carry on without him."
    except Exception:
        logger.exception("call_the_founder: SIP dial-out failed (non-SIP error)")
        return "Hmm, that call didn't go through. Let's carry on without him."

    logger.info("call_the_founder: SIP participant created, ringing")

    # Don't leave the visitor in dead air while it rings. Give him ~12s to pick
    # up; if he hasn't actually connected by then, resume the conversation and
    # cover for him rather than sitting silent (the bug this fixes: a missed
    # call left the agent mute for minutes).
    session = ctx.session

    async def _resume_if_unanswered() -> None:
        await asyncio.sleep(12)
        room = get_job_context().room
        # Treat him as on the line if the SIP status says active OR he's
        # publishing audio — either way, don't talk over him. Erring toward
        # "connected" is the safe mistake here (worst case: a beat of silence),
        # whereas a false "he didn't answer" would speak over a live human.
        answered = any(
            p.identity == "founder"
            and (
                p.attributes.get("sip.callStatus") == "active"
                or len(p.track_publications) > 0
            )
            for p in room.remote_participants.values()
        )
        if answered:
            logger.info("call_the_founder: connected — leaving the conversation to them")
            return
        logger.info("call_the_founder: no answer after 12s, resuming the conversation")
        await session.generate_reply(
            instructions=(
                "The developer didn't pick up just now — he must be heads-down building. "
                "Say that warmly and lightly, one sentence (he's clearly hard at work!), "
                "then carry on as normal: invite them to ask you anything about Freehold."
            )
        )

    task = asyncio.create_task(_resume_if_unanswered())
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)

    return "Ringing him now — give it just a few seconds."


ALL_TOOLS = [
    workspace_summary,
    search_transactions,
    upcoming_deadlines,
    find_people,
    my_files,
    my_dates,
    my_documents,
    call_the_founder,
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
                    # "dictation" = STT-only transcription, no LLM/TTS.
                    "mode": body.get("mode") or "",
                    # Admin-configurable at /admin/settings; falls back to the
                    # long-standing default if the app ever omits it. The app
                    # still returns ttsModel too (unused here for now — TTS is
                    # pinned to direct ElevenLabs, see the pipeline docstring).
                    "sttModel": body.get("sttModel") or "deepgram/nova-3",
                }
    except Exception:
        logger.exception("could not fetch brief")
        return None


def prewarm(proc: JobProcess) -> None:
    """Load the VAD once when the worker boots, not on every call. Loading a
    model on the hot path is dead time the caller hears as extra silence before
    the greeting; doing it here means a warm worker starts talking sooner."""
    proc.userdata["vad"] = silero.VAD.load()


class Transcriber(Agent):
    """STT-only agent for live dictation: transcribes the speaker and forwards
    it to the room, never running an LLM or speaking back. The browser streams
    the forwarded transcription straight into the target field."""

    def __init__(self, stt_model: str) -> None:
        super().__init__(instructions="", stt=inference.STT(model=stt_model))

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        # Interim + final transcriptions are already forwarded live as the STT
        # produces them; stop here so no LLM reply is ever generated.
        raise StopResponse()


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

    # Dictation: pure speech-to-text. Run an STT-only session (no LLM, no TTS)
    # that forwards the speaker's live transcription to the browser, which
    # streams it into the target field. Never speaks back.
    if brief["mode"] == "dictation":
        session = AgentSession(vad=ctx.proc.userdata["vad"])
        await session.start(
            room=ctx.room,
            agent=Transcriber(brief["sttModel"]),
            room_input_options=RoomInputOptions(),
            # Silence the agent — we only want transcriptions on the wire.
            room_output_options=RoomOutputOptions(
                audio_enabled=False, transcription_enabled=True
            ),
        )
        logger.info("dictation session live at %s", elapsed())
        return

    session = AgentSession(
        # Reuse the VAD loaded in prewarm() rather than loading it per session.
        vad=ctx.proc.userdata["vad"],
        # STT routes through LiveKit's own hosted inference — billed per-minute
        # through LiveKit, authenticated with the worker's own LIVEKIT_API_KEY/
        # SECRET, no Deepgram key needed. Which model it uses is
        # admin-configurable (/admin/settings) and read fresh on every session.
        stt=inference.STT(model=brief["sttModel"]),
        llm=anthropic.LLM(model=LLM_MODEL),
        # TTS stays a DIRECT ElevenLabs call, not inference — LiveKit's
        # inference proxy only sees ElevenLabs' shared voice library, not a
        # private/custom voice on our own account (confirmed live: it 400s
        # with "voice does not exist" for VOICE_ID and the session gets no
        # audio at all). Revisit if/when inference adds custom-voice passthrough.
        #
        # chunk_length_schedule disables the plugin's default auto_mode, which
        # flushes to ElevenLabs once per sentence — each flush starts a new
        # streaming "generation," and the seam between generations is audible
        # as a small stutter on any reply longer than one sentence. Buffering
        # by character count instead sends one continuous stream for a short
        # reply and only a couple of smooth flushes for a longer one.
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
