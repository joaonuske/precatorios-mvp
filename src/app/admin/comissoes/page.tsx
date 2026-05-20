import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/format";
import {
  markCommissionPaidAction,
  markCommissionWaivedAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminComissoesPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.isAdmin) notFound();

  const sold = await prisma.auction.findMany({
    where: { status: "sold" },
    orderBy: [
      { commissionStatus: "asc" }, // pending vem antes de paid
      { confirmedAt: "desc" },
    ],
    include: {
      credor: { select: { name: true, email: true } },
      winner: { select: { name: true, email: true, phone: true } },
    },
  });

  const pending = sold.filter((a) => a.commissionStatus !== "paid" && a.commissionStatus !== "waived");
  const settled = sold.filter((a) => a.commissionStatus === "paid" || a.commissionStatus === "waived");

  const totalPending = pending.reduce(
    (s, a) => s + ((a.winningBid ?? 0) * a.commissionPct) / 100,
    0,
  );
  const totalPaid = settled
    .filter((a) => a.commissionStatus === "paid")
    .reduce((s, a) => s + ((a.winningBid ?? 0) * a.commissionPct) / 100, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-semibold">Admin · Comissões</h1>
        <Link href="/admin" className="text-sm underline">
          ← Visão geral
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded p-4">
          <div className="text-xs uppercase tracking-wide text-amber-900 opacity-80">
            A cobrar
          </div>
          <div className="text-2xl font-bold text-amber-900">{brl(totalPending)}</div>
          <div className="text-xs text-amber-800">{pending.length} caso(s)</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-900 opacity-80">
            Recebido
          </div>
          <div className="text-2xl font-bold text-emerald-900">{brl(totalPaid)}</div>
          <div className="text-xs text-emerald-800">
            {settled.filter((a) => a.commissionStatus === "paid").length} caso(s)
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Pendentes de pagamento</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border rounded p-4">
            Nenhuma comissão pendente.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <CommissionCard key={a.id} a={a} mode="pending" />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Histórico</h2>
        {settled.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border rounded p-4">
            Sem registros ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {settled.map((a) => (
              <CommissionCard key={a.id} a={a} mode="settled" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type AuctionRow = {
  id: string;
  title: string;
  numeroProcesso: string;
  tribunal: string;
  winningBid: number | null;
  commissionPct: number;
  commissionStatus: string | null;
  commissionPaidAt: Date | null;
  commissionPaidMethod: string | null;
  commissionPaidNote: string | null;
  commissionWaivedReason: string | null;
  confirmedAt: Date | null;
  winner: { name: string; email: string; phone: string | null } | null;
  credor: { name: string; email: string };
};

function CommissionCard({ a, mode }: { a: AuctionRow; mode: "pending" | "settled" }) {
  const valor = ((a.winningBid ?? 0) * a.commissionPct) / 100;
  return (
    <li
      className={
        "border rounded p-4 text-sm space-y-2 " +
        (mode === "pending"
          ? "bg-white border-amber-200"
          : a.commissionStatus === "waived"
            ? "bg-slate-50 border-slate-200"
            : "bg-emerald-50 border-emerald-200")
      }
    >
      <div className="flex justify-between items-start">
        <div>
          <Link
            href={`/leiloes/${a.id}`}
            className="font-semibold underline"
          >
            {a.title}
          </Link>
          <div className="text-xs text-slate-500">
            {a.tribunal} · {a.numeroProcesso}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Comissão ({a.commissionPct}%)</div>
          <div className="text-lg font-bold">{brl(valor)}</div>
        </div>
      </div>

      {a.winner && (
        <div className="text-xs text-slate-700">
          <strong>Devedor da comissão:</strong> {a.winner.name} ·{" "}
          {a.winner.email}
          {a.winner.phone && ` · ${a.winner.phone}`}
        </div>
      )}

      {mode === "settled" ? (
        <div className="text-xs">
          {a.commissionStatus === "paid" ? (
            <>
              ✓ Pago em{" "}
              <strong>{a.commissionPaidAt?.toLocaleString("pt-BR")}</strong>
              {a.commissionPaidMethod && ` via ${a.commissionPaidMethod.toUpperCase()}`}
              {a.commissionPaidNote && (
                <div className="mt-1 text-slate-600">
                  Obs: {a.commissionPaidNote}
                </div>
              )}
            </>
          ) : (
            <>
              ⊘ Dispensada em{" "}
              <strong>{a.commissionPaidAt?.toLocaleString("pt-BR")}</strong>
              {a.commissionWaivedReason && (
                <div className="mt-1 text-slate-600">
                  Motivo: {a.commissionWaivedReason}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-amber-200">
          <form action={markCommissionPaidAction} className="space-y-2">
            <input type="hidden" name="auctionId" value={a.id} />
            <div className="flex gap-2 items-center">
              <select
                name="method"
                className="border rounded px-2 py-1 text-xs"
              >
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="other">Outro</option>
              </select>
              <input
                name="note"
                placeholder="Observação (opcional)"
                className="border rounded px-2 py-1 text-xs flex-1"
              />
            </div>
            <button className="w-full bg-emerald-700 text-white px-3 py-1.5 rounded text-xs hover:bg-emerald-800">
              Marcar como paga
            </button>
          </form>
          <form action={markCommissionWaivedAction} className="space-y-2">
            <input type="hidden" name="auctionId" value={a.id} />
            <input
              name="reason"
              placeholder="Motivo da dispensa (obrigatório)"
              required
              className="w-full border rounded px-2 py-1 text-xs"
            />
            <button className="w-full bg-slate-600 text-white px-3 py-1.5 rounded text-xs hover:bg-slate-700">
              Dispensar
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
