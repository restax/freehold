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
`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `DEEPGRAM_API_KEY`,
`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`.

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
deployment has `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and
`ELEVENLABS_API_KEY` set. On Vercel that means `vercel env add` for each,
then a redeploy — the agent alone isn't enough.

## Cost

Three metered APIs run per session, so Cloud meters it: Free gets none, Pro
100 sessions/month, Business 300 (`voiceSessionsPerMonth` in
`apps/web/src/lib/plans.ts`). Self-hosted installs are never metered — you're
paying the vendors directly. Replies are kept to a sentence or two by the
system prompt, and the tool loop is capped at 3 steps, both to keep spoken
answers listenable and the bill boring.
