import { prisma } from "@freehold/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    {
      status: db ? "ok" : "degraded",
      db,
      service: "web",
      version: "0.0.0",
    },
    { status: db ? 200 : 503 },
  );
}
