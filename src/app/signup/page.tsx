import { signupAction } from "@/lib/actions";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="max-w-md mx-auto bg-white border rounded p-6">
      <h1 className="text-2xl font-semibold mb-4">Criar conta</h1>
      <form action={signupAction} className="space-y-3">
        <Field name="name" label="Nome completo" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="password" label="Senha" type="password" required />
        <Field name="phone" label="Telefone (liberado ao vencedor)" />
        <Field name="document" label="CPF/CNPJ" />
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
