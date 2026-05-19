import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { brl, timeRemaining } from "@/lib/format";
import { settleAllExpired } from "@/lib/actions";
import { DatajudBadge } from "@/components/DatajudBadge";

export const dynamic = "force-dynamic";

export default async function LeiloesPage({
  searchParams,
}: {
  searchParams: Promise<{ ente?: string; min?: string; max?: string }>;
}) {
  await settleAllExpired();
  const params = await searchParams;
  const where: {
    status: string;
    enteDevedor?: { contains: string };
    valorFace?: { gte?: number; lte?: number };
  } = { status: "active" };
  if (params.ente) where.enteDevedor = { contains: params.ente };
  if (params.min || params.max) {
    where.valorFace = {};
    if (params.min) where.valorFace.gte = Number(params.min);
    if (params.max) where.valorFace.lte = Number(params.max);
  }

  const auctions = await prisma.auction.findMany({
    where,
    orderBy: { endsAt: "asc" },
    include: {
      _count: { select: { bids: true } },
      bids: { orderBy: { amount: "desc" }, take: 1 },
      credor: { select: { kycStatus: true } },
    },
  });

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

      <form className="bg-white border rounded p-3 mb-4 flex flex-wrap gap-2 text-sm">
        <input
          name="ente"
          defaultValue={params.ente ?? ""}
          placeholder="Ente devedor"
          className="border rounded px-2 py-1"
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
        <button className="border rounded px-3 py-1 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {auctions.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center text-slate-500">
          Nenhum leilão ativo no momento.
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {auctions.map((a) => {
            const top = a.bids[0]?.amount;
            const minimo = (a.valorFace * a.lanceMinimoPct) / 100;
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
                      Valor de face:{" "}
                      <strong>{brl(a.valorFace)}</strong>
                    </div>
                    <div>
                      Lance atual:{" "}
                      <strong>{top ? brl(top) : "sem lances"}</strong>
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
      )}
    </div>
  );
}
