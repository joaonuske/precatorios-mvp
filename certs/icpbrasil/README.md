# Truststore ICP-Brasil

Para ativar a validação completa da cadeia de certificados, baixe os PEMs
oficiais publicados pelo ITI e coloque-os neste diretório:

  https://estrutura.iti.gov.br/repositorio/

Tipicamente:
- `ACraiz.crt` — AC Raiz ICP-Brasil (atual: V5)
- Certificados de ACs de nível 1 (intermediárias) — opcional; em geral o
  próprio CMS do PDF já carrega as intermediárias necessárias.

Formatos aceitos: `.pem`, `.crt`, `.cer` (PEM ou DER).

Após adicionar os arquivos, o servidor recarrega o truststore
automaticamente (no máximo a cada 60 segundos).
