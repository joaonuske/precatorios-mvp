#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes do gerador de acórdãos (sem dependências além das do projeto).

Uso:
    python tests/test_pipeline.py
"""

import re
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lxml import etree

import criar_modelo_exemplo
from gerar_acordaos import (extrair_dados_ata, gerar_docx,
                            montar_dados_documento, nome_arquivo_saida,
                            palavras_para_numero, validar_docx)

ATA_EXEMPLO = """MINISTÉRIO DA FAZENDA
CONSELHO ADMINISTRATIVO DE RECURSOS FISCAIS
ATA DA 2ª REUNIÃO ORDINÁRIA DE 2026

Aos três dias do mês de fevereiro do ano de dois mil e vinte e seis, reuniu-se
a 2ª SEÇÃO/4ª CÂMARA/2ª TURMA ORDINÁRIA do Conselho Administrativo de Recursos
Fiscais, estando presentes os conselheiros FRANCISCO RICARDO GOUVEIA COUTINHO
(Presidente), ANA CLAUDIA BORGES DE OLIVEIRA, RODRIGO DUARTE FIRMINO
(substituto integral) e MARIANA SILVA CAMPOS, a fim de serem julgados os
processos a seguir relacionados.

ACÓRDÃO 2402-013.431
Relator(a): ANA CLAUDIA BORGES DE OLIVEIRA
Processo: 10540.735226/2020-23
Recorrente: COMERCIAL AGRICOLA TRIANA LTDA e Interessado: FAZENDA NACIONAL
Decisão: Acordam os membros do colegiado, por unanimidade de votos, em
conhecer do recurso voluntário e, no mérito, negar-lhe provimento.
Ausente a conselheira BEATRIZ LIMA.

ACÓRDÃO 2402-013.432
Relator(a): MARIANA SILVA CAMPOS
Processo: 13888.001234/2019-55
Recorrente: INDUSTRIA DE PAPEL XYZ S/A e Interessado: FAZENDA NACIONAL
Decisão: Acordam os membros do colegiado, por maioria de votos, em dar
provimento parcial ao recurso voluntário.
Fez sustentação oral o advogado JOSÉ DA SILVA, OAB/SP 12345.
"""


def test_palavras_para_numero():
    assert palavras_para_numero('três') == 3
    assert palavras_para_numero('vinte e seis') == 26
    assert palavras_para_numero('trinta e um') == 31
    assert palavras_para_numero('dois mil e vinte e seis') == 2026
    assert palavras_para_numero('dois mil e trinta') == 2030
    assert palavras_para_numero('inexistente') is None


def test_extracao():
    cabecalho, acordaos = extrair_dados_ata(ATA_EXEMPLO)

    assert cabecalho['data'] == '03 de fevereiro de 2026', cabecalho['data']
    assert cabecalho['setor'] == '2ª SEÇÃO/4ª CÂMARA/2ª TURMA ORDINÁRIA'
    assert cabecalho['presidente'] == 'FRANCISCO RICARDO GOUVEIA COUTINHO'
    assert cabecalho['participantes'] == [
        'FRANCISCO RICARDO GOUVEIA COUTINHO (Presidente)',
        'ANA CLAUDIA BORGES DE OLIVEIRA',
        'RODRIGO DUARTE FIRMINO',  # "(substituto integral)" removido
        'MARIANA SILVA CAMPOS',
    ], cabecalho['participantes']

    assert len(acordaos) == 2
    a1, a2 = acordaos
    assert a1['numero'] == '2402-013.431'
    assert a1['processo'] == '10540.735226/2020-23'
    assert a1['recorrente'] == 'COMERCIAL AGRICOLA TRIANA LTDA'
    assert a1['interessado'] == 'FAZENDA NACIONAL'
    assert a1['relator'] == 'ANA CLAUDIA BORGES DE OLIVEIRA'
    assert a1['decisao'].startswith('Acordam os membros do colegiado, por unanimidade')
    assert 'Ausente' not in a1['decisao']

    assert a2['numero'] == '2402-013.432'
    assert a2['decisao'].endswith('provimento parcial ao recurso voluntário.')
    assert 'sustentação' not in a2['decisao']

    return cabecalho, acordaos


def test_nome_arquivo():
    _, acordaos = extrair_dados_ata(ATA_EXEMPLO)
    assert nome_arquivo_saida(acordaos[0]) == \
        'ACC_10540735226-2020-23_COMERCIAL_AGRICOLA_TRIANA_LTDA.docx'


def test_geracao_docx():
    cabecalho, acordaos = extrair_dados_ata(ATA_EXEMPLO)
    dados = montar_dados_documento(cabecalho, acordaos[0])

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        modelo = criar_modelo_exemplo.criar_modelo(tmp / 'MODELO.docx')
        saida = gerar_docx(modelo, dados, tmp / nome_arquivo_saida(acordaos[0]))

        erros = validar_docx(saida)
        assert not erros, erros

        with zipfile.ZipFile(saida) as zf:
            custom = zf.read('customXml/item1.xml')
            doc = zf.read('word/document.xml').decode('utf-8')

        # customXml (fonte do dataBinding) atualizado
        root = etree.fromstring(custom)
        ns = {'d': 'Decisoes'}
        assert root.findtext('d:l1NumProcesso', namespaces=ns) == \
            '10540.735226/2020-23'
        assert root.findtext('d:l2NumAto', namespaces=ns) == '2402-013.431'
        assert root.findtext('d:l3DataDoc', namespaces=ns) == \
            '03 de fevereiro de 2026'
        assert root.findtext('d:l5TxtRecorrente', namespaces=ns) == \
            'COMERCIAL AGRICOLA TRIANA LTDA'
        assert root.findtext('d:l4LstRecurso', namespaces=ns) == 'RV'

        # cache visual (sdtContent) também atualizado
        texto_doc = ' '.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', doc))
        assert '10540.735226/2020-23' in texto_doc
        assert '2402-013.431' in texto_doc
        assert 'Vistos, relatados e discutidos os presentes autos.' in texto_doc
        assert 'Acordam os membros do colegiado' in texto_doc
        assert 'FRANCISCO RICARDO GOUVEIA COUTINHO (Presidente)' in texto_doc
        assert 'RODRIGO DUARTE FIRMINO' in texto_doc
        # placeholders do modelo não podem sobrar
        assert '[processo]' not in texto_doc
        assert '[decisão]' not in texto_doc


def test_pdf_ida_e_volta():
    """Gera um PDF de verdade com a ATA e confere a extração via pdfplumber."""
    try:
        from fpdf import FPDF
    except Exception:
        print('  (fpdf2 não disponível — teste de PDF pulado)')
        return

    from gerar_acordaos import extrair_texto_pdf

    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / 'ata.pdf'
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font('helvetica', size=10)
        for linha in ATA_EXEMPLO.splitlines():
            pdf.cell(0, 5, linha, new_x='LMARGIN', new_y='NEXT')
        pdf.output(str(pdf_path))

        texto = extrair_texto_pdf(pdf_path)
        _, acordaos = extrair_dados_ata(texto)
        assert len(acordaos) == 2, f'esperava 2 acórdãos, achei {len(acordaos)}'
        assert acordaos[0]['processo'] == '10540.735226/2020-23'


if __name__ == '__main__':
    falhas = 0
    for nome, fn in sorted(globals().items()):
        if nome.startswith('test_') and callable(fn):
            try:
                fn()
                print(f'OK   {nome}')
            except AssertionError as e:
                falhas += 1
                print(f'FALHA {nome}: {e}')
    sys.exit(1 if falhas else 0)
