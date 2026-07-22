import { withTenant } from "@freehold/db";
import { NextResponse } from "next/server";
import { isCloud, transactionHasPro } from "@/lib/plans";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Voice dictation, powered by Deepgram (Nova model — industry-leading
 * transcription accuracy). Paid Cloud tiers use the platform key; self-hosted
 * installs bring their own DEEPGRAM_API_KEY.
 *
 * Dictation inside a transaction is a per-transaction pro feature: a Free
 * workspace that spent a credit on the transaction (x-transaction-id header)
 * gets it. Dictation with no transaction context (e.g. template editing) stays
 * paid-only. Either way a blocked caller gets a 402 the UI turns into a prompt.
 */
export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await requireTenant());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isCloud()) {
    const txId = req.headers.get("x-transaction-id");
    const proEnabled = txId
      ? await withTenant(tenantId, async (tx) => {
          const t = await tx.transaction.findUnique({
            where: { id: txId },
            select: { proFeaturesEnabled: true },
          });
          return t?.proFeaturesEnabled ?? false;
        })
      : false;
    if (!(await transactionHasPro(tenantId, proEnabled))) {
      return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
    }
  }
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length === 0 || audio.length > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "bad_audio" }, { status: 400 });
  }

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": req.headers.get("content-type") ?? "audio/webm",
      },
      body: audio,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) {
    return NextResponse.json({ error: "transcription_failed" }, { status: 502 });
  }
  const data = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return NextResponse.json({ text });
}
