import Link from "next/link";

export default function Home() {
  return (
    <div className="py-12">
      <h1 className="text-4xl font-bold mb-4">
        Negocie precatórios com transparência
      </h1>
      <p className="text-lg text-slate-600 max-w-2xl mb-8">
        Credores cadastram seus créditos e recebem lances de compradores
        durante 20 dias. Leilão aberto, lance mínimo definido pelo credor,
        encerramento com extensão automática se houver lance no final.
      </p>
      <div className="flex gap-3">
        <Link
          href="/leiloes"
          className="bg-slate-900 text-white px-5 py-2.5 rounded hover:bg-slate-700"
        >
          Ver leilões ativos
        </Link>
        <Link
          href="/signup"
          className="border border-slate-300 px-5 py-2.5 rounded hover:bg-white"
        >
          Criar conta
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        <Card title="1. Credor cadastra">
          Envia ofício requisitório, define lance mínimo (mín. 60% do valor de
          face) e duração do leilão.
        </Card>
        <Card title="2. Compradores dão lances">
          Durante 20 dias o leilão fica aberto. Lances no fim estendem o prazo
          em 5 minutos (soft close).
        </Card>
        <Card title="3. Cessão direta">
          Ao encerrar, os contatos são liberados e a cessão é formalizada entre
          as partes. Plataforma cobra 5% do comprador.
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded p-5">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{children}</p>
    </div>
  );
}
