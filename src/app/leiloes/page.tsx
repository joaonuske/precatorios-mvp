import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { brl, timeRemaining } from "@/lib/format";
import { settleAllExpired } from "@/lib/actions";
import { DatajudBadge } from "@/components/DatajudBadge";

export const dynamic = "force-dynamic";

type SortKey = "ends_asc" | "ends_desc" | "face_desc" | "face_asc" | "recent" | "desagio_desc";

export default async function LeiloesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ente?: string;
    tribunal?: string;
    min?: string;
    max?: string;
    sort?: SortKey;
  }>;
}) {
  await settleAllExpired();
  const params = await searchParams;
  const sort: SortKey = (params.sort as SortKey) ?? "ends_asc";

  const where: {
    status: string;
    enteDevedor?: { contains: string; mode: "insensitive" };
    tribunal?: { contains: string; mode: "insensitive" };
    valorFace?: { gte?: number; lte?: number };
  } = { status: "active" };
  if (params.ente)
    where.enteDevedor = { contains: params.ente, mode: "insensitive" };
  if (params.tribunal)
    where.tribunal = { contains: params.tribunal, mode: "insensitive" };
  if (params.min || params.max) {
    where.valorFace = {};
    if (params.min) where.valorFace.gte = Number(params.min);
    if (params.max) where.valorFace.lte = Number(params.max);
  }

  const orderBy = (() => {
    switch (sort) {
      case "ends_desc":
        return { endsAt: "desc" } as const;
      case "face_desc":
        return { valorFace: "desc" } as const;
      case "face_asc":
        return { valorFace: "asc" } as const;
      case "recent":
        return { createdAt: "desc" } as const;
      case "desagio_desc":
      case "ends_asc":
      default:
        return { endsAt: "asc" } as const;
    }
  })();

  let auctions = await prisma.auction.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { bids: true } },
      bids: { orderBy: { amount: "desc" }, take: 1 },
      credor: { select: { kycStatus: true } },
    },
  });

  // Ordenação por deságio feita em JS (precisa do lance atual vs valor de face)
  if (sort === "desagio_desc") {
    auctions = auctions
      .map((a) => {
        const top = a.bids[0]?.amount ?? a.valorFace * (a.lanceMinimoPct / 100);
        const desagio = (a.valorFace - top) / a.valorFace;
        return { a, desagio };
      })
      .sort((x, y) => y.desagio - x.desagio)
      .map((x) => x.a);
  }

  const SORT_LABELS: Record<SortKey, string> = {
    ends_asc: "Encerra antes",
    ends_desc: "Encerra depois",
    face_desc: "Maior valor de face",
    face_asc: "Menor valor de face",
    recent: "Publicação recente",
    desagio_desc: "Maior deságio",
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-semibold">Leilões ativos</h1>
        <Link
          href="/leiloes/novo"
          className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-700"
        >
          + Ofertar precatório
        </Link>
      </div>

      <form className="bg-white border rounded p-3 mb-4 flex flex-wrap gap-2 text-sm items-center">
        <input
          name="ente"
          defaultValue={params.ente ?? ""}
          placeholder="Ente devedor"
          className="border rounded px-2 py-1"
        />
        <input
          name="tribunal"
          defaultValue={params.tribunal ?? ""}
          placeholder="Tribunal (TRF3, TJSP…)"
          className="border rounded px-2 py-1 w-44"
        />
        <input
          name="min"
          defaultValue={params.min ?? ""}
          placeholder="Valor mín."
          type="number"
          className="border rounded px-2 py-1 w-32"
        />
        <input
          name="max"
          defaultValue={params.max ?? ""}
          placeholder="Valor máx."
          type="number"
          className="border rounded px-2 py-1 w-32"
        />
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Ordenar:
          <select
            name="sort"
            defaultValue={sort}
            className="border rounded px-2 py-1 text-sm"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <button className="border rounded px-3 py-1 hover:bg-slate-50">
          Aplicar
        </button>
        <Link
          href="/leiloes"
          className="text-xs text-slate-500 underline ml-auto"
        >
          Limpar
        </Link>
      </form>

      {auctions.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center text-slate-500">
          Nenhum leilão ativo no momento.
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-3">
            {auctions.length} leilão(ões) encontrado(s) · ordenado por{" "}
            <strong>{SORT_LABELS[sort]}</strong>
          </p>
          <ul className="grid md:grid-cols-2 gap-3">
            {auctions.map((a) => {
              const top = a.bids[0]?.amount;
              const minimo = (a.valorFace * a.lanceMinimoPct) / 100;
              const desagio =
                top !== undefined
                  ? ((a.valorFace - top) / a.valorFace) * 100
                  : null;
              return (
                <li key={a.id}>
                  <Link
                    href={`/leiloes/${a.id}`}
                    className="block bg-white border rounded p-4 hover:border-slate-400"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h2 className="font-semibold">{a.title}</h2>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        {timeRemaining(a.endsAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {a.tribunal} · {a.enteDevedor} · LOA {a.anoLOA}
                    </p>
                    <div className="mt-3 text-sm">
                      <div>
                        Valor de face: <strong>{brl(a.valorFace)}</strong>
                      </div>
                      <div>
                        Lance atual:{" "}
                        <strong>{top ? brl(top) : "sem lances"}</strong>
                        {desagio !== null && (
                          <span className="ml-2 text-xs text-emerald-700">
                            (-{desagio.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500">
                        Mínimo: {brl(minimo)} · {a._count.bids} lance(s)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 items-center">
                        <DatajudBadge
                          status={a.datajudStatus}
                          summary={a.datajudSummary}
                          compact
                        />
                        {a.credor.kycStatus === "approved" && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
                            ✓ Credor verificado
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
