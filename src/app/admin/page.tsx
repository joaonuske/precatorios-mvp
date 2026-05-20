import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUSES = [
  "active",
  "pending_dd",
  "sold",
  "withdrawn",
  "expired",
  "suspended",
] as const;

const STATUS_LABEL: Record<string, string> = {
  active: "Ativos",
  pending_dd: "Em DD",
  sold: "Cessão confirmada",
  withdrawn: "Desistência",
  expired: "Expirados sem lances",
  suspended: "Suspensos",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-50 border-emerald-200 text-emerald-900",
  pending_dd: "bg-sky-50 border-sky-200 text-sky-900",
  sold: "bg-emerald-100 border-emerald-300 text-emerald-900",
  withdrawn: "bg-slate-50 border-slate-200 text-slate-700",
  expired: "bg-slate-50 border-slate-200 text-slate-700",
  suspended: "bg-red-50 border-red-200 text-red-900",
};

export default async function AdminPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.isAdmin) notFound();

  // Contagens e somas por status
  const grouped = await prisma.auction.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { valorFace: true, winningBid: true },
  });

  const byStatus: Record<
    string,
    { count: number; valorFace: number; winningBid: number }
  > = {};
  for (const g of grouped) {
    byStatus[g.status] = {
      count: g._count._all,
      valorFace: g._sum.valorFace ?? 0,
      winningBid: g._sum.winningBid ?? 0,
    };
  }

  // Comissão potencial: 5% das pending_dd + sold (a confirmar e a confirmadas)
  // Comissão realizada: 5% das sold
  const allSettled = await prisma.auction.findMany({
    where: { status: { in: ["pending_dd", "sold"] } },
    select: {
      status: true,
      winningBid: true,
      commissionPct: true,
      bypassDetectedAt: true,
    },
  });
  let comissaoPotencial = 0;
  let comissaoRealizada = 0;
  let comissaoBypass = 0;
  for (const a of allSettled) {
    const c = ((a.winningBid ?? 0) * a.commissionPct) / 100;
    if (a.status === "sold") comissaoRealizada += c;
    if (a.status === "pending_dd") comissaoPotencial += c;
  }
  // Bypass: dobra a comissão
  const bypass = await prisma.auction.findMany({
    where: { bypassDetectedAt: { not: null } },
    select: { winningBid: true, commissionPct: true, valorFace: true, lanceMinimoPct: true },
  });
  for (const a of bypass) {
    const base =
      a.winningBid ?? (a.valorFace * a.lanceMinimoPct) / 100;
    comissaoBypass += (base * a.commissionPct * 2) / 100;
  }

  // KYC stats
  const kycGrouped = await prisma.user.groupBy({
    by: ["kycStatus"],
    _count: { _all: true },
  });
  const kycCounts: Record<string, number> = {};
  for (const g of kycGrouped) {
    kycCounts[g.kycStatus ?? "none"] = g._count._all;
  }
  const totalUsers = await prisma.user.count();

  // Conversion
  const ddTotal =
    (byStatus["pending_dd"]?.count ?? 0) +
    (byStatus["sold"]?.count ?? 0) +
    (byStatus["withdrawn"]?.count ?? 0);
  const conversionRate =
    ddTotal > 0 ? ((byStatus["sold"]?.count ?? 0) / ddTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-semibold">Admin · Visão Geral</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/kyc" className="underline">
            KYC
          </Link>
          <Link href="/admin/bypass" className="underline">
            Bypass
          </Link>
          <Link href="/admin/debug" className="underline">
            Debug
          </Link>
        </nav>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          Leilões por status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STATUSES.map((s) => {
            const d = byStatus[s] ?? { count: 0, valorFace: 0, winningBid: 0 };
            return (
              <div
                key={s}
                className={`border rounded p-3 ${STATUS_COLOR[s] ?? "bg-white border-slate-200"}`}
              >
                <div className="text-xs uppercase tracking-wide opacity-70">
                  {STATUS_LABEL[s] ?? s}
                </div>
                <div className="text-2xl font-bold">{d.count}</div>
                <div className="text-xs opacity-80 mt-1">
                  Face total: {brl(d.valorFace)}
                </div>
                {(s === "pending_dd" || s === "sold") && d.winningBid > 0 && (
                  <div className="text-xs opacity-80">
                    Arrematado: {brl(d.winningBid)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          Comissão
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Card label="Comissão realizada (sold)" value={brl(comissaoRealizada)} color="bg-emerald-50 border-emerald-200" />
          <Card label="Comissão potencial (pending_dd)" value={brl(comissaoPotencial)} color="bg-sky-50 border-sky-200" />
          <Card
            label="Multa de bypass devida (2x)"
            value={brl(comissaoBypass)}
            color="bg-red-50 border-red-200"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Taxa de conversão pending_dd → sold: <strong>{conversionRate.toFixed(1)}%</strong>{" "}
          ({byStatus["sold"]?.count ?? 0} / {ddTotal})
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          Usuários · KYC
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Total" value={String(totalUsers)} color="bg-white border-slate-200" />
          <Card
            label="KYC aprovado"
            value={String(kycCounts["approved"] ?? 0)}
            color="bg-emerald-50 border-emerald-200"
          />
          <Card
            label="KYC pendente"
            value={String(kycCounts["pending"] ?? 0)}
            color="bg-amber-50 border-amber-200"
          />
          <Card
            label="KYC rejeitado / s/ verificação"
            value={String(
              (kycCounts["rejected"] ?? 0) + (kycCounts["none"] ?? 0),
            )}
            color="bg-slate-50 border-slate-200"
          />
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`border rounded p-3 ${color}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
