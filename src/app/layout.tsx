import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/lib/actions";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Precatórios MVP",
  description: "Marketplace de cessão de precatórios",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = session?.user;
  const dbUser = (user as { id?: string } | undefined)?.id
    ? await prisma.user.findUnique({
        where: { id: (user as { id: string }).id },
        select: { isAdmin: true, kycStatus: true },
      })
    : null;
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">
              Precatórios MVP
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/leiloes" className="hover:underline">
                Leilões
              </Link>
              {user ? (
                <>
                  <Link href="/leiloes/novo" className="hover:underline">
                    Ofertar precatório
                  </Link>
                  <Link href="/painel" className="hover:underline">
                    Painel
                  </Link>
                  <Link
                    href="/kyc"
                    className={
                      "hover:underline " +
                      (dbUser?.kycStatus === "approved"
                        ? "text-emerald-700"
                        : "text-amber-700")
                    }
                  >
                    KYC{dbUser?.kycStatus === "approved" ? " ✓" : dbUser?.kycStatus === "pending" ? " ⏳" : ""}
                  </Link>
                  {dbUser?.isAdmin && (
                    <Link href="/admin/kyc" className="hover:underline">
                      Admin
                    </Link>
                  )}
                  <span className="text-slate-500">{user.name}</span>
                  <form action={logoutAction}>
                    <button className="text-slate-600 hover:underline">
                      Sair
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:underline">
                    Entrar
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-700"
                  >
                    Criar conta
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          {children}
        </main>
        <footer className="border-t bg-white text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2">
            <span>
              MVP — apenas conecta as partes. Validação do crédito é
              responsabilidade do comprador.
            </span>
            <span className="flex gap-3">
              <Link href="/termos" className="hover:underline">
                Termos
              </Link>
              <Link href="/privacidade" className="hover:underline">
                Privacidade
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
