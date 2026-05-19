import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, timeRemaining } from "@/lib/format";
import {
  confirmCessionAction,
  placeBidAction,
  recheckDatajudAction,
  settleIfExpired,
  withdrawCessionAction,
} from "@/lib/actions";
import { DatajudBadge } from "@/components/DatajudBadge";
import { ProcessoTimeline } from "@/components/ProcessoTimeline";
import { PdfSignatureBadge } from "@/components/PdfSignatureBadge";

function CredorBadge({ kycStatus }: { kycStatus?: string | null }) {
  if (kycStatus === "approved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-200">
        ✓ Credor verificado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-slate-50 text-slate-500">
      Credor sem verificação
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await settleIfExpired(id);

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      credor: true,
      winner: true,
      bids: {
        orderBy: { createdAt: "desc" },
        include: { bidder: { select: { name: true } } },
      },
    },
  });
  if (!auction) notFound();

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isCredor = userId === auction.credorId;
  const isWinner = userId === auction.winnerId;
  const top = auction.bids[0]?.amount ?? 0;
  const minimo = (auction.valorFace * auction.lanceMinimoPct) / 100;
  const floor = Math.max(minimo, top + 0.01);
  const active = auction.status === "active";

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white border rounded p-5">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold">{auction.title}</h1>
              <p className="text-sm text-slate-500">
                {auction.tribunal} · Processo {auction.numeroProcesso} · LOA{" "}
                {auction.anoLOA}
              </p>
              <p className="text-sm text-slate-500">
                Devedor: {auction.enteDevedor}
              </p>
            </div>
            <span
              className={
                "text-xs px-2 py-1 rounded " +
                (active
                  ? "bg-emerald-100 text-emerald-800"
                  : auction.status === "pending_dd"
                  ? "bg-sky-100 text-sky-800"
                  : auction.status === "sold"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-700")
              }
            >
              {active
                ? `Encerra em ${timeRemaining(auction.endsAt)}`
                : auction.status === "pending_dd"
                ? `Em due diligence (${auction.ddDeadline ? timeRemaining(auction.ddDeadline) : "—"})`
                : auction.status === "sold"
                ? "Cessão confirmada"
                : auction.status === "withdrawn"
                ? "Cessão não formalizada"
                : auction.status === "suspended"
                ? "Suspenso"
                : "Expirado sem lances"}
            </span>
          </div>
          {auction.status === "suspended" && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <div className="font-semibold mb-1">
                ⚠ Leilão suspenso pela plataforma
              </div>
              <p>
                O monitoramento contínuo detectou movimentação crítica no
                processo. Lances bloqueados.
              </p>
              {auction.suspendedReason && (
                <p className="mt-2 text-xs">
                  <strong>Motivo:</strong> {auction.suspendedReason}
                </p>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {auction.credor && (
              <CredorBadge
                kycStatus={(auction.credor as { kycStatus?: string | null }).kycStatus}
              />
            )}
            <DatajudBadge
              status={auction.datajudStatus}
              summary={auction.datajudSummary}
            />
            {isCredor && (
              <form action={recheckDatajudAction.bind(null, auction.id)} className="mt-2">
                <button className="text-xs underline text-slate-600">
                  Reconsultar CNJ
                </button>
              </form>
            )}
          </div>
          {auction.descricao && (
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">
              {auction.descricao}
            </p>
          )}
          {auction.pdfPath && (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                <a
                  href={`/api/uploads/${auction.pdfPath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 underline"
                >
                  Baixar ofício requisitório (PDF)
                </a>
              </p>
              <PdfSignatureBadge
                sha256={auction.pdfSha256}
                signaturesJson={auction.pdfSignatures}
              />
            </div>
          )}
        </div>

        <div className="bg-white border rounded p-5">
          <details>
            <summary className="cursor-pointer font-semibold">
              Movimentações do processo (CNJ)
            </summary>
            <div className="mt-3">
              <ProcessoTimeline summary={auction.datajudSummary} />
            </div>
          </details>
        </div>

        <div className="bg-white border rounded p-5">
          <h2 className="font-semibold mb-3">
            Histórico de lances ({auction.bids.length})
          </h2>
          {auction.bids.length === 0 ? (
            <p className="text-sm text-slate-500">Sem lances ainda.</p>
          ) : (
            <ul className="divide-y text-sm">
              {auction.bids.map((b, i) => (
                <li
                  key={b.id}
                  className="py-2 flex justify-between items-center"
                >
                  <div>
                    <span className="font-medium">{brl(b.amount)}</span>{" "}
                    <span className="text-slate-500">
                      por {b.bidder.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {i === 0 && active ? "maior lance · " : ""}
                    {b.createdAt.toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="bg-white border rounded p-5">
          <div className="text-sm text-slate-500">Valor de face</div>
          <div className="text-xl font-semibold">{brl(auction.valorFace)}</div>
          <div className="mt-3 text-sm text-slate-500">Lance atual</div>
          <div className="text-xl font-semibold">
            {top > 0 ? brl(top) : "—"}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Lance mínimo: {brl(minimo)} ({auction.lanceMinimoPct}%)
          </div>
          <div className="text-xs text-slate-500">
            Comissão do comprador: {auction.commissionPct}% sobre o
            arrematado
          </div>
        </div>

        {active && !isCredor && (
          <div className="bg-white border rounded p-5">
            <h3 className="font-semibold mb-2">Dar um lance</h3>
            {userId ? (
              <form action={placeBidAction} className="space-y-2">
                <input type="hidden" name="auctionId" value={auction.id} />
                <label className="block text-sm">
                  <span className="block mb-1 text-slate-700">
                    Valor (mínimo {brl(floor)})
                  </span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min={floor}
                    required
                    className="w-full border rounded px-3 py-2"
                  />
                </label>
                <button className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-700">
                  Confirmar lance
                </button>
                <p className="text-xs text-slate-500">
                  Lances nos últimos 5 minutos estendem o leilão.
                </p>
              </form>
            ) : (
              <Link href="/login" className="text-sm underline">
                Entrar para dar um lance
              </Link>
            )}
          </div>
        )}

        {active && isCredor && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
            Você é o credor deste leilão e não pode dar lances.
          </div>
        )}

        {auction.status === "pending_dd" && (isCredor || isWinner) && (
          <div className="bg-sky-50 border border-sky-200 rounded p-4 text-sm space-y-2">
            <div className="font-semibold">
              Janela de due diligence —{" "}
              {auction.ddDeadline ? timeRemaining(auction.ddDeadline) : "—"}
            </div>
            <p className="text-slate-700">
              Lance vencedor: <strong>{brl(auction.winningBid ?? 0)}</strong>.
              Os contatos abaixo foram liberados pro arrematante verificar o
              crédito antes da cessão.
            </p>
            <div>
              <strong>Credor:</strong> {auction.credor.name}
              {auction.credor.phone && <> · {auction.credor.phone}</>}
              <br />
              <span className="text-slate-600">{auction.credor.email}</span>
            </div>
            {auction.winner && (
              <div>
                <strong>Arrematante:</strong> {auction.winner.name}
                {auction.winner.phone && <> · {auction.winner.phone}</>}
                <br />
                <span className="text-slate-600">{auction.winner.email}</span>
              </div>
            )}
            {isWinner && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <form action={confirmCessionAction.bind(null, auction.id)}>
                  <button className="w-full bg-emerald-700 text-white py-2 rounded hover:bg-emerald-800">
                    Confirmar cessão
                  </button>
                </form>
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-700 underline">
                    Desistir
                  </summary>
                  <form action={withdrawCessionAction} className="mt-2 space-y-2">
                    <input type="hidden" name="auctionId" value={auction.id} />
                    <textarea
                      name="reason"
                      rows={3}
                      required
                      placeholder="Motivo (ex: certidão atualizada mostrou penhora)"
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <button className="w-full bg-red-700 text-white py-2 rounded hover:bg-red-800">
                      Confirmar desistência
                    </button>
                  </form>
                </details>
                <p className="text-xs text-slate-500">
                  Sem ação no prazo, o leilão é encerrado sem cessão e o credor
                  pode republicar.
                </p>
              </div>
            )}
            {isCredor && (
              <p className="text-xs text-slate-500 mt-2 border-t pt-2">
                O arrematante tem até{" "}
                {auction.ddDeadline?.toLocaleString("pt-BR")} para confirmar.
                Nenhuma comissão é devida até a confirmação.
              </p>
            )}
          </div>
        )}

        {auction.status === "withdrawn" && (isCredor || isWinner) && (
          <div className="bg-slate-100 border border-slate-200 rounded p-4 text-sm">
            <div className="font-semibold mb-1">
              Cessão não foi formalizada
            </div>
            {auction.withdrawnReason && (
              <p className="text-slate-700 mb-2">
                <strong>Motivo:</strong> {auction.withdrawnReason}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Nenhuma comissão é devida. O credor pode publicar um novo leilão
              do mesmo precatório.
            </p>
          </div>
        )}

        {!active && auction.status === "sold" && (isCredor || isWinner) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-sm">
            <div className="font-semibold mb-1">Cessão confirmada</div>
            <div>Valor arrematado: {brl(auction.winningBid ?? 0)}</div>
            <div className="mt-2">
              <strong>Credor:</strong> {auction.credor.name}
              {auction.credor.phone && <> · {auction.credor.phone}</>}
              <br />
              <span className="text-slate-600">{auction.credor.email}</span>
            </div>
            {auction.winner && (
              <div className="mt-2">
                <strong>Comprador:</strong> {auction.winner.name}
                {auction.winner.phone && <> · {auction.winner.phone}</>}
                <br />
                <span className="text-slate-600">{auction.winner.email}</span>
              </div>
            )}
            <div className="mt-2 text-xs text-slate-600">
              Comissão devida pelo comprador:{" "}
              {brl(
                ((auction.winningBid ?? 0) * auction.commissionPct) / 100,
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
