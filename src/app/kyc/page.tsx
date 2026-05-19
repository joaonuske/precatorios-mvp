import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCpf } from "@/lib/cpf";
import { KycForm } from "./KycForm";

export const dynamic = "force-dynamic";

export default async function KycPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Verificação de identidade (KYC)</h1>
      <p className="text-sm text-slate-600">
        Antes de publicar leilões, precisamos verificar sua identidade. Os
        dados serão usados apenas para confirmar que você é o titular do
        crédito ofertado e para a formalização da cessão.
      </p>

      {user.kycStatus === "approved" && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✓ Identidade verificada em {user.kycReviewedAt?.toLocaleDateString("pt-BR")}. Você já pode publicar leilões.
        </div>
      )}
      {user.kycStatus === "pending" && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⏳ Sua submissão está em análise pela equipe. Enviada em{" "}
          {user.kycSubmittedAt?.toLocaleDateString("pt-BR")}.
        </div>
      )}
      {user.kycStatus === "rejected" && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          ✗ Verificação rejeitada. Motivo: {user.kycRejectionReason}. Reenvie
          os dados abaixo.
        </div>
      )}

      {user.kycStatus !== "approved" && (
        <KycForm
          defaultCpf={user.kycCpf ? formatCpf(user.kycCpf) : ""}
          defaultAddress={user.kycAddress ?? ""}
        />
      )}
    </div>
  );
}
