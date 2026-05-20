"use client";

import { useActionState } from "react";
import { submitKycAction } from "@/lib/actions";

export function KycForm({
  defaultCpf,
  defaultAddress,
}: {
  defaultCpf: string;
  defaultAddress: string;
}) {
  const [state, formAction, pending] = useActionState(submitKycAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">CPF</span>
        <input
          name="cpf"
          required
          defaultValue={defaultCpf}
          placeholder="000.000.000-00"
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">Data de nascimento</span>
        <input
          name="birthDate"
          type="date"
          required
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">Endereço completo</span>
        <textarea
          name="address"
          rows={2}
          required
          defaultValue={defaultAddress}
          placeholder="Rua, número, bairro, cidade/UF, CEP"
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block mb-1 text-slate-700">
            Documento — <strong>frente</strong> (JPG/PNG/PDF, até 8MB)
          </span>
          <input
            name="docId"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block"
          />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-slate-700">
            Documento — <strong>verso</strong> (opcional; obrigatório se for RG)
          </span>
          <input
            name="docIdBack"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block"
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="declaration" className="mt-1" required />
        <span className="text-slate-700">
          Declaro, sob as penas da lei, que (a) sou o titular original dos
          créditos que ofertarei na plataforma; (b) os créditos não foram
          cedidos a terceiros nem dados em garantia; (c) não há penhora,
          arresto ou bloqueio que impeçam a livre cessão; (d) os documentos
          enviados são verdadeiros e atuais.
        </span>
      </label>
      <button
        disabled={pending}
        className="bg-slate-900 text-white px-5 py-2.5 rounded hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar para análise"}
      </button>
    </form>
  );
}
