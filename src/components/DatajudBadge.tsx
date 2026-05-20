type Props = {
  status?: string | null;
  summary?: string | null;
  compact?: boolean;
};

type Alert = { level: "red" | "amber"; code: string; message: string };

type Parsed = {
  message?: string;
  tribunalLabel?: string;
  classe?: string;
  orgaoJulgador?: string;
  partes?: Array<{ nome: string; polo: string } | string>;
  precatorioMovement?: boolean;
  alerts?: Alert[];
};

const META: Record<string, { label: string; color: string; emoji: string }> = {
  verified: {
    label: "Verificado no CNJ",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    emoji: "✓",
  },
  verified_cessionario: {
    label: "Cessionário averbado",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    emoji: "✓",
  },
  name_mismatch: {
    label: "Nome do credor não bate",
    color: "bg-amber-100 text-amber-900 border-amber-200",
    emoji: "!",
  },
  not_found: {
    label: "Processo não encontrado",
    color: "bg-red-100 text-red-800 border-red-200",
    emoji: "×",
  },
  unsupported_tribunal: {
    label: "Tribunal não consultável",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    emoji: "?",
  },
  invalid_number: {
    label: "Número CNJ inválido",
    color: "bg-red-100 text-red-800 border-red-200",
    emoji: "×",
  },
  error: {
    label: "Falha na consulta",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    emoji: "…",
  },
};

export function DatajudBadge({ status, summary, compact }: Props) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-slate-50 text-slate-500">
        Sem verificação CNJ
      </span>
    );
  }
  const m = META[status] ?? META.error;
  const parsed: Parsed | null = summary ? safeParse(summary) : null;
  const alerts = parsed?.alerts ?? [];
  const redAlerts = alerts.filter((a) => a.level === "red");
  const amberAlerts = alerts.filter((a) => a.level === "amber");

  return (
    <div className={compact ? "inline-flex flex-wrap gap-1 items-center" : "block"}>
      <span
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${m.color}`}
        title={parsed?.message ?? ""}
      >
        <span aria-hidden>{m.emoji}</span> {m.label}
        {parsed?.tribunalLabel && (
          <span className="opacity-70"> · {parsed.tribunalLabel}</span>
        )}
      </span>

      {compact ? (
        <>
          {redAlerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-red-100 text-red-800 border-red-200">
              ⚠ {redAlerts.length} alerta(s) crítico(s)
            </span>
          )}
          {amberAlerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-amber-100 text-amber-900 border-amber-200">
              ! {amberAlerts.length} inconsistência(s)
            </span>
          )}
        </>
      ) : (
        <>
          {redAlerts.length > 0 && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <div className="font-semibold mb-1">
                ⚠ Alertas críticos — possíveis impedimentos à cessão
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {redAlerts.map((a) => (
                  <li key={a.code}>{a.message}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                A presença desses movimentos sugere que o crédito pode já ter
                sido cedido, pago ou estar gravado. Confirme com certidão
                atualizada do juízo antes de prosseguir.
              </p>
            </div>
          )}
          {amberAlerts.length > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold mb-1">Inconsistências</div>
              <ul className="list-disc pl-5 space-y-1">
                {amberAlerts.map((a) => (
                  <li key={a.code}>{a.message}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed && (
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer underline">
                Detalhes da consulta CNJ
              </summary>
              <div className="mt-2 space-y-1">
                <div>{parsed.message}</div>
                {parsed.classe && (
                  <div>
                    <strong>Classe:</strong> {parsed.classe}
                  </div>
                )}
                {parsed.orgaoJulgador && (
                  <div>
                    <strong>Órgão:</strong> {parsed.orgaoJulgador}
                  </div>
                )}
                {parsed.partes && parsed.partes.length > 0 && (
                  <div>
                    <strong>Partes:</strong>{" "}
                    {parsed.partes
                      .map((p) =>
                        typeof p === "string"
                          ? p
                          : p.polo
                          ? `${p.nome} (${p.polo})`
                          : p.nome,
                      )
                      .join(" · ")}
                  </div>
                )}
                {typeof parsed.precatorioMovement === "boolean" && (
                  <div>
                    <strong>Movimento de precatório/requisitório:</strong>{" "}
                    {parsed.precatorioMovement ? "sim" : "não detectado"}
                  </div>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function safeParse(s: string): Parsed | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
