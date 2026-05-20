import Link from "next/link";
import { signupAction } from "@/lib/actions";

const ERRORS: Record<string, string> = {
  existe: "Esse e-mail já está cadastrado. Faça login ou use outro endereço.",
  dados: "Dados inválidos. Verifique os campos (senha mínima de 6 caracteres).",
  termos: "Você precisa aceitar os Termos de Uso e a Política de Privacidade.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="max-w-md mx-auto bg-white border rounded p-6">
      <h1 className="text-2xl font-semibold mb-4">Criar conta</h1>
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {ERRORS[error] ?? "Erro ao criar conta."}
        </div>
      )}
      <form action={signupAction} className="space-y-3">
        <Field name="name" label="Nome completo" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="password" label="Senha" type="password" required />
        <Field name="phone" label="Telefone (liberado ao vencedor)" />
        <Field name="document" label="CPF/CNPJ" />
        <label className="flex items-start gap-2 text-sm pt-2">
          <input type="checkbox" name="acceptTos" required className="mt-1" />
          <span className="text-slate-700">
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="underline">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        <button className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-700">
          Criar conta
        </button>
      </form>
      <p className="text-sm text-slate-600 mt-4">
        Já tem conta?{" "}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full border rounded px-3 py-2"
      />
    </label>
  );
}
