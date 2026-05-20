type Movimento = {
  nome: string;
  dataHora?: string;
  flag?: "cessao" | "pagamento" | "penhora" | "precatorio";
};

const FLAG_STYLE: Record<NonNullable<Movimento["flag"]>, { dot: string; label: string }> = {
  cessao: { dot: "bg-red-600", label: "cessão" },
  pagamento: { dot: "bg-red-600", label: "pagamento" },
  penhora: { dot: "bg-red-600", label: "penhora" },
  precatorio: { dot: "bg-sky-600", label: "precatório" },
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ProcessoTimeline({
  summary,
}: {
  summary?: string | null;
}) {
  const parsed = summary ? safeParse(summary) : null;
  const movs: Movimento[] = parsed?.movimentos ?? [];
  const lastUpdate = parsed?.lastUpdate;

  if (movs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Sem movimentações disponíveis. Caso o leilão tenha sido criado antes
        desta atualização, o credor pode clicar em &ldquo;Reconsultar CNJ&rdquo;
        acima para carregar a timeline.
      </p>
    );
  }

  return (
    <>
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
        ⚠ Dados refletem o estado do processo no CNJ Datajud
        {lastUpdate ? ` até ${fmtDate(lastUpdate)}` : ""}. O CNJ é alimentado
        pelos tribunais com latência de semanas. Para movimentos posteriores,
        consulte diretamente o sistema do tribunal.
      </div>
      <ol className="relative border-l border-slate-200 ml-3 space-y-3">
      {movs.map((m, i) => {
        const style = m.flag ? FLAG_STYLE[m.flag] : null;
        return (
          <li key={i} className="ml-4">
            <span
              className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border border-white ${
                style?.dot ?? "bg-slate-400"
              }`}
            />
            <div className="text-xs text-slate-500">{fmtDate(m.dataHora)}</div>
            <div className="text-sm">
              {m.nome}
              {style && (
                <span
                  className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    m.flag === "precatorio"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {style.label}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
    </>
  );
}

function safeParse(s: string): { movimentos?: Movimento[]; lastUpdate?: string } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
