import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, timeRemaining } from "@/lib/format";
import { settleAllExpired } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  await settleAllExpired();
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const [meusLeiloes, meusLances] = await Promise.all([
    prisma.auction.findMany({
      where: { credorId: userId },
      orderBy: { createdAt: "desc" },
      include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
    }),
    prisma.bid.findMany({
      where: { bidderId: userId },
      orderBy: { createdAt: "desc" },
      include: { auction: true },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-xl font-semibold">Meus leilões (como credor)</h2>
          <Link
            href="/leiloes/novo"
            className="text-sm underline"
          >
            + Novo
          </Link>
        </div>
        {meusLeiloes.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border rounded p-4">
            Você ainda não ofertou nenhum precatório.
          </p>
        ) : (
          <ul className="space-y-2">
            {meusLeiloes.map((a) => (
              <li
                key={a.id}
                className="bg-white border rounded p-3 flex justify-between items-center"
              >
                <div>
                  <Link
                    href={`/leiloes/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {a.status === "active"
                      ? `Ativo · encerra em ${timeRemaining(a.endsAt)}`
                      : a.status === "pending_dd"
                      ? `Em DD · ${a.ddDeadline ? timeRemaining(a.ddDeadline) : "—"} restantes`
                      : a.status === "sold"
                      ? `Cessão confirmada por ${brl(a.winningBid ?? 0)}`
                      : a.status === "withdrawn"
                      ? `Cessão não formalizada — ${a.withdrawnReason ?? ""}`
                      : a.status === "suspended"
                      ? `Suspenso — ${a.suspendedReason ?? "alerta de integridade"}`
                      : "Expirado sem lances"}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{brl(a.valorFace)}</div>
                  <div className="text-xs text-slate-500">
                    {a.bids[0] ? `Maior lance ${brl(a.bids[0].amount)}` : "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Meus lances (como comprador)</h2>
        {meusLances.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border rounded p-4">
            Você ainda não deu lances.
          </p>
        ) : (
          <ul className="space-y-2">
            {meusLances.map((b) => (
              <li
                key={b.id}
                className="bg-white border rounded p-3 flex justify-between items-center"
              >
                <div>
                  <Link
                    href={`/leiloes/${b.auction.id}`}
                    className="font-medium hover:underline"
                  >
                    {b.auction.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    Lance: {brl(b.amount)} · {b.createdAt.toLocaleString("pt-BR")}
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {b.auction.status === "active"
                    ? `encerra em ${timeRemaining(b.auction.endsAt)}`
                    : b.auction.status === "pending_dd" &&
                      b.auction.winnerId === userId
                    ? "VOCÊ ARREMATOU — em DD"
                    : b.auction.winnerId === userId &&
                      b.auction.status === "sold"
                    ? "CESSÃO CONFIRMADA"
                    : b.auction.winnerId === userId &&
                      b.auction.status === "withdrawn"
                    ? "DESISTIU"
                    : "encerrado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
