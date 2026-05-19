type Sig = {
  signerName?: string;
  cpfCnpj?: string;
  email?: string;
  issuer?: string;
  signedAt?: string;
  notBefore?: string;
  notAfter?: string;
  isIcpBrasil?: boolean;
  integrityOk: boolean;
  reason?: string;
  chain?: {
    configured: boolean;
    storeSize: number;
    chainValid: boolean;
    chainLength?: number;
    reason?: string;
  };
  revocation?: "not_checked";
};
type Analysis = {
  sha256: string;
  signaturesFound: number;
  signatures: Sig[];
  truststoreConfigured?: boolean;
};

function fmtDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleString("pt-BR");
}

function fmtCpfCnpj(d?: string): string {
  if (!d) return "—";
  const c = d.replace(/\D+/g, "");
  if (c.length === 11) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  if (c.length === 14)
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  return c;
}

export function PdfSignatureBadge({
  sha256,
  signaturesJson,
}: {
  sha256?: string | null;
  signaturesJson?: string | null;
}) {
  if (!sha256) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded border bg-slate-50 text-slate-500">
        Sem PDF anexado
      </span>
    );
  }
  const analysis: Analysis | null = signaturesJson
    ? safeParse(signaturesJson)
    : null;
  const sigs = analysis?.signatures ?? [];
  const validCount = sigs.filter((s) => s.integrityOk).length;
  const icpCount = sigs.filter((s) => s.integrityOk && s.isIcpBrasil).length;
  const chainVerifiedCount = sigs.filter(
    (s) => s.integrityOk && s.chain?.chainValid,
  ).length;

  let badgeLabel: string;
  let badgeCls: string;
  if (sigs.length === 0) {
    badgeLabel = "PDF sem assinatura digital";
    badgeCls = "bg-amber-100 text-amber-900 border-amber-200";
  } else if (validCount === 0) {
    badgeLabel = `PDF com ${sigs.length} assinatura(s) inválida(s)`;
    badgeCls = "bg-red-100 text-red-800 border-red-200";
  } else if (chainVerifiedCount > 0) {
    badgeLabel = "✓ PDF assinado · Cadeia ICP-Brasil verificada";
    badgeCls = "bg-emerald-100 text-emerald-800 border-emerald-200";
  } else if (icpCount > 0) {
    badgeLabel = "✓ PDF assinado (emissor ICP-Brasil — cadeia não verificada)";
    badgeCls = "bg-sky-100 text-sky-800 border-sky-200";
  } else {
    badgeLabel = "✓ PDF assinado (emissor não-ICP)";
    badgeCls = "bg-sky-100 text-sky-800 border-sky-200";
  }

  return (
    <div className="space-y-2">
      <span
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${badgeCls}`}
      >
        {badgeLabel}
      </span>
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer underline">
          Hash e assinatura(s) do PDF
        </summary>
        <div className="mt-2 space-y-2">
          <div className="break-all">
            <strong>SHA-256:</strong> <code className="font-mono">{sha256}</code>
          </div>
          {sigs.length === 0 ? (
            <p>
              Nenhum bloco de assinatura PAdES/CMS encontrado no arquivo. Útil
              para integridade (hash), mas não autentica o autor.
            </p>
          ) : (
            <ul className="space-y-2">
              {sigs.map((s, i) => (
                <li
                  key={i}
                  className={
                    "rounded border p-2 " +
                    (s.integrityOk
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-red-50 border-red-200")
                  }
                >
                  <div className="font-medium">
                    {s.integrityOk ? "✓" : "✗"} {s.signerName ?? "Signatário desconhecido"}
                    {s.isIcpBrasil && (
                      <span className="ml-2 text-[10px] uppercase bg-emerald-200 text-emerald-900 px-1 rounded">
                        ICP-Brasil
                      </span>
                    )}
                  </div>
                  {s.cpfCnpj && (
                    <div>
                      <strong>CPF/CNPJ:</strong> {fmtCpfCnpj(s.cpfCnpj)}
                    </div>
                  )}
                  {s.email && (
                    <div>
                      <strong>Email:</strong> {s.email}
                    </div>
                  )}
                  {s.issuer && (
                    <div>
                      <strong>Emissor:</strong> {s.issuer}
                    </div>
                  )}
                  <div>
                    <strong>Assinado em:</strong> {fmtDate(s.signedAt)}
                  </div>
                  <div>
                    <strong>Validade do certificado:</strong>{" "}
                    {fmtDate(s.notBefore)} → {fmtDate(s.notAfter)}
                  </div>
                  {!s.integrityOk && s.reason && (
                    <div className="text-red-800 mt-1">
                      <strong>Falha:</strong> {s.reason}
                    </div>
                  )}
                  {s.chain && (
                    <div className="mt-1">
                      <strong>Cadeia ICP-Brasil:</strong>{" "}
                      {!s.chain.configured ? (
                        <span className="text-slate-600">
                          truststore não configurado (adicione PEMs em{" "}
                          <code>certs/icpbrasil/</code>)
                        </span>
                      ) : s.chain.chainValid ? (
                        <span className="text-emerald-700">
                          válida ({s.chain.chainLength} níveis · {s.chain.storeSize}{" "}
                          certs no truststore)
                        </span>
                      ) : (
                        <span className="text-red-700">
                          inválida — {s.chain.reason}
                        </span>
                      )}
                    </div>
                  )}
                  {s.revocation === "not_checked" && (
                    <div className="text-[11px] text-slate-500">
                      Revogação (CRL/OCSP): não verificada nesta versão.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500 mt-2">
            Verificamos integridade criptográfica (hash × messageDigest do
            CMS) e identidade declarada no certificado. Validação completa da
            cadeia ICP-Brasil (com revogação) está em fase de homologação.
          </p>
        </div>
      </details>
    </div>
  );
}

function safeParse(s: string): Analysis | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
