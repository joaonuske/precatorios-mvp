export const TOS_VERSION = "2026.05.20";

export default function TermosPage() {
  return (
    <article className="max-w-3xl mx-auto bg-white border rounded p-6 prose prose-slate prose-sm">
      <h1>Termos de Uso</h1>
      <p className="text-xs text-slate-500">
        Vigência a partir de {TOS_VERSION}. Última atualização em 20/05/2026.
      </p>

      <h2>1. Sobre a plataforma</h2>
      <p>
        A <strong>Precatórios MVP</strong> (&quot;Plataforma&quot;) é um
        marketplace que conecta credores titulares de precatórios judiciais
        (&quot;Credores&quot;) a interessados em adquirir esses créditos
        (&quot;Compradores&quot;). A Plataforma <strong>apenas intermedeia</strong>{" "}
        o contato e o processo de leilão; a formalização da cessão de crédito é
        responsabilidade exclusiva das partes.
      </p>

      <h2>2. Cadastro e verificação de identidade (KYC)</h2>
      <p>
        Para publicar leilões, o Credor deve concluir a verificação de
        identidade enviando CPF, data de nascimento, endereço e documento com
        foto (frente e verso). O Credor declara, sob as penas da lei, que:
      </p>
      <ul>
        <li>É o titular original ou cessionário averbado do crédito ofertado;</li>
        <li>O crédito não foi cedido a terceiros nem dado em garantia;</li>
        <li>
          Não há penhora, arresto, bloqueio ou qualquer ônus que impeça a livre
          cessão;
        </li>
        <li>Os documentos enviados são verdadeiros e atuais.</li>
      </ul>
      <p>
        Falsidade em qualquer dessas declarações constitui crime previsto nos
        arts. 171 (estelionato) e 299 (falsidade ideológica) do Código Penal, sem
        prejuízo das sanções civis e contratuais previstas neste instrumento.
      </p>

      <h2>3. Funcionamento do leilão</h2>
      <p>
        Cada leilão tem duração inicial de 20 dias, lance mínimo definido pelo
        Credor (padrão de 60% do valor de face do precatório) e mecanismo de{" "}
        <em>soft close</em>: lances nos últimos 5 minutos estendem
        automaticamente o prazo. Encerrado o leilão com lance vencedor, abre-se
        uma janela de <strong>due diligence de 7 dias</strong> em que o
        Comprador pode auditar o crédito antes de formalizar a cessão.
      </p>

      <h2>4. Comissão da Plataforma</h2>
      <p>
        Sobre o valor arrematado é devida à Plataforma uma comissão de{" "}
        <strong>5% (cinco por cento)</strong>, paga exclusivamente pelo
        Comprador.
      </p>
      <p>
        A comissão é devida no momento em que o Comprador confirma a cessão ao
        término da janela de due diligence (status <code>sold</code>). Em caso
        de desistência no prazo de DD ou expiração sem ação, nenhuma comissão é
        cobrada.
      </p>
      <p>
        O Comprador autoriza a Plataforma a emitir cobrança (PIX, boleto ou
        cartão) pelo valor da comissão. O não pagamento no prazo sujeita o
        inadimplente a:
      </p>
      <ul>
        <li>Multa de 2% sobre o valor devido;</li>
        <li>Juros de mora de 1% ao mês;</li>
        <li>Correção monetária pelo IPCA;</li>
        <li>Protesto extrajudicial e inclusão em cadastros restritivos;</li>
        <li>Cobrança judicial, com honorários sucumbenciais.</li>
      </ul>

      <h2>5. Bypass (cessão fora da plataforma)</h2>
      <p>
        Caracteriza-se como <strong>bypass</strong> a hipótese em que Credor e
        Comprador, após se conhecerem por meio desta Plataforma, formalizam a
        cessão do crédito objeto do leilão fora da Plataforma com o objetivo de
        evitar o pagamento da comissão.
      </p>
      <p>
        A Plataforma monitora periodicamente o sistema CNJ Datajud por até{" "}
        <strong>90 dias após o encerramento</strong> de qualquer leilão e, se
        detectar movimentação de cessão averbada em favor de participante do
        leilão sem o devido recolhimento da comissão, fica caracterizado o
        bypass. Nesse caso, é devida à Plataforma <strong>multa
        contratual de 2x (duas vezes) o valor da comissão</strong> que seria
        originalmente cobrada, sem prejuízo das medidas previstas na cláusula 4.
      </p>

      <h2>6. Responsabilidade pela autenticidade do crédito</h2>
      <p>
        A Plataforma realiza verificações automáticas no CNJ Datajud, valida o
        hash SHA-256 dos PDFs enviados e, quando possível, extrai assinaturas
        digitais ICP-Brasil. <strong>Essas verificações são auxiliares e não
        substituem</strong> a diligência do Comprador. O Comprador é
        responsável por confirmar, durante a janela de DD, o estado atualizado
        do crédito junto ao juízo competente.
      </p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>
        A Plataforma não responde por inadimplência do ente devedor do
        precatório, atraso no pagamento por parte do tribunal, ações
        rescisórias, decisões judiciais supervenientes ou qualquer fato que
        afete o valor ou exigibilidade do crédito cedido.
      </p>

      <h2>8. Modificações dos termos</h2>
      <p>
        Estes Termos podem ser alterados a qualquer tempo. A versão vigente é
        sempre a publicada nesta página. Continuar utilizando a Plataforma após
        alterações implica aceitação tácita.
      </p>

      <h2>9. Foro</h2>
      <p>
        Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer
        controvérsias decorrentes destes Termos, com renúncia expressa a
        qualquer outro, por mais privilegiado que seja.
      </p>
    </article>
  );
}
