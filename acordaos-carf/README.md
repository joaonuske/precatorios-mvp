# Gerador de Acórdãos CARF

Processa ATAs de julgamento do CARF (PDF) e gera automaticamente um arquivo
Word (.docx) para cada acórdão encontrado, preenchendo os campos do
MODELO.docx com os dados extraídos da ATA.

**100% offline.** Sem API, sem upload de arquivos para a rede, sem IA.
Todo o processamento acontece na sua máquina.

## Arquivos

```
acordaos-carf/
   interface.py             ← interface gráfica (tkinter, offline)
   gerar_acordaos.py        ← motor: extração do PDF + geração do Word
   processar_todos.py       ← lote por linha de comando (sem interface)
   criar_modelo_exemplo.py  ← gera um MODELO.docx de teste
   RODAR.bat                ← dois cliques no Windows: abre a interface
   MODELO.docx              ← template oficial (coloque o seu aqui)
   atas/                    ← coloque os PDFs das ATAs aqui
   acordaos_gerados/        ← saída (.docx + log_processamento.csv)
   tests/test_pipeline.py   ← testes automatizados
```

## Instalação (uma vez só)

```
pip install pdfplumber lxml
```

A interface usa apenas o `tkinter`, que já vem com o Python do Windows.

## Como usar

1. Copie o seu **MODELO.docx** oficial para esta pasta.
2. Coloque os PDFs das ATAs em `atas/` (ou escolha-os pela interface).
3. Dê dois cliques em **RODAR.bat** (ou rode `py interface.py`).
4. Clique em **Gerar acórdãos**. Os .docx aparecem em `acordaos_gerados/`,
   junto com o log de auditoria `log_processamento.csv` (abre no Excel).

Sem interface (linha de comando):

```
py processar_todos.py              # processa toda a pasta atas/
py gerar_acordaos.py ata.pdf       # processa uma ATA só
```

## O que é preenchido automaticamente

Número do processo, número do acórdão, câmara/turma/seção, data da sessão
por extenso, tipo de recurso (RV), recorrente, interessado, texto da
decisão ("Vistos..." + "Acordam..."), lista de conselheiros presentes e
presidente da turma.

Continuam manuais: **ementa, relatório, voto, período de apuração e temas**.

## Validação e auditoria

- Cada .docx gerado é conferido (ZIP íntegro + XMLs bem-formados) antes de
  ser dado como OK.
- Todo processamento é registrado em `acordaos_gerados/log_processamento.csv`
  com data, ATA de origem, acórdão, processo, recorrente, relator, arquivo
  gerado e status.

## Testes

```
python tests/test_pipeline.py
```

(Para o teste de ida e volta com PDF de verdade, instale também `fpdf2`;
sem ele, esse teste é pulado.)
