import { NextResponse } from "next/server";
import { monitorAllActive, monitorAllBypass } from "@/lib/actions";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token") ?? "";
  const ok =
    auth === `Bearer ${secret}` || queryToken === secret;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [active, bypass] = await Promise.all([
    monitorAllActive(),
    monitorAllBypass(),
  ]);
  return NextResponse.json({ ok: true, active, bypass });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
