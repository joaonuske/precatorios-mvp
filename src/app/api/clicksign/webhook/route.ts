import crypto from "crypto";
import { NextResponse } from "next/server";
import { ingestSignedDocument } from "@/lib/actions";

export const dynamic = "force-dynamic";

// Clicksign envia eventos como auto_close, sign, document, deadline_at, etc.
// Usamos auto_close ou document.closed para baixar o PDF final.
// Docs: https://developers.clicksign.com/docs/webhooks

export async function POST(req: Request) {
  const secret = process.env.CLICKSIGN_HMAC_SECRET;
  const rawBody = await req.text();

  // Validação HMAC opcional (se configurada no dashboard do Clicksign)
  if (secret) {
    const provided = req.headers.get("Content-Hmac") ?? "";
    const expected =
      "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (provided !== expected) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: {
    event?: { name?: string; data?: { document?: { key?: string } } };
    document?: { key?: string; status?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventName = payload.event?.name ?? "";
  const documentKey =
    payload.event?.data?.document?.key ?? payload.document?.key;

  // Eventos relevantes pra fechar o documento
  const finalizingEvents = new Set([
    "auto_close",
    "document_closed",
    "document.closed",
  ]);
  if (!documentKey || !finalizingEvents.has(eventName)) {
    return NextResponse.json({ ok: true, ignored: eventName });
  }

  const result = await ingestSignedDocument(documentKey);
  return NextResponse.json({ ok: true, result });
}
