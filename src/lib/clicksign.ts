// Cliente mínimo da API Clicksign v1
// Docs: https://developers.clicksign.com/docs/

const BASE = process.env.CLICKSIGN_API_BASE || "https://sandbox.clicksign.com";
const TOKEN = process.env.CLICKSIGN_API_TOKEN;

function urlWithToken(path: string): string {
  if (!TOKEN) throw new Error("CLICKSIGN_API_TOKEN não configurada.");
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE}${path}${sep}access_token=${TOKEN}`;
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(urlWithToken(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body
        ? JSON.stringify(body)
        : String(body);
    throw new Error(`Clicksign ${res.status}: ${msg}`);
  }
  return body as T;
}

type DocumentResp = { document: { key: string; status: string; downloads: { signed_file_url?: string } } };
type SignerResp = { signer: { key: string; email: string; name: string } };
type ListResp = { list: { request_signature_key: string } };

export async function uploadDocument(opts: {
  filenamePath: string; // ex: "/precatorios/contrato-XYZ.pdf"
  pdfBase64: string; // data: prefix obrigatório
  deadlineAt?: string; // ISO 8601, opcional
}): Promise<DocumentResp["document"]> {
  const body = {
    document: {
      path: opts.filenamePath,
      content_base64: opts.pdfBase64,
      deadline_at: opts.deadlineAt,
      auto_close: true,
      locale: "pt-BR",
    },
  };
  const r = await call<DocumentResp>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.document;
}

export async function createSigner(opts: {
  name: string;
  email: string;
  cpf?: string;
  birthday?: string; // YYYY-MM-DD
  phoneNumber?: string;
}): Promise<SignerResp["signer"]> {
  const body = {
    signer: {
      email: opts.email,
      name: opts.name,
      documentation: opts.cpf,
      birthday: opts.birthday,
      phone_number: opts.phoneNumber,
      has_documentation: !!opts.cpf,
      auths: ["email"], // método de identificação no Clicksign (configurável depois)
      delivery: "email",
    },
  };
  const r = await call<SignerResp>("/api/v1/signers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.signer;
}

export async function addSignerToDocument(opts: {
  documentKey: string;
  signerKey: string;
  signAs?: "party" | "witness" | "intervening" | "approve" | "sign";
  message?: string;
}) {
  const body = {
    list: {
      document_key: opts.documentKey,
      signer_key: opts.signerKey,
      sign_as: opts.signAs ?? "party",
      message: opts.message,
    },
  };
  return await call<ListResp>("/api/v1/lists", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getDocument(
  documentKey: string,
): Promise<DocumentResp["document"]> {
  const r = await call<DocumentResp>(`/api/v1/documents/${documentKey}`);
  return r.document;
}

export async function downloadSignedPdf(
  documentKey: string,
): Promise<Buffer> {
  const doc = await getDocument(documentKey);
  const url = doc.downloads?.signed_file_url;
  if (!url) throw new Error("Documento ainda não tem signed_file_url.");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao baixar PDF assinado: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
