#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cria um MODELO.docx de EXEMPLO com a mesma estrutura do modelo oficial
(Content Controls com dataBinding em customXml/item1.xml, namespace
"Decisoes").

Serve apenas para testar o gerador quando o modelo oficial não está na
pasta. Para uso real, substitua pelo MODELO.docx oficial do CARF.

Uso:
    python criar_modelo_exemplo.py [saida.docx]
"""

import sys
import zipfile
from pathlib import Path

GUID_STORE = '{A1B2C3D4-E5F6-4A1B-9C8D-1234567890AB}'

CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/>
</Types>'''

RELS_RAIZ = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

RELS_DOCUMENT = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

RELS_ITEM1 = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/>
</Relationships>'''

ITEM_PROPS = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ds:datastoreItem ds:itemID="{GUID_STORE}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml">
<ds:schemaRefs><ds:schemaRef ds:uri="Decisoes"/></ds:schemaRefs>
</ds:datastoreItem>'''

ITEM1 = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Dados xmlns="Decisoes">
<l1NumProcesso>00000.000000/0000-00</l1NumProcesso>
<l2NumAto>0000-000.000</l2NumAto>
<siglaSetor>SETOR</siglaSetor>
<l3DataDoc>DATA</l3DataDoc>
<l4LstRecurso>RV</l4LstRecurso>
<l5TxtRecorrente>RECORRENTE</l5TxtRecorrente>
<l7TxtRecorrida>RECORRIDA</l7TxtRecorrida>
<srBloco2><lstTemas/><lstPeriodo/><txtPeriodo/></srBloco2>
</Dados>'''

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Texto"><w:name w:val="Texto"/><w:basedOn w:val="Normal"/>
<w:pPr><w:ind w:firstLine="2268"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="character" w:styleId="AcrdoChar"><w:name w:val="Acórdão Char"/></w:style>
</w:styles>'''


def _sdt_simples(tag, rotulo, idx):
    """Content Control inline com dataBinding no customXml (namespace Decisoes)."""
    return (
        f'<w:sdt><w:sdtPr><w:tag w:val="{tag}"/><w:id w:val="{1000 + idx}"/>'
        f'<w:dataBinding w:prefixMappings="xmlns:ns0=\'Decisoes\'" '
        f'w:xpath="/ns0:Dados[1]/ns0:{tag}[1]" w:storeItemID="{GUID_STORE}"/>'
        f'<w:text/></w:sdtPr>'
        f'<w:sdtContent><w:r><w:t>{rotulo}</w:t></w:r></w:sdtContent></w:sdt>'
    )


def _sdt_bloco(tag, rotulo, idx):
    """Content Control de bloco (texto livre, sem dataBinding)."""
    return (
        f'<w:sdt><w:sdtPr><w:tag w:val="{tag}"/><w:id w:val="{2000 + idx}"/>'
        f'</w:sdtPr><w:sdtContent>'
        f'<w:p><w:pPr><w:pStyle w:val="Texto"/></w:pPr>'
        f'<w:r><w:t>{rotulo}</w:t></w:r></w:p>'
        f'</w:sdtContent></w:sdt>'
    )


def _par(texto):
    return f'<w:p><w:r><w:t xml:space="preserve">{texto}</w:t></w:r></w:p>'


def montar_document_xml():
    campos = [
        ('Processo nº ', _sdt_simples('l1NumProcesso', '[processo]', 1)),
        ('Acórdão nº ', _sdt_simples('l2NumAto', '[acórdão]', 2)),
        ('', _sdt_simples('siglaSetor', '[setor]', 3)),
        ('Sessão de ', _sdt_simples('l3DataDoc', '[data]', 4)),
        ('Recurso ', _sdt_simples('l4LstRecurso', 'RV', 5)),
        ('Recorrente ', _sdt_simples('l5TxtRecorrente', '[recorrente]', 6)),
        ('Interessado ', _sdt_simples('l7TxtRecorrida', '[interessado]', 7)),
    ]
    corpo = ''.join(
        f'<w:p><w:r><w:t xml:space="preserve">{rotulo}</w:t></w:r></w:p>'
        if not sdt else f'<w:p><w:r><w:t xml:space="preserve">{rotulo}</w:t></w:r>{sdt}</w:p>'
        for rotulo, sdt in campos
    )
    corpo += _par('Decisão:')
    corpo += _sdt_bloco('attDecisao', '[decisão]', 1)
    corpo += _sdt_bloco('Participantes', '[participantes]', 2)
    corpo += _par('Presidente:')
    corpo += _sdt_bloco('Presidente de Turma', '[presidente]', 3)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{corpo}<w:sectPr/></w:body></w:document>'
    )


def criar_modelo(saida='MODELO.docx'):
    saida = Path(saida)
    partes = {
        '[Content_Types].xml': CONTENT_TYPES,
        '_rels/.rels': RELS_RAIZ,
        'word/document.xml': montar_document_xml(),
        'word/styles.xml': STYLES,
        'word/_rels/document.xml.rels': RELS_DOCUMENT,
        'customXml/item1.xml': ITEM1,
        'customXml/itemProps1.xml': ITEM_PROPS,
        'customXml/_rels/item1.xml.rels': RELS_ITEM1,
    }
    with zipfile.ZipFile(saida, 'w', zipfile.ZIP_DEFLATED) as zf:
        for nome, conteudo in partes.items():
            zf.writestr(nome, conteudo)
    print(f'Modelo de exemplo criado: {saida}')
    return saida


if __name__ == '__main__':
    criar_modelo(sys.argv[1] if len(sys.argv) > 1 else 'MODELO.docx')
