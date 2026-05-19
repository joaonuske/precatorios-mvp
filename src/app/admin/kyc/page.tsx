import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCpf } from "@/lib/cpf";
import { approveKycAction, rejectKycAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.isAdmin) notFound();

  const submissions = await prisma.user.findMany({
    where: { kycStatus: { in: ["pending", "rejected", "approved"] } },
    orderBy: [{ kycStatus: "asc" }, { kycSubmittedAt: "desc" }],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin · KYC dos credores</h1>
      {submissions.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma submissão.</p>
      ) : (
        <ul className="space-y-3">
          {submissions.map((u) => (
            <li key={u.id} className="bg-white border rounded p-4 text-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.email} · CPF {u.kycCpf ? formatCpf(u.kycCpf) : "—"} ·
                    nasc. {u.kycBirthDate?.toLocaleDateString("pt-BR") ?? "—"}
                  </div>
                </div>
                <Badge status={u.kycStatus} />
              </div>
              <div className="text-xs text-slate-600 mb-2">
                <strong>Endereço:</strong> {u.kycAddress ?? "—"}
              </div>
              {u.kycDocPath && (
                <div className="text-xs">
                  <a
                    href={`/api/uploads/kyc/${u.kycDocPath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline"
                  >
                    Ver documento enviado
                  </a>
                </div>
              )}
              {u.kycRejectionReason && (
                <div className="text-xs text-red-700 mt-1">
                  Motivo da rejeição: {u.kycRejectionReason}
                </div>
              )}
              {u.kycStatus !== "approved" && (
                <div className="mt-3 flex flex-wrap gap-2 items-start">
                  <form action={approveKycAction.bind(null, u.id)}>
                    <button className="bg-emerald-700 text-white px-3 py-1.5 rounded text-xs hover:bg-emerald-800">
                      Aprovar
                    </button>
                  </form>
                  <form action={rejectKycAction} className="flex gap-2 items-start">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      name="reason"
                      placeholder="Motivo da rejeição"
                      required
                      className="border rounded px-2 py-1 text-xs"
                    />
                    <button className="bg-red-700 text-white px-3 py-1.5 rounded text-xs hover:bg-red-800">
                      Rejeitar
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800" },
    pending: { label: "Pendente", cls: "bg-amber-100 text-amber-900" },
    rejected: { label: "Rejeitado", cls: "bg-red-100 text-red-800" },
  };
  const m = (status && map[status]) || { label: "—", cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>
  );
}
