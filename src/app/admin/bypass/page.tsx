import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/format";
import { markBypassResolvedAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminBypassPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.isAdmin) notFound();

  const cases = await prisma.auction.findMany({
    where: { bypassDetectedAt: { not: null } },
    orderBy: { bypassDetectedAt: "desc" },
    include: {
      credor: { select: { name: true, email: true, phone: true } },
      bids: {
        include: { bidder: { select: { name: true, email: true, phone: true } } },
        orderBy: { amount: "desc" },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-semibold">Admin · Bypass detectado</h1>
        <Link href="/admin" className="text-sm underline">
          ← Visão geral
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white border rounded p-6 text-center text-slate-500">
          Nenhum bypass detectado até o momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((a) => {
            const top = a.bids[0]?.amount;
            const baseCobranca =
              a.winningBid ?? top ?? (a.valorFace * a.lanceMinimoPct) / 100;
            const multa = (baseCobranca * a.commissionPct * 2) / 100;
            return (
              <li
                key={a.id}
                className="bg-red-50 border-2 border-red-300 rounded p-4 text-sm space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={`/leiloes/${a.id}`}
                      className="font-semibold underline"
                    >
                      {a.title}
                    </Link>
                    <div className="text-xs text-slate-600">
                      {a.tribunal} · Processo {a.numeroProcesso}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Detectado</div>
                    <div className="text-xs">
                      {a.bypassDetectedAt?.toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>

                {a.bypassDetail && (
                  <div className="text-xs text-red-900 bg-red-100 border border-red-200 rounded p-2">
                    {a.bypassDetail}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white border rounded p-2">
                    <div className="font-semibold mb-1">Credor</div>
                    <div>{a.credor.name}</div>
                    <div className="text-slate-600">{a.credor.email}</div>
                    {a.credor.phone && (
                      <div className="text-slate-600">{a.credor.phone}</div>
                    )}
                  </div>
                  <div className="bg-white border rounded p-2">
                    <div className="font-semibold mb-1">
                      Participantes do leilão ({a.bids.length} lance(s))
                    </div>
                    <ul className="space-y-1">
                      {a.bids.map((b) => (
                        <li key={b.id}>
                          {b.bidder.name} · {brl(b.amount)} ·{" "}
                          <span className="text-slate-500">
                            {b.bidder.email}
                            {b.bidder.phone && ` · ${b.bidder.phone}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-2 border-t border-red-200">
                  <div className="text-xs text-slate-600">
                    Valor de face: {brl(a.valorFace)}
                    {a.winningBid && (
                      <> · Arrematado: {brl(a.winningBid)}</>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Multa devida (2x comissão)</div>
                    <div className="text-lg font-bold text-red-800">
                      {brl(multa)}
                    </div>
                  </div>
                </div>

                {a.bypassResolvedAt ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs">
                    ✓ Resolvido em {a.bypassResolvedAt.toLocaleString("pt-BR")}
                    {a.bypassResolution && (
                      <div className="mt-1">
                        <strong>Resolução:</strong> {a.bypassResolution}
                      </div>
                    )}
                  </div>
                ) : (
                  <form
                    action={markBypassResolvedAction}
                    className="flex gap-2 pt-2 border-t border-red-200"
                  >
                    <input type="hidden" name="auctionId" value={a.id} />
                    <input
                      name="resolution"
                      required
                      placeholder="Como foi resolvido (ex: multa paga via PIX em XX/XX, ação proposta, acordo etc.)"
                      className="border rounded px-2 py-1 text-xs flex-1"
                    />
                    <button className="bg-emerald-700 text-white px-3 py-1.5 rounded text-xs hover:bg-emerald-800">
                      Marcar resolvido
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
