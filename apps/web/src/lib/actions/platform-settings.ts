"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { optStr, str } from "@/lib/forms";
import { isValidSummaryModel } from "@/lib/handbook/style";
import { isOperator } from "@/lib/operator";
import { isValidSttModel, isValidTtsModel } from "@/lib/voice-inference-models";

/** Operator edits the global platform settings — the founder-call kill switch,
 *  cooldown, homepage voice demo selling points, and the STT/TTS models the
 *  voice agent uses (routed through LiveKit's own inference; the LLM stays a
 *  fixed direct Claude call, not editable here — see schema.prisma). */
export async function updatePlatformSettings(formData: FormData) {
  if (!(await isOperator())) return;

  const cooldownRaw = str(formData, "founderCallCooldownMinutes");
  const cooldown = Number.parseInt(cooldownRaw, 10);

  const sttModelRaw = str(formData, "voiceSttModel");
  const ttsModelRaw = str(formData, "voiceTtsModel");
  // A bad value here would silently break every voice session on the next
  // call, so an invalid submission is dropped rather than saved — the field
  // just keeps its previous value.
  const sttModel = isValidSttModel(sttModelRaw) ? sttModelRaw : undefined;
  const ttsModel = isValidTtsModel(ttsModelRaw) ? ttsModelRaw : undefined;

  // Same reasoning as the voice models: an unrecognised id would fail every
  // summary quietly, so a bad submission keeps the previous value.
  const summaryModelRaw = str(formData, "handbookModel");
  const handbookModel = isValidSummaryModel(summaryModelRaw) ? summaryModelRaw : undefined;
  const handbookThinking = formData.get("handbookThinking") === "on";
  // Blank means "use the bundled house style", so it is stored as null rather
  // than as an empty string that would reach the model as an empty prompt.
  const handbookStyleGuide = optStr(formData, "handbookStyleGuide") || null;
  // Blank means "use the bundled copy", so it is stored as null. Removing the
  // prompt is the checkbox's job — an empty textarea never means two things.
  const cloudPromptText = optStr(formData, "cloudPromptText") || null;
  const cloudPromptEnabled = formData.get("cloudPromptEnabled") === "on";
  // Blank would mean the support page shows no number at all, which is worse
  // than keeping the last one — so an empty submission is dropped rather than
  // clearing the field.
  const contactPhone = optStr(formData, "contactPhone");

  await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      founderCallsAvailable: formData.get("founderCallsAvailable") === "on",
      founderCallCooldownMinutes: Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 15,
      founderCallSellingPoints: optStr(formData, "founderCallSellingPoints"),
      ...(sttModel ? { voiceSttModel: sttModel } : {}),
      ...(ttsModel ? { voiceTtsModel: ttsModel } : {}),
      ...(handbookModel ? { handbookModel } : {}),
      handbookThinking,
      handbookStyleGuide,
      cloudPromptText,
      cloudPromptEnabled,
      ...(contactPhone ? { contactPhone } : {}),
    },
    update: {
      founderCallsAvailable: formData.get("founderCallsAvailable") === "on",
      ...(Number.isFinite(cooldown) && cooldown > 0
        ? { founderCallCooldownMinutes: cooldown }
        : {}),
      founderCallSellingPoints: optStr(formData, "founderCallSellingPoints"),
      ...(sttModel ? { voiceSttModel: sttModel } : {}),
      ...(ttsModel ? { voiceTtsModel: ttsModel } : {}),
      ...(handbookModel ? { handbookModel } : {}),
      handbookThinking,
      handbookStyleGuide,
      cloudPromptText,
      cloudPromptEnabled,
      ...(contactPhone ? { contactPhone } : {}),
    },
  });

  revalidatePath("/admin/settings");
}
