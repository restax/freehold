import Anthropic from "@anthropic-ai/sdk";

/**
 * Lightweight document classification for the drag-and-drop uploader: given a
 * PDF and the file's required-documents checklist, name what the document is
 * and pick the slot it fills (if any). A cheap, fast model is enough — this is
 * a suggestion the coordinator confirms, never an automatic filing. Defaults to
 * Haiku; FREEHOLD_CLASSIFY_MODEL overrides.
 */
export const CLASSIFY_MODEL = process.env.FREEHOLD_CLASSIFY_MODEL ?? "claude-haiku-4-5";

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["docType", "matchIndex"],
  properties: {
    docType: {
      type: "string",
      description:
        "A short human name for what this document is, e.g. 'Purchase & Sale Agreement', 'Lead paint disclosure', 'Inspection report', 'Wire instructions'.",
    },
    matchIndex: {
      type: ["integer", "null"],
      description:
        "The index of the checklist item this document clearly IS, or null if none is a confident match.",
    },
  },
} as const;

export interface DocClassification {
  docType: string;
  matchIndex: number | null;
}

export async function classifyDocument(pdf: Buffer, labels: string[]): Promise<DocClassification> {
  const client = new Anthropic();
  const list =
    labels.length > 0 ? labels.map((l, i) => `${i}: ${l}`).join("\n") : "(no checklist items)";

  const prompt = `You are a real estate transaction coordinator's assistant. Identify what this document is, and whether it matches one of the coordinator's required-document checklist items.

Checklist items (index: label):
${list}

Return docType (a short, human name for the document) and matchIndex (the index of the checklist item this document clearly IS, or null if none is a confident match). Only set matchIndex when you are confident the document is that item.`;

  const res = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 300,
    output_config: {
      format: {
        type: "json_schema",
        schema: CLASSIFY_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("No classification output.");
  const parsed = JSON.parse(text) as DocClassification;
  // Guard the index against a hallucinated out-of-range value.
  if (
    typeof parsed.matchIndex === "number" &&
    (parsed.matchIndex < 0 || parsed.matchIndex >= labels.length)
  ) {
    parsed.matchIndex = null;
  }
  return parsed;
}
