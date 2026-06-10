#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de acórdãos CARF.

Lê uma ATA de julgamento do CARF (PDF nativo, não OCR) e gera um arquivo
Word (.docx) para cada acórdão encontrado, preenchendo o MODELO.docx.

Funciona 100% offline: nenhum dado sai da máquina.

Uso:
    python gerar_acordaos.py <ata.pdf> [pasta_saida]

Dependências:
    pip install pdfplumber lxml
"""

import csv
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

from lxml import etree

PASTA_BASE = Path(__file__).resolve().parent
MODELO_PADRAO = PASTA_BASE / 'MODELO.docx'
SAIDA_PADRAO = PASTA_BASE / 'acordaos_gerados'

NS_DADOS = 'Decisoes'

# ---------------------------------------------------------------------------
# Extração do PDF
# ---------------------------------------------------------------------------

RE_ACORDAO_SPLIT = re.compile(r'(ACÓRDÃO\s+\d{4}-\d{3}\.\d{3})')
RE_NUM_ACORDAO = re.compile(r'ACÓRDÃO\s+(\d{4}-\d{3}\.\d{3})')

RE_PARTICIPANTES = re.compile(
    r'estando presentes os conselheiros\s+(.*?),\s+a fim de', re.S)
RE_SETOR = re.compile(
    r'(\d+ª\s+SEÇÃO/\d+ª\s+CÂMARA/\d+ª\s+TURMA\s+ORDINÁRIA)')
RE_DATA = re.compile(
    r'Aos?\s+(?P<dia>[a-zà-ü\s]+?)\s+dias?\s+do\s+m[eê]s\s+de\s+'
    r'(?P<mes>[a-zç]+)\s+(?:do\s+ano\s+)?de\s+'
    r'(?P<ano>dois\s+mil[a-zà-ü\s]*?)\s*[,.;]',
    re.I)

RE_PROCESSO = re.compile(r'Processo:\s*([\d./\-]+)')
RE_RECORRENTE = re.compile(
    r'Recorrente:\s*([^\n]+?)(?:\s+e\s+Interessado:|\n)')
RE_INTERESSADO = re.compile(
    r'Interessado:\s*([^\n]+(?:\n(?!Processo:|Relator|ACÓRDÃO|Decisão)[^\n]+)*)')
RE_RELATOR = re.compile(r'Relator\(?a\)?:\s*([^\n]+)')
RE_DECISAO = re.compile(
    r'Decisão:\s*(Acordam\s+os\s+membros.*?)(?=\s*(?:Ausente|Fez\s+sustenta|$))',
    re.S)

UNIDADES = {
    'primeiro': 1, 'um': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
    'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9,
}
ESPECIAIS = {
    'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13, 'catorze': 14,
    'quatorze': 14, 'quinze': 15, 'dezesseis': 16, 'dezessete': 17,
    'dezoito': 18, 'dezenove': 19,
}
DEZENAS = {
    'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50,
    'sessenta': 60, 'setenta': 70, 'oitenta': 80, 'noventa': 90,
}


def palavras_para_numero(texto):
    """Converte número por extenso ("vinte e seis", "dois mil e vinte e seis")."""
    tokens = [t for t in re.split(r'[\s,]+', texto.lower().strip())
              if t and t != 'e']
    total = 0
    atual = 0
    for tok in tokens:
        if tok == 'mil':
            atual = (atual or 1) * 1000
            total += atual
            atual = 0
        elif tok in UNIDADES:
            atual += UNIDADES[tok]
        elif tok in ESPECIAIS:
            atual += ESPECIAIS[tok]
        elif tok in DEZENAS:
            atual += DEZENAS[tok]
        else:
            return None
    resultado = total + atual
    return resultado or None


def extrair_data(texto):
    """Extrai a data da sessão por extenso e devolve "03 de fevereiro de 2026"."""
    m = RE_DATA.search(texto)
    if not m:
        return ''
    dia = palavras_para_numero(m.group('dia'))
    ano = palavras_para_numero(m.group('ano'))
    mes = m.group('mes').lower()
    if not dia or not ano:
        return ''
    return f'{dia:02d} de {mes} de {ano}'


def limpar_nome_conselheiro(nome):
    # remove "(substituto integral)" e similares, mas mantém "(Presidente)"
    nome = re.sub(r'\s*\((?!Presidente)[^)]*\)', '', nome)
    return re.sub(r'\s+', ' ', nome).strip()


def extrair_participantes(texto):
    m = RE_PARTICIPANTES.search(texto)
    if not m:
        return [], ''
    trecho = re.sub(r'\s+', ' ', m.group(1)).strip()
    brutos = re.split(r',\s*|\s+e\s+(?=[A-ZÀ-Ü])', trecho)
    nomes = [limpar_nome_conselheiro(n) for n in brutos]
    nomes = [n for n in nomes if n]
    presidente = ''
    for n in nomes:
        if '(Presidente)' in n:
            presidente = re.sub(r'\s*\(Presidente\)', '', n).strip()
            break
    return nomes, presidente


def extrair_acordaos(texto):
    """Divide o texto da ATA em blocos de acórdão e extrai os campos de cada um."""
    blocos = RE_ACORDAO_SPLIT.split(texto)
    acordaos = []
    # blocos[0] = cabeçalho; depois pares (marcador "ACÓRDÃO N", corpo)
    for i in range(1, len(blocos) - 1, 2):
        numero = RE_NUM_ACORDAO.search(blocos[i]).group(1)
        corpo = blocos[i + 1]

        def busca(regex):
            m = regex.search(corpo)
            return re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''

        acordaos.append({
            'numero': numero,
            'processo': busca(RE_PROCESSO),
            'recorrente': busca(RE_RECORRENTE),
            'interessado': busca(RE_INTERESSADO) or 'FAZENDA NACIONAL',
            'relator': busca(RE_RELATOR),
            'decisao': busca(RE_DECISAO),
        })
    return acordaos


def extrair_texto_pdf(pdf_path):
    import pdfplumber
    paginas = []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in pdf.pages:
            paginas.append(pagina.extract_text() or '')
    return '\n'.join(paginas)


def extrair_dados_ata(texto):
    """Devolve (cabecalho, lista_de_acordaos) a partir do texto completo da ATA."""
    participantes, presidente = extrair_participantes(texto)
    m_setor = RE_SETOR.search(texto)
    cabecalho = {
        'data': extrair_data(texto),
        'setor': m_setor.group(1) if m_setor else '',
        'participantes': participantes,
        'presidente': presidente,
    }
    return cabecalho, extrair_acordaos(texto)


# ---------------------------------------------------------------------------
# Geração do Word
# ---------------------------------------------------------------------------

CAMPOS_CUSTOM_XML = (
    'l1NumProcesso', 'l2NumAto', 'siglaSetor', 'l3DataDoc',
    'l4LstRecurso', 'l5TxtRecorrente', 'l7TxtRecorrida',
)


def montar_dados_documento(cabecalho, acordao):
    """Mapeia cabeçalho + acórdão para os campos do modelo."""
    return {
        'l1NumProcesso': acordao['processo'],
        'l2NumAto': acordao['numero'],
        'siglaSetor': cabecalho['setor'],
        'l3DataDoc': cabecalho['data'],
        'l4LstRecurso': 'RV',
        'l5TxtRecorrente': acordao['recorrente'],
        'l7TxtRecorrida': acordao['interessado'],
        'decisao': acordao['decisao'],
        'relator': acordao['relator'],
        'participantes': cabecalho['participantes'],
        'presidente': cabecalho['presidente'],
    }


def atualizar_custom_xml(xml_bytes, dados):
    """Atualiza customXml/item1.xml — fonte dos Content Controls com dataBinding."""
    root = etree.fromstring(xml_bytes)
    ns = {'d': NS_DADOS}
    for campo in CAMPOS_CUSTOM_XML:
        el = root.find(f'd:{campo}', ns)
        if el is None:
            el = etree.SubElement(root, f'{{{NS_DADOS}}}{campo}')
        el.text = dados[campo]
    return etree.tostring(root, xml_declaration=True, encoding='UTF-8',
                          standalone=True)


def _substituir_sdt_simples(xml, tag, valor):
    """Atualiza o cache <w:sdtContent> de um campo de texto simples.

    O Word exibe o cache do sdtContent ao abrir, não o customXml — por isso
    os dois precisam ser atualizados.
    """
    valor_esc = escape(valor)
    padrao = re.compile(
        r'(<w:tag w:val="%s"[^>]*/?>)(.*?)(<w:sdtContent[^>]*>)(.*?)(</w:sdtContent>)'
        % re.escape(tag), re.S)

    def repl(m):
        interno = m.group(4)
        contador = {'n': 0}

        def sub_t(mt):
            contador['n'] += 1
            texto = valor_esc if contador['n'] == 1 else ''
            return f'<w:t xml:space="preserve">{texto}</w:t>'

        novo = re.sub(r'<w:t(?:\s[^>]*)?>.*?</w:t>', sub_t, interno, flags=re.S)
        if contador['n'] == 0:
            novo = interno + f'<w:r><w:t xml:space="preserve">{valor_esc}</w:t></w:r>'
        return m.group(1) + m.group(2) + m.group(3) + novo + m.group(5)

    novo_xml, n = padrao.subn(repl, xml, count=1)
    if n == 0:
        print(f'  AVISO: campo "{tag}" não encontrado no modelo')
    return novo_xml


def _substituir_sdt_bloco(xml, tag, conteudo):
    """Substitui todo o conteúdo de um Content Control de bloco (parágrafos)."""
    padrao = re.compile(
        r'(<w:tag w:val="%s"[^>]*/?>.*?<w:sdtContent[^>]*>).*?(</w:sdtContent>)'
        % re.escape(tag), re.S)
    novo_xml, n = padrao.subn(lambda m: m.group(1) + conteudo + m.group(2),
                              xml, count=1)
    if n == 0:
        print(f'  AVISO: campo "{tag}" não encontrado no modelo')
    return novo_xml


def _paragrafo(texto, estilo='Texto', estilo_caractere=None):
    rpr = (f'<w:rPr><w:rStyle w:val="{estilo_caractere}"/></w:rPr>'
           if estilo_caractere else '')
    ppr = f'<w:pPr><w:pStyle w:val="{estilo}"/>{rpr}</w:pPr>'
    return (f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{escape(texto)}</w:t>'
            f'</w:r></w:p>')


def atualizar_document_xml(xml, dados):
    """Atualiza os caches visuais dos Content Controls em word/document.xml."""
    for campo in CAMPOS_CUSTOM_XML:
        xml = _substituir_sdt_simples(xml, campo, dados[campo])

    # attDecisao: "Vistos..." + texto da decisão extraído da ATA
    decisao = (
        _paragrafo('Vistos, relatados e discutidos os presentes autos.')
        + _paragrafo(dados['decisao'], estilo_caractere='AcrdoChar')
    )
    xml = _substituir_sdt_bloco(xml, 'attDecisao', decisao)

    participantes = (
        'Participaram do presente julgamento os Conselheiros: '
        + ', '.join(dados['participantes']) + '.'
    )
    xml = _substituir_sdt_bloco(xml, 'Participantes',
                                _paragrafo(participantes))
    xml = _substituir_sdt_bloco(xml, 'Presidente de Turma',
                                _paragrafo(dados['presidente']))
    return xml


def gerar_docx(modelo_path, dados, saida_path):
    """Gera um .docx a partir do modelo, atualizando customXml e cache SDT."""
    saida_path = Path(saida_path)
    saida_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(modelo_path) as zip_in, \
            zipfile.ZipFile(saida_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
        for item in zip_in.infolist():
            conteudo = zip_in.read(item.filename)
            if item.filename == 'customXml/item1.xml':
                conteudo = atualizar_custom_xml(conteudo, dados)
            elif item.filename == 'word/document.xml':
                conteudo = atualizar_document_xml(
                    conteudo.decode('utf-8'), dados).encode('utf-8')
            zip_out.writestr(item, conteudo)
    return saida_path


def validar_docx(docx_path):
    """Confere se o .docx gerado é um ZIP íntegro com XMLs bem-formados.

    Devolve lista de erros (vazia = ok).
    """
    erros = []
    try:
        with zipfile.ZipFile(docx_path) as zf:
            corrompido = zf.testzip()
            if corrompido:
                erros.append(f'arquivo corrompido no ZIP: {corrompido}')
            for nome in zf.namelist():
                if nome.endswith(('.xml', '.rels')):
                    try:
                        etree.fromstring(zf.read(nome))
                    except etree.XMLSyntaxError as e:
                        erros.append(f'{nome}: XML inválido ({e})')
    except (zipfile.BadZipFile, OSError) as e:
        erros.append(f'não foi possível abrir o .docx: {e}')
    return erros


def nome_arquivo_saida(acordao):
    """ACC_{PROCESSO_SEM_PONTUACAO}_{RECORRENTE_SNAKE_CASE}.docx"""
    processo = acordao['processo'].replace('.', '').replace('/', '-')
    recorrente = re.sub(r'[^A-Za-z0-9À-ü]+', '_', acordao['recorrente']).strip('_')
    return f'ACC_{processo}_{recorrente}.docx'


# ---------------------------------------------------------------------------
# Processamento de uma ATA
# ---------------------------------------------------------------------------

def processar_ata(pdf_path, saida_dir=SAIDA_PADRAO, modelo_path=MODELO_PADRAO):
    """Processa uma ATA em PDF e devolve a lista de registros gerados."""
    pdf_path = Path(pdf_path)
    modelo_path = Path(modelo_path)
    if not modelo_path.exists():
        raise FileNotFoundError(
            f'Modelo não encontrado: {modelo_path}\n'
            'Coloque o seu MODELO.docx nesta pasta (ou rode '
            '"python criar_modelo_exemplo.py" para gerar um modelo de teste).')

    print(f'Lendo {pdf_path.name}...')
    texto = extrair_texto_pdf(pdf_path)
    cabecalho, acordaos = extrair_dados_ata(texto)
    if not acordaos:
        print('  Nenhum acórdão encontrado nesta ATA.')
        return []

    print(f'  Sessão de {cabecalho["data"] or "(data não identificada)"} — '
          f'{len(acordaos)} acórdão(s)')

    registros = []
    for acordao in acordaos:
        dados = montar_dados_documento(cabecalho, acordao)
        saida = Path(saida_dir) / nome_arquivo_saida(acordao)
        gerar_docx(modelo_path, dados, saida)
        erros = validar_docx(saida)
        status = 'OK' if not erros else 'ERRO: ' + '; '.join(erros)
        print(f'  [{status.split(":")[0]}] {acordao["numero"]} -> {saida.name}')
        registros.append({
            'data_processamento': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'ata': pdf_path.name,
            'acordao': acordao['numero'],
            'processo': acordao['processo'],
            'recorrente': acordao['recorrente'],
            'relator': acordao['relator'],
            'arquivo_gerado': saida.name,
            'status': status,
        })
    return registros


def gravar_log_csv(registros, saida_dir=SAIDA_PADRAO):
    """Log de auditoria: acrescenta os registros a log_processamento.csv."""
    if not registros:
        return None
    log_path = Path(saida_dir) / 'log_processamento.csv'
    log_path.parent.mkdir(parents=True, exist_ok=True)
    novo = not log_path.exists()
    with open(log_path, 'a', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=list(registros[0].keys()),
                                delimiter=';')
        if novo:
            writer.writeheader()
        writer.writerows(registros)
    return log_path


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    pdf_path = Path(argv[1])
    saida_dir = Path(argv[2]) if len(argv) > 2 else SAIDA_PADRAO
    registros = processar_ata(pdf_path, saida_dir)
    log = gravar_log_csv(registros, saida_dir)
    if log:
        print(f'\nLog de auditoria: {log}')
    print(f'{len(registros)} arquivo(s) gerado(s) em {saida_dir}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
