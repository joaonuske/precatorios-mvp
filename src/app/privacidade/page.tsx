export default function PrivacidadePage() {
  return (
    <article className="max-w-3xl mx-auto bg-white border rounded p-6 prose prose-slate prose-sm">
      <h1>Política de Privacidade</h1>
      <p className="text-xs text-slate-500">
        Última atualização em 20/05/2026.
      </p>

      <h2>1. Quem somos e o que coletamos</h2>
      <p>
        A <strong>Precatórios MVP</strong> opera o presente marketplace de
        precatórios e, na qualidade de controladora de dados pessoais (LGPD —
        Lei nº 13.709/2018), trata os seguintes dados:
      </p>
      <ul>
        <li><strong>Identificação:</strong> nome, e-mail, telefone, CPF/CNPJ, data de nascimento, endereço;</li>
        <li><strong>Documentos:</strong> foto do RG ou CNH (frente e verso) enviados na verificação de identidade;</li>
        <li><strong>Dados processuais:</strong> nº CNJ do processo, dados públicos retornados pelo CNJ Datajud, ofício requisitório em PDF;</li>
        <li><strong>Dados de uso:</strong> lances, leilões, mensagens trocadas na plataforma, registros de acesso (logs).</li>
      </ul>

      <h2>2. Bases legais (art. 7º da LGPD)</h2>
      <ul>
        <li>
          <strong>Execução de contrato</strong> (art. 7º, V): autenticação,
          publicação de leilões, intermediação de cessão, cobrança de comissão.
        </li>
        <li>
          <strong>Cumprimento de obrigação legal/regulatória</strong> (art. 7º,
          II): retenção fiscal, prevenção à fraude, atendimento a ordens
          judiciais.
        </li>
        <li>
          <strong>Legítimo interesse</strong> (art. 7º, IX): verificações
          anti-fraude (Datajud, hash de PDF, monitoramento pós-leilão),
          melhoria do serviço, segurança da plataforma.
        </li>
        <li>
          <strong>Consentimento</strong>: comunicações de marketing
          (opt-in/opt-out explícito), quando aplicável.
        </li>
      </ul>

      <h2>3. Compartilhamento</h2>
      <p>
        Os dados pessoais são compartilhados estritamente com:
      </p>
      <ul>
        <li>
          <strong>A contraparte do leilão</strong>, no momento da arrematação:
          nome, e-mail, telefone do credor e do arrematante, para
          viabilizar a formalização da cessão.
        </li>
        <li>
          <strong>Operadores tecnológicos:</strong> provedor de hospedagem
          (Railway), banco de dados (PostgreSQL gerenciado), CNJ Datajud (API
          pública), eventualmente fornecedores de pagamento (PIX, cartão) e
          assinatura eletrônica.
        </li>
        <li>
          <strong>Autoridades:</strong> mediante requisição legal devidamente
          fundamentada (judicial, Receita Federal, Polícia Federal, etc.).
        </li>
      </ul>

      <h2>4. Retenção</h2>
      <p>
        Dados de identificação e KYC são retidos enquanto a conta estiver
        ativa e por até <strong>5 anos</strong> após o encerramento, para fins
        de auditoria, defesa em processos e cumprimento de obrigações fiscais.
        Documentos públicos de processos judiciais e snapshots do Datajud são
        retidos enquanto necessário para a prova do estado do crédito no
        momento da transação.
      </p>

      <h2>5. Direitos do titular</h2>
      <p>
        Você tem direito a, a qualquer tempo, requisitar:
      </p>
      <ul>
        <li>Confirmação da existência de tratamento de dados;</li>
        <li>Acesso aos dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>Portabilidade dos dados;</li>
        <li>Eliminação dos dados tratados com base no seu consentimento;</li>
        <li>Informação sobre compartilhamentos;</li>
        <li>Revogação do consentimento.</li>
      </ul>
      <p>
        Para exercer qualquer desses direitos, escreva pelo formulário de
        contato ou direto pelo e-mail informado em seu cadastro.
      </p>

      <h2>6. Segurança</h2>
      <p>
        Adotamos controles técnicos compatíveis com o estado da arte:
        criptografia em trânsito (TLS), armazenamento de senhas com bcrypt,
        controle de acesso por papel (RBAC: usuário, admin), volumes
        persistentes com acesso restrito, e validação criptográfica de
        documentos.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Utilizamos cookies estritamente necessários para autenticação (sessão
        JWT). Não usamos cookies de marketing ou de análise de terceiros.
      </p>

      <h2>8. DPO / Encarregado</h2>
      <p>
        O Encarregado pelo Tratamento de Dados Pessoais pode ser contatado pelo
        e-mail informado na página de contato. Em caso de incidente ou
        violação, comunique-nos imediatamente.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Esta Política pode ser alterada a qualquer tempo. A versão vigente é
        sempre a publicada nesta página.
      </p>
    </article>
  );
}
