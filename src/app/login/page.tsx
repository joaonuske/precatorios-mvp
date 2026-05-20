import { loginAction } from "@/lib/actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="max-w-md mx-auto bg-white border rounded p-6">
      <h1 className="text-2xl font-semibold mb-4">Entrar</h1>
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error === "credenciais"
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar."}
        </div>
      )}
      <form action={loginAction} className="space-y-3">
        <label className="block text-sm">
          <span className="block mb-1 text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-slate-700">Senha</span>
          <input
            name="password"
            type="password"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <button className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-700">
          Entrar
        </button>
      </form>
      <p className="text-sm text-slate-600 mt-4">
        Não tem conta?{" "}
        <Link href="/signup" className="underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
