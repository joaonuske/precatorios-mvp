// CNJ Datajud — consulta pública de processos judiciais
// Documentação: https://datajud-wiki.cnj.jus.br/api-publica/acesso

const BASE = "https://api-publica.datajud.cnj.jus.br";

const STATE_TRIBUNAL_BY_CODE: Record<string, string> = {
  "01": "tjac", "02": "tjal", "03": "tjap", "04": "tjam", "05": "tjba",
  "06": "tjce", "07": "tjdft", "08": "tjes", "09": "tjgo", "10": "tjma",
  "11": "tjmt", "12": "tjms", "13": "tjmg", "14": "tjpa", "15": "tjpb",
  "16": "tjpr", "17": "tjpe", "18": "tjpi", "19": "tjrj", "20": "tjrn",
  "21": "tjrs", "22": "tjro", "23": "tjrr", "24": "tjsc", "25": "tjse",
  "26": "tjsp", "27": "tjto",
};

const FEDERAL_TRIBUNAL_BY_CODE: Record<string, string> = {
  "01": "trf1", "02": "trf2", "03": "trf3", "04": "trf4", "05": "trf5", "06": "trf6",
};

const LABOR_TRIBUNAL_BY_CODE: Record<string, string> = {
  "01": "trt1", "02": "trt2", "03": "trt3", "04": "trt4", "05": "trt5",
  "06": "trt6", "07": "trt7", "08": "trt8", "09": "trt9", "10": "trt10",
  "11": "trt11", "12": "trt12", "13": "trt13", "14": "trt14", "15": "trt15",
  "16": "trt16", "17": "trt17", "18": "trt18", "19": "trt19", "20": "trt20",
  "21": "trt21", "22": "trt22", "23": "trt23", "24": "trt24",
};

export type ParsedCnj = {
  digits: string;
  segment: string;
  tribunalCode: string;
  endpoint: string | null;
  tribunalLabel: string | null;
};

export function parseCnjNumber(input: string): ParsedCnj | null {
  const digits = input.replace(/\D+/g, "");
  if (digits.length !== 20) return null;
  const segment = digits[13];
  const tribunalCode = digits.slice(14, 16);

  let endpoint: string | null = null;
  let label: string | null = null;
  if (segment === "1") {
    endpoint = "stf";
    label = "STF";
  } else if (segment === "3") {
    if (tribunalCode === "00") {
      endpoint = "stj";
      label = "STJ";
    }
  } else if (segment === "4") {
    endpoint = FEDERAL_TRIBUNAL_BY_CODE[tribunalCode] ?? null;
    label = endpoint?.toUpperCase() ?? null;
  } else if (segment === "5") {
    if (tribunalCode === "00") {
      endpoint = "tst";
      label = "TST";
    } else {
      endpoint = LABOR_TRIBUNAL_BY_CODE[tribunalCode] ?? null;
      label = endpoint?.toUpperCase() ?? null;
    }
  } else if (segment === "6") {
    if (tribunalCode === "00") {
      endpoint = "tse";
      label = "TSE";
    }
  } else if (segment === "8") {
    endpoint = STATE_TRIBUNAL_BY_CODE[tribunalCode] ?? null;
    label = endpoint ? endpoint.toUpperCase() : null;
  }

  return { digits, segment, tribunalCode, endpoint, tribunalLabel: label };
}

export type DatajudAlert = {
  level: "red" | "amber";
  code: string;
  message: string;
};

export type DatajudParte = { nome: string; polo: string };

export type DatajudMovimento = {
  nome: string;
  dataHora?: string;
  flag?: "cessao" | "pagamento" | "penhora" | "precatorio";
};

export type DatajudResult = {
  status:
    | "verified"
    | "verified_cessionario"
    | "name_mismatch"
    | "not_found"
    | "unsupported_tribunal"
    | "invalid_number"
    | "error";
  message: string;
  tribunalLabel?: string | null;
  classe?: string;
  orgaoJulgador?: string;
  partes?: DatajudParte[];
  precatorioMovement?: boolean;
  alerts?: DatajudAlert[];
  movimentos?: DatajudMovimento[];
  lastUpdate?: string;
  cessionarioInfo?: { dataHora?: string; description: string };
  raw?: unknown;
};

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(credor: string, partes: string[]): boolean {
  const c = normalizeName(credor);
  if (!c) return false;
  const tokens = c.split(" ").filter((t) => t.length >= 4);
  if (tokens.length === 0) return false;
  for (const p of partes) {
    const np = normalizeName(p);
    const matched = tokens.filter((t) => np.includes(t)).length;
    if (matched >= Math.min(2, tokens.length)) return true;
  }
  return false;
}

// Padrões de movimentos críticos (TPU / nomes livres dos tribunais)
const CRITICAL_PATTERNS: Array<{ re: RegExp; code: string; label: string }> = [
  {
    re: /cess[aã]o\s+de\s+cr[eé]dito|habilita[cç][aã]o\s+de\s+cession[aá]rio|cession[aá]rio/i,
    code: "cessao_anterior",
    label: "Cessão/habilitação de cessionário detectada",
  },
  {
    re: /pagamento|quita[cç][aã]o|levantamento\s+de\s+valor|alvar[aá]|liquida[cç][aã]o\s+do\s+pagamento/i,
    code: "pagamento",
    label: "Movimento de pagamento/quitação detectado",
  },
  {
    re: /penhora|arresto|sequestro|bloqueio\s+(de\s+)?(valor|cr[eé]dito|bens)/i,
    code: "penhora",
    label: "Penhora/arresto/bloqueio detectado",
  },
];

function detectCriticalAlerts(
  movimentos: Array<{ nome?: string; dataHora?: string }>,
): DatajudAlert[] {
  const alerts: DatajudAlert[] = [];
  const seen = new Set<string>();
  for (const m of movimentos) {
    const nome = m.nome ?? "";
    for (const p of CRITICAL_PATTERNS) {
      if (p.re.test(nome) && !seen.has(p.code)) {
        seen.add(p.code);
        const dt = m.dataHora ? ` em ${m.dataHora.slice(0, 10)}` : "";
        alerts.push({
          level: "red",
          code: p.code,
          message: `${p.label}${dt}: "${nome}".`,
        });
      }
    }
  }
  return alerts;
}

export async function lookupProcesso(
  numeroProcesso: string,
  credorName: string,
  declared?: { tribunal?: string; enteDevedor?: string },
): Promise<DatajudResult> {
  const parsed = parseCnjNumber(numeroProcesso);
  if (!parsed) {
    return {
      status: "invalid_number",
      message: "Número CNJ inválido (esperado 20 dígitos).",
    };
  }
  if (!parsed.endpoint) {
    return {
      status: "unsupported_tribunal",
      message: `Tribunal não suportado (segmento ${parsed.segment}, código ${parsed.tribunalCode}).`,
      tribunalLabel: parsed.tribunalLabel,
    };
  }
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return { status: "error", message: "DATAJUD_API_KEY não configurada." };
  }

  const url = `${BASE}/api_publica_${parsed.endpoint}/_search`;
  let body: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `APIKey ${apiKey}`,
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: parsed.digits } },
      }),
      cache: "no-store",
    });
    body = await res.json();
    if (!res.ok) {
      return {
        status: "error",
        message: `Datajud respondeu ${res.status}`,
        tribunalLabel: parsed.tribunalLabel,
        raw: body,
      };
    }
  } catch (err) {
    return {
      status: "error",
      message: "Falha ao consultar Datajud: " + (err as Error).message,
      tribunalLabel: parsed.tribunalLabel,
    };
  }

  const hits =
    (body as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } })
      ?.hits?.hits ?? [];
  if (hits.length === 0) {
    return {
      status: "not_found",
      message: "Processo não encontrado no Datajud.",
      tribunalLabel: parsed.tribunalLabel,
    };
  }

  const source = hits[0]._source as {
    classe?: { nome?: string };
    orgaoJulgador?: { nome?: string };
    partes?: Array<{ nome?: string; polo?: string }>;
    movimentos?: Array<{ nome?: string; dataHora?: string; complementosTabelados?: Array<{ descricao?: string; valor?: string }> }>;
    dataHoraUltimaAtualizacao?: string;
    "@timestamp"?: string;
  };

  const partes: DatajudParte[] = (source.partes ?? []).map((p) => ({
    nome: p.nome ?? "",
    polo: p.polo ?? "",
  }));
  const movimentos = source.movimentos ?? [];
  const precatorio = movimentos.some((m) =>
    /precat[oó]rio|requisit[oó]rio/i.test(m.nome ?? ""),
  );

  const ativos = partes.filter((p) => /ativ/i.test(p.polo)).map((p) => p.nome);
  const passivos = partes
    .filter((p) => /passiv/i.test(p.polo))
    .map((p) => p.nome);
  const candidatosCredor =
    ativos.length > 0 ? ativos : partes.map((p) => p.nome);
  const matchCredor = nameMatches(credorName, candidatosCredor);

  const alerts: DatajudAlert[] = detectCriticalAlerts(movimentos);

  const movimentosOut: DatajudMovimento[] = movimentos.map((m) => {
    const nome = m.nome ?? "";
    let flag: DatajudMovimento["flag"] | undefined;
    if (/cess[aã]o|cession[aá]rio/i.test(nome)) flag = "cessao";
    else if (/pagamento|quita[cç][aã]o|levantamento|alvar[aá]|liquida[cç][aã]o/i.test(nome))
      flag = "pagamento";
    else if (/penhora|arresto|sequestro|bloqueio/i.test(nome)) flag = "penhora";
    else if (/precat[oó]rio|requisit[oó]rio/i.test(nome)) flag = "precatorio";
    return { nome, dataHora: m.dataHora, flag };
  });

  // Consistência: tribunal declarado vs detectado
  if (declared?.tribunal && parsed.tribunalLabel) {
    const decl = normalizeName(declared.tribunal);
    const real = normalizeName(parsed.tribunalLabel);
    if (decl && real && !decl.includes(real) && !real.includes(decl)) {
      alerts.push({
        level: "amber",
        code: "tribunal_mismatch",
        message: `Tribunal declarado "${declared.tribunal}" não bate com o detectado pelo número CNJ (${parsed.tribunalLabel}).`,
      });
    }
  }

  // Consistência: ente devedor declarado vs polo passivo
  if (declared?.enteDevedor && passivos.length > 0) {
    const ok = nameMatches(declared.enteDevedor, passivos);
    if (!ok) {
      alerts.push({
        level: "amber",
        code: "ente_devedor_mismatch",
        message: `Ente devedor declarado "${declared.enteDevedor}" não corresponde ao polo passivo no Datajud (${passivos.join(", ")}).`,
      });
    }
  }

  // Se nome não bateu nas partes, procurar como cessionário averbado nas movimentações
  let cessionarioInfo: { dataHora?: string; description: string } | undefined;
  if (!matchCredor) {
    const tokens = normalizeName(credorName)
      .split(" ")
      .filter((t) => t.length >= 4);
    if (tokens.length > 0) {
      for (const m of movimentos) {
        const nome = m.nome ?? "";
        if (!/cess[aã]o|cession[aá]rio|habilita|substitui[cç][aã]o/i.test(nome)) continue;
        // Junta nome do movimento + complementos tabelados (onde costuma vir o nome do cessionário)
        const complementos = (m.complementosTabelados ?? [])
          .map((c) => c.descricao + " " + (c.valor ?? ""))
          .join(" ");
        const haystack = normalizeName(nome + " " + complementos);
        const matched = tokens.filter((t) => haystack.includes(t)).length;
        if (matched >= Math.min(2, tokens.length)) {
          cessionarioInfo = { dataHora: m.dataHora, description: nome };
          break;
        }
      }
    }
  }

  const lastUpdate = source.dataHoraUltimaAtualizacao ?? source["@timestamp"];

  const finalStatus = matchCredor
    ? "verified"
    : cessionarioInfo
      ? "verified_cessionario"
      : "name_mismatch";

  return {
    status: finalStatus,
    message: matchCredor
      ? "Processo localizado e nome do credor compatível com uma das partes."
      : cessionarioInfo
        ? `Processo localizado. Credor encontrado nas movimentações como cessionário averbado${cessionarioInfo.dataHora ? ` em ${cessionarioInfo.dataHora.slice(0, 10)}` : ""}.`
        : "Processo localizado, mas o nome do credor não bate com nenhuma parte. Verifique grafia ou se há cessão anterior.",
    tribunalLabel: parsed.tribunalLabel,
    classe: source.classe?.nome,
    orgaoJulgador: source.orgaoJulgador?.nome,
    partes,
    precatorioMovement: precatorio,
    alerts,
    movimentos: movimentosOut,
    lastUpdate,
    cessionarioInfo,
  };
}
