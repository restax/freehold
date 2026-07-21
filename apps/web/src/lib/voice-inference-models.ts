/**
 * The STT/TTS models available through LiveKit's own hosted inference —
 * billed per-minute through LiveKit, no vendor API key needed. Mirrors
 * `livekit.agents.inference.{STTModels,TTSModels}` in the Python SDK
 * (services/voice-agent/.venv/…/livekit/agents/inference/{stt,tts}.py) —
 * update both sides together if LiveKit adds or removes a model.
 *
 * Grouped by provider for the admin picker; also the source of truth for
 * validating a submitted value server-side (updatePlatformSettings), so a
 * bad string can never reach the agent and silently break a session.
 */

export interface ModelGroup {
  provider: string;
  models: Array<{ value: string; label: string }>;
}

export const STT_MODEL_GROUPS: ModelGroup[] = [
  { provider: "Auto", models: [{ value: "auto", label: "Auto (LiveKit picks)" }] },
  {
    provider: "Deepgram",
    models: [
      { value: "deepgram/nova-3", label: "Nova 3" },
      { value: "deepgram/nova-3-medical", label: "Nova 3 Medical" },
      { value: "deepgram/nova-2", label: "Nova 2" },
      { value: "deepgram/nova-2-medical", label: "Nova 2 Medical" },
      { value: "deepgram/nova-2-conversationalai", label: "Nova 2 Conversational AI" },
      { value: "deepgram/nova-2-phonecall", label: "Nova 2 Phone Call" },
      { value: "deepgram/flux-general", label: "Flux General" },
      { value: "deepgram/flux-general-en", label: "Flux General (English)" },
      { value: "deepgram/flux-general-multi", label: "Flux General (Multilingual)" },
    ],
  },
  {
    provider: "Cartesia",
    models: [
      { value: "cartesia/ink-whisper", label: "Ink Whisper" },
      { value: "cartesia/ink-2", label: "Ink 2" },
    ],
  },
  {
    provider: "AssemblyAI",
    models: [
      { value: "assemblyai/universal-streaming", label: "Universal Streaming" },
      {
        value: "assemblyai/universal-streaming-multilingual",
        label: "Universal Streaming (Multilingual)",
      },
      { value: "assemblyai/u3-rt-pro", label: "U3 RT Pro" },
      { value: "assemblyai/universal-3-5-pro", label: "Universal 3.5 Pro" },
    ],
  },
  {
    provider: "ElevenLabs",
    models: [{ value: "elevenlabs/scribe_v2_realtime", label: "Scribe v2 Realtime" }],
  },
  { provider: "xAI", models: [{ value: "xai/stt-1", label: "STT 1" }] },
  {
    provider: "Speechmatics",
    models: [
      { value: "speechmatics/enhanced", label: "Enhanced" },
      { value: "speechmatics/standard", label: "Standard" },
    ],
  },
  { provider: "Inworld", models: [{ value: "inworld/inworld-stt-1", label: "STT 1" }] },
];

export const TTS_MODEL_GROUPS: ModelGroup[] = [
  {
    provider: "ElevenLabs",
    models: [
      { value: "elevenlabs/eleven_turbo_v2_5", label: "Turbo v2.5 (fast, current default)" },
      { value: "elevenlabs/eleven_turbo_v2", label: "Turbo v2" },
      { value: "elevenlabs/eleven_flash_v2_5", label: "Flash v2.5 (fastest)" },
      { value: "elevenlabs/eleven_flash_v2", label: "Flash v2" },
      { value: "elevenlabs/eleven_multilingual_v2", label: "Multilingual v2 (highest quality)" },
      { value: "elevenlabs/eleven_v3", label: "v3" },
    ],
  },
  {
    provider: "Cartesia",
    models: [
      { value: "cartesia/sonic-3.5", label: "Sonic 3.5" },
      { value: "cartesia/sonic-3", label: "Sonic 3" },
      { value: "cartesia/sonic-2", label: "Sonic 2" },
      { value: "cartesia/sonic-turbo", label: "Sonic Turbo" },
      { value: "cartesia/sonic", label: "Sonic" },
    ],
  },
  {
    provider: "Deepgram",
    models: [
      { value: "deepgram/aura-2", label: "Aura 2" },
      { value: "deepgram/aura", label: "Aura" },
    ],
  },
  {
    provider: "Rime",
    models: [
      { value: "rime/arcana", label: "Arcana" },
      { value: "rime/coda", label: "Coda" },
      { value: "rime/mistv3", label: "Mist v3" },
      { value: "rime/mistv2", label: "Mist v2" },
      { value: "rime/mist", label: "Mist" },
    ],
  },
  {
    provider: "Inworld",
    models: [
      { value: "inworld/inworld-tts-2", label: "TTS 2" },
      { value: "inworld/inworld-tts-1.5-max", label: "TTS 1.5 Max" },
      { value: "inworld/inworld-tts-1.5-mini", label: "TTS 1.5 Mini" },
      { value: "inworld/inworld-tts-1.5", label: "TTS 1.5" },
      { value: "inworld/inworld-tts-1-max", label: "TTS 1 Max" },
      { value: "inworld/inworld-tts-1", label: "TTS 1" },
    ],
  },
  { provider: "xAI", models: [{ value: "xai/tts-1", label: "TTS 1" }] },
];

function flatten(groups: ModelGroup[]): Set<string> {
  return new Set(groups.flatMap((g) => g.models.map((m) => m.value)));
}

const VALID_STT_MODELS = flatten(STT_MODEL_GROUPS);
const VALID_TTS_MODELS = flatten(TTS_MODEL_GROUPS);

export function isValidSttModel(value: string): boolean {
  return VALID_STT_MODELS.has(value);
}

export function isValidTtsModel(value: string): boolean {
  return VALID_TTS_MODELS.has(value);
}
