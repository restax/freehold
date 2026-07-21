# Voice agent

Powers **Voice search** — asking Freehold questions out loud and getting a
spoken answer from your own workspace data.

Silero VAD → Deepgram (streaming STT) → Claude → ElevenLabs (TTS), wired
together by [LiveKit Agents](https://docs.livekit.io/agents/). The browser
joins a LiveKit room; this worker joins the same room and does the talking.

## Why it's a separate process

LiveKit agents are long-lived processes holding a WebRTC connection. That
can't run on Vercel (or in a Next.js route), so it lives here and is deployed
on its own. Everything else about Freehold is unchanged — if this worker isn't
running, voice search simply reports itself unavailable and the rest of the
app carries on.

## What it can read

Nothing, by itself. It holds no database credentials.

When a session opens, the web app mints a short-lived HMAC-signed **capability
grant** describing that one conversation's scope — a workspace, a guest's
assigned files, or a single portal link — and puts it in the room metadata.
This worker relays that grant back to `/api/voice/data` on every lookup, and
the app re-derives the scope from the signature alone. A portal visitor's
session is handed only the portal tools; a forged or expired grant gets a 401
and no fallback. See `apps/web/src/lib/voice-grant.ts`.

## Running it

Keys come from the repo-root `.env` — no second copy:
`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ANTHROPIC_API_KEY`.
STT and TTS don't need their own vendor keys — see the next section.

```bash
python3.12 -m venv .venv          # 3.10+ required; livekit-agents needs it
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python agent.py dev   # `start` in production
```

Point it at a non-default app with `FREEHOLD_APP_URL` (defaults to
`http://localhost:3010`). Override the voice with `ELEVENLABS_VOICE_ID` and
the model with `FREEHOLD_VOICE_MODEL`.

## Deploying to LiveKit Cloud Agents

```bash
brew install livekit-cli          # once
lk cloud auth                     # browser OAuth; interactive, once

cp secrets.example secrets.env    # fill from the repo-root .env
lk agent create --region us-east-1 --secrets-file secrets.env
```

**Pin the region.** `lk agent create/deploy` defaults to *"nearest region to
whoever ran the command"* — deploy from Tokyo and your US users get an agent in
Tokyo. Two things suffer: their audio crosses the Pacific each conversational
turn, and every `/api/voice/data` lookup round-trips to Vercel's `iad1` (US
East) and back. Pin it to US East so the agent sits beside both.

Confirm the region name against `lk agent create --help` / your project's
available regions before the first deploy; the flag takes LiveKit's identifier,
not an AWS one.

Afterwards:

```bash
lk agent status          # is it up
lk agent logs            # tail it
lk agent deploy          # ship a new version
lk agent rollback        # undo
```

**The app needs its half too.** `/api/voice/token` returns 501 unless the web
deployment has `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` set.
On Vercel that means `vercel env add` for each, then a redeploy — the agent
alone isn't enough.

## Speech-to-text — LiveKit inference, not a vendor key

STT runs through `livekit.agents.inference` — LiveKit's own hosted routing
layer — instead of the Deepgram plugin calling their API directly.
Authenticated automatically with the worker's own `LIVEKIT_API_KEY`/
`LIVEKIT_API_SECRET`; no `DEEPGRAM_API_KEY` needed here at all, and billed
per-minute through LiveKit Cloud instead of Deepgram directly.

**Which model it uses is admin-configurable, not hardcoded** —
`/admin/settings` → "Voice pipeline" (`apps/web/src/lib/voice-inference-models.ts`
holds the full catalog, mirrored from `livekit.agents.inference.STTModels`
in the installed SDK). The choice is stored in `platform_setting` and read
fresh on every session via the same `/api/voice/data` brief the agent already
fetches (`fetch_brief()` in `agent.py`) — so a change in admin takes effect on
the *next call*, no agent redeploy.

**TTS stays a direct ElevenLabs call, not inference — this was tried and
reverted.** `inference.TTS` only has access to ElevenLabs' shared voice
library, not a private/custom voice on our own account: pointing it at
`ELEVENLABS_VOICE_ID` 400s live with `"voice_id ... does not exist"` and the
session gets no audio at all. So TTS still needs `ELEVENLABS_API_KEY` and
`elevenlabs.TTS(...)` directly (`livekit-plugins-elevenlabs` stays in
`requirements.txt`) — revisit if LiveKit's inference ever adds custom-voice
passthrough.

**The LLM stays a direct Anthropic call too, on purpose.** Claude isn't in
LiveKit's inference catalog at all (only OpenAI, Gemini, Moonshot, DeepSeek,
GLM, Grok), so `ANTHROPIC_API_KEY` is still required and `LLM_MODEL` /
`FREEHOLD_VOICE_MODEL` still work the same way they always did.

## Latency — the wait before the first spoken word

The gap between clicking "Talk to it" and hearing the greeting is the sum of:
the token round trip (browser → Vercel `iad1`), the LiveKit connect (global
edge, already near the user), the agent being dispatched, its `fetch_brief`
round trip (agent → `/api/voice/data` on Vercel `iad1`), VAD load, and the
first Claude reply + TTS. Only the first two shrink when the *user* is closer
to `iad1`; the rest track where the *agent* runs. Levers, by impact:

1. **Region.** Pin the agent to US East (above) so it sits beside `iad1` — that
   makes `fetch_brief` and every data lookup a same-region hop and keeps US
   users' audio off the Pacific. Deploying from Tokyo puts the agent there and
   pays that cross-Pacific cost on every turn, for everyone.
2. **Prewarm + warm workers.** The VAD is loaded in `prewarm_fnc` (once per
   worker, not per call). Keep at least one worker warm in the LiveKit Cloud
   agent settings so the first click after idle doesn't cold-start a container.
3. **Measure.** The worker logs stamp each step (`connected`, `grant accepted`,
   `session live`, `greeting dispatched`); the browser console logs `[voice]`
   marks (token, connect, first agent audio). Compare the two to see whether a
   wait is network, dispatch, or the first-reply pipeline before tuning more.

`generate_reply(instructions=greeting)` composes the greeting with the LLM so
it varies naturally; that's one Claude call on the critical path. Swapping it
for `session.say(<fixed line>)` removes that call but makes the opener scripted
— a deliberate quality/latency trade, left as generate_reply on purpose.

## Cost

Three vendors run per session, so Cloud meters it: Free gets none, Pro 100
sessions/month, Business 300 (`voiceSessionsPerMonth` in
`apps/web/src/lib/plans.ts`). Self-hosted installs are never metered — you're
paying the vendors directly: Anthropic for the LLM, ElevenLabs for TTS
(direct, see above), and LiveKit Cloud per-minute for STT (swap models in
`/admin/settings` to compare cost). Replies are kept to a sentence or two by
the system prompt, and the tool loop is capped at 3 steps, both to keep
spoken answers listenable and the bill boring.

## Calling a real phone — the homepage "call the developer" demo

On the marketing homepage only, the agent can offer to bring the developer
onto the call live: not a transfer, a **group call** — the SIP-dialed phone
joins the same room as a third participant, so the visitor, the AI, and the
human are all on together. Off by default; an operator turns it on and
configures it entirely from **`/admin/settings`** (no redeploy needed):

- **Kill switch** — a plain on/off. Nothing offers or dials while it's off.
- **Cooldown** — minutes between calls, enforced with a single atomic
  Postgres `UPDATE` (`claimFounderCallSlot` in `apps/web/src/lib/platform-settings.ts`),
  so it can't be spammed even by several visitors racing at once.
- **Selling points** — free text the voice assistant weaves into what it says
  about Freehold, in its own words.

**Trust boundary, same as everywhere else in this file:** the agent never
decides on its own whether to dial. `call_the_founder` asks the app first
(`POST /api/voice/data`, same as every other tool); the app checks the kill
switch and cooldown and — only if both pass — atomically claims the slot and
says yes. Only then does the agent place the SIP call, with its own
credentials. A tampered or over-eager agent can't call out on a permission it
granted itself.

**Setup**, beyond the usual secrets:

The dial target is a bare **SIP username** (e.g. `paulslazas`), not a phone
number and not a full `sip:user@host` URI. LiveKit Cloud's own hosted "phone
numbers" product turned out to be **inbound-only** — dialing out through one
requires a real PSTN carrier outbound trunk plus, for US local numbers, an
E911/compliance step that isn't a self-serve toggle. Dialing a SIP address
directly (e.g. a free SIP account like
[linphone.org](https://www.linphone.org/en/free-sip-service/)) sidesteps all
of that: no carrier, no compliance step, no per-minute billing. The
*hostname* (`sip.linphone.org`) lives on the outbound trunk's `--address`,
not in `FOUNDER_CALL_DESTINATION` — the API rejects a full URI there with
"should be a phone number or SIP user, not a full SIP URI".

1. Create an outbound SIP trunk whose address is the SIP provider's domain —
   `lk sip outbound create --name "..." --address sip.linphone.org --numbers "<any number already on the project>"`
   (`--numbers` sets the caller ID; a free SIP provider generally doesn't
   care what it is, but the API requires something be set).
2. Set `FOUNDER_CALL_DESTINATION` (the bare username, e.g. `paulslazas`) and
   `FOUNDER_SIP_TRUNK_ID` (the trunk's ID from step 1) in `secrets.env`, then
   `lk agent update-secrets --secrets-file secrets.env`.

Leaving either blank keeps the feature safely off even if the kill switch is
on — `call_the_founder` checks both and declines cleanly ("something's not
configured right on my end") rather than failing oddly. On a dial failure,
the agent logs the actual SIP response (e.g. "480 Temporarily Unavailable" =
not registered, "486 Busy Here") via `livekit.api.SipCallError`, not just a
generic exception — check `lk agent logs` first when a call doesn't connect.

Auto-hangup and a ringing timeout are set directly on the SIP call
(`max_call_duration`, `ringing_timeout` in `call_the_founder`, `agent.py`) so a
missed or forgotten call can't run away on its own.
