-- AlterTable
ALTER TABLE "platform_setting" ADD COLUMN     "voice_stt_model" TEXT NOT NULL DEFAULT 'deepgram/nova-3',
ADD COLUMN     "voice_tts_model" TEXT NOT NULL DEFAULT 'elevenlabs/eleven_turbo_v2_5';

