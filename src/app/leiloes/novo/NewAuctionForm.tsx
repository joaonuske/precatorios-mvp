"use client";

import { useActionState, useState, useTransition } from "react";
import { createAuctionAction, previewProcessoAction } from "@/lib/actions";
import { DatajudBadge } from "@/components/DatajudBadge";

const initialState: { error?: string } = {};

type Preview = {
  status?: string;
  message?: string;
  tribunalLabel?: string;
  classe?: string;
  orgaoJulgador?: string;
  partes?: Array<{ nome: string; polo: string }>;
  alerts?: Array<{ level: "red" | "amber"; code: string; message: string }>;
};

export function NewAuctionForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await createAuctionAction(formData);
      return res ?? {};
    },
    initialState,
  );

  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [enteDevedor, setEnteDevedor] = useState("");
  const [title, setTitle] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();

  function runPreview(value: string) {
    setPreviewError(null);
    if (!value || value.replace(/\D+/g, "").length !== 20) return;
    startPreview(async () => {
      const res = await previewProcessoAction(value);
      if ("error" in res) {
        setPreviewError(res.error ?? "Erro na consulta.");
        setPreview(null);
        return;
      }
      const r = res.result as Preview;
      setPreview(r);
      // Auto-preenche se ainda vazio
      if (r.tribunalLabel && !tribunal) setTribunal(r.tribunalLabel);
      const passivos = (r.partes ?? [])
        .filter((p) => /passiv/i.test(p.polo))
        .map((p) => p.nome);
      if (passivos[0] && !enteDevedor) setEnteDevedor(passivos[0]);
      if (r.classe && !descricao) {
        setDescricao(
          [r.classe, r.orgaoJulgador].filter(Boolean).join(" · "),
        );
      }
      if (!title && r.tribunalLabel && passivos[0]) {
        setTitle(`Precatório ${r.tribunalLabel} - ${passivos[0]}`);
      }
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">
          Nº do processo (CNJ — 20 dígitos)
        </span>
        <input
          name="numeroProcesso"
          required
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onBlur={(e) => runPreview(e.target.value)}
          placeholder="0000000-00.0000.0.00.0000"
          className="w-full border rounded px-3 py-2 font-mono"
        />
      </label>

      {isPreviewing && (
        <div className="text-xs text-slate-500">Consultando Datajud…</div>
      )}
      {previewError && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {previewError}
        </div>
      )}
      {preview && !isPreviewing && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
          <DatajudBadge
            status={preview.status}
            summary={JSON.stringify(preview)}
          />
          {preview.classe && (
            <div className="text-xs text-slate-600">
              <strong>Classe:</strong> {preview.classe}
            </div>
          )}
          {preview.partes && preview.partes.length > 0 && (
            <div className="text-xs text-slate-600">
              <strong>Partes:</strong>{" "}
              {preview.partes
                .map((p) => (p.polo ? `${p.nome} (${p.polo})` : p.nome))
                .join(" · ")}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Os campos abaixo foram pré-preenchidos a partir do Datajud quando
            possível. Você pode editar à vontade.
          </p>
        </div>
      )}

      <Field
        name="title"
        label="Título do anúncio"
        required
        value={title}
        onChange={setTitle}
      />
      <div className="grid md:grid-cols-2 gap-3">
        <Field
          name="tribunal"
          label="Tribunal"
          required
          value={tribunal}
          onChange={setTribunal}
        />
        <Field
          name="enteDevedor"
          label="Ente devedor"
          required
          value={enteDevedor}
          onChange={setEnteDevedor}
        />
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Field
          name="anoLOA"
          label="Ano LOA"
          type="number"
          required
          defaultValue="2026"
        />
        <Field
          name="valorFace"
          label="Valor de face (R$)"
          type="number"
          step="0.01"
          required
        />
        <Field
          name="lanceMinimoPct"
          label="Lance mínimo (%)"
          type="number"
          step="0.01"
          defaultValue="60"
          required
        />
      </div>
      <Field
        name="durationDays"
        label="Duração do leilão (dias)"
        type="number"
        defaultValue="20"
        required
      />
      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">Descrição (opcional)</span>
        <textarea
          name="descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="block mb-1 text-slate-700">
          Ofício requisitório (PDF, até 10MB)
        </span>
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          className="block"
        />
      </label>
      <button
        disabled={pending}
        className="bg-slate-900 text-white px-5 py-2.5 rounded hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Publicando…" : "Publicar leilão"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  step,
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        {...(controlled
          ? { value, onChange: (e) => onChange!(e.target.value) }
          : { defaultValue })}
        className="w-full border rounded px-3 py-2"
      />
    </label>
  );
}
