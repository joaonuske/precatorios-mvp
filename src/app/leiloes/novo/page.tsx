import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewAuctionForm } from "./NewAuctionForm";

export default async function NovoLeilaoPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user?.kycStatus !== "approved") {
    return (
      <div className="max-w-2xl mx-auto bg-white border rounded p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Verificação necessária</h1>
        {user?.kycStatus === "pending" && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
            Sua identidade está em análise. Você poderá publicar leilões assim
            que for aprovada.
          </p>
        )}
        {user?.kycStatus === "rejected" && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
            Sua verificação foi rejeitada: {user.kycRejectionReason}. Reenvie
            seus dados em <Link href="/kyc" className="underline">/kyc</Link>.
          </p>
        )}
        {!user?.kycStatus && (
          <p className="text-sm text-slate-700">
            Antes de publicar um leilão, você precisa concluir a verificação
            de identidade.
          </p>
        )}
        <Link
          href="/kyc"
          className="inline-block bg-slate-900 text-white px-5 py-2.5 rounded hover:bg-slate-700"
        >
          Ir para verificação de identidade
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded p-6">
      <h1 className="text-2xl font-semibold mb-4">Ofertar precatório</h1>
      <p className="text-sm text-slate-600 mb-6">
        Preencha os dados do crédito. O leilão fica ativo por 20 dias com lance
        mínimo de <strong>60% do valor de face</strong> (você pode ajustar).
        Ao publicar, consultamos automaticamente o número CNJ na API pública do{" "}
        <strong>Datajud / CNJ</strong> e cruzamos com o seu nome cadastrado.
      </p>
      <NewAuctionForm />
    </div>
  );
}
