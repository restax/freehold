/**
 * Contact-details extraction from a pasted screenshot, for /admin/crm-capture.
 *
 * Pure and side-effect free (schema, prompt text, and the normalizers) so the
 * shaping of model output can be unit-tested without an API call — same split
 * as contract-schema.ts. The API call itself lives in extractLeadFromImage
 * below, which is the only part that touches Anthropic.
 */
import Anthropic from "@anthropic-ai/sdk";
import { type AiUsage, usageFrom } from "./usage";

/** Screenshots are pasted by hand, so the vision-capable default is fine. */
export const LEAD_CAPTURE_MODEL = process.env.FREEHOLD_AI_MODEL ?? "claude-opus-4-8";

/** Image types Anthropic's vision API accepts. */
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(t: string): t is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(t);
}

export interface LeadFields {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
}

export const LEAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["firstName", "lastName", "phone", "email", "company"],
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
  },
} as const;

export const LEAD_PROMPT = `Extract contact details from this screenshot so they can be saved to a CRM.

The screenshot is usually a business page, social profile, email signature, or business card for a real estate professional.

Rules:
- Only report what is actually visible in the image. If a field is not shown, return null. Never guess or infer a value that isn't there.
- firstName / lastName: split the person's name. A page named for a business rather than a person (for example "Bayside Realty Group") has no person name, so both are null and the business goes in company.
- phone: digits as shown, keep the formatting from the image.
- email: only if a real address is visible.
- company: the brokerage, team, or business name. If the page name doubles as the business name, use it here too.`;

/** Trim, collapse whitespace, and turn empty strings into null. */
export function cleanField(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

/**
 * Defensive normalizer over model output: the schema constrains the response,
 * but this is what the form and the Twenty push actually read, so it never
 * trusts the shape blindly.
 */
export function normalizeLead(raw: unknown): LeadFields {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (k: string) => cleanField(typeof r[k] === "string" ? (r[k] as string) : null);
  return {
    firstName: str("firstName"),
    lastName: str("lastName"),
    phone: str("phone"),
    email: str("email"),
    company: str("company"),
  };
}

/** Whether there is enough here to be worth showing a review form for. */
export function hasAnyField(lead: LeadFields): boolean {
  return Object.values(lead).some((v) => v !== null);
}

/** The person's display name, or null when only a company was found. */
export function fullName(lead: Pick<LeadFields, "firstName" | "lastName">): string | null {
  return cleanField([lead.firstName, lead.lastName].filter(Boolean).join(" "));
}

/** Case- and whitespace-insensitive comparison, for duplicate matching. */
export function looseEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = cleanField(a);
  const y = cleanField(b);
  return x !== null && y !== null && x.toLowerCase() === y.toLowerCase();
}

/**
 * Just the digits of a phone number, so "(916) 555-0142", "916-555-0142", and
 * "9165550142" compare equal. Leading country code is dropped when it makes an
 * 11-digit US number, since one CRM row may carry it and another may not.
 */
export function phoneDigits(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** Whether two phone numbers are the same once formatting is stripped. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = phoneDigits(a);
  const y = phoneDigits(b);
  return x !== null && y !== null && x === y;
}

export interface LeadCaptureRun {
  lead: LeadFields;
  usage: AiUsage;
}

export async function extractLeadFromImage(
  image: Buffer,
  mediaType: SupportedImageType,
  model: string = LEAD_CAPTURE_MODEL,
): Promise<LeadCaptureRun> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    output_config: {
      format: { type: "json_schema", schema: LEAD_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: image.toString("base64") },
          },
          { type: "text", text: LEAD_PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read this image.");
  }
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) {
    throw new Error(`Model returned no output (stop_reason: ${response.stop_reason}).`);
  }
  return { lead: normalizeLead(JSON.parse(text)), usage: usageFrom(model, response) };
}
