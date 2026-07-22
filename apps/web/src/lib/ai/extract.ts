import Anthropic from "@anthropic-ai/sdk";
import { CONTRACT_SCHEMA, type ContractExtractionResult } from "./contract-schema";
import { type AiUsage, usageFrom } from "./usage";

/**
 * Self-hosters bring their own Anthropic key (ANTHROPIC_API_KEY in .env);
 * FREEHOLD_AI_MODEL overrides the model. Accuracy is the whole point of the
 * feature, so the default is the most capable Opus-tier model.
 */
export const EXTRACTION_MODEL = process.env.FREEHOLD_AI_MODEL ?? "claude-opus-4-8";

const EXTRACTION_PROMPT = `You are extracting structured data from a residential real estate purchase contract on behalf of a transaction coordinator. The extracted values will be reviewed by a human before anything is saved, and every value you report must be verifiable against the document.

Rules:
- Only report a value you can ground in the document. If a value is absent or genuinely ambiguous, return null (for scalar fields) or omit it (for array items). Never guess.
- Every value must carry the 1-based page number where it appears and a short verbatim quote (under 200 characters) containing or establishing it.
- Dates must be formatted YYYY-MM-DD. When the contract expresses a deadline relatively ("within 10 days of the Effective Date"), compute the calendar date from the effective date, quote the clause, and mark confidence "medium" (or "low" if the anchor date itself is uncertain).
- purchase_price value must be digits only (no currency symbols or commas).
- deadlines: report every deadline-bearing obligation — earnest money due date, inspection/option period end, financing and appraisal deadlines, title objection deadlines, possession date. The closing date belongs in close_date, not in deadlines.
- confidence: "high" = stated explicitly and unambiguously; "medium" = requires interpretation or computation; "low" = uncertain.`;

export interface ExtractionRun {
  result: ContractExtractionResult;
  usage: AiUsage;
}

export async function extractContract(
  pdf: Buffer,
  model: string = EXTRACTION_MODEL,
): Promise<ExtractionRun> {
  // Zero-arg client: resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or a
  // stored `ant auth login` profile.
  const client = new Anthropic();

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: {
        type: "json_schema",
        schema: CONTRACT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf.toString("base64"),
            },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this document.");
  }

  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  )?.text;
  if (!text) {
    throw new Error(`Model returned no output (stop_reason: ${response.stop_reason}).`);
  }
  return {
    result: JSON.parse(text) as ContractExtractionResult,
    usage: usageFrom(model, response),
  };
}
