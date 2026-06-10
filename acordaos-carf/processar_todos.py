#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Processa em lote todas as ATAs (PDF) da pasta atas/ e gera os acórdãos
em acordaos_gerados/, com log de auditoria em CSV.

Uso:
    python processar_todos.py [pasta_atas] [pasta_saida]
"""

import sys
from pathlib import Path

from gerar_acordaos import (PASTA_BASE, SAIDA_PADRAO, gravar_log_csv,
                            processar_ata)

ATAS_PADRAO = PASTA_BASE / 'atas'


def processar_pasta(atas_dir=ATAS_PADRAO, saida_dir=SAIDA_PADRAO,
                    progresso=print):
    """Processa todos os PDFs de atas_dir. Devolve a lista de registros."""
    atas_dir = Path(atas_dir)
    pdfs = sorted(atas_dir.glob('*.pdf')) + sorted(atas_dir.glob('*.PDF'))
    if not pdfs:
        progresso(f'Nenhum PDF encontrado em {atas_dir}')
        return []

    registros = []
    for pdf in pdfs:
        try:
            registros.extend(processar_ata(pdf, saida_dir))
        except Exception as e:  # uma ATA com problema não para o lote
            progresso(f'ERRO ao processar {pdf.name}: {e}')

    log = gravar_log_csv(registros, saida_dir)
    progresso(f'\n{len(registros)} acórdão(s) gerado(s) em {saida_dir}')
    if log:
        progresso(f'Log de auditoria: {log}')
    return registros


def main(argv):
    atas_dir = Path(argv[1]) if len(argv) > 1 else ATAS_PADRAO
    saida_dir = Path(argv[2]) if len(argv) > 2 else SAIDA_PADRAO
    atas_dir.mkdir(parents=True, exist_ok=True)
    processar_pasta(atas_dir, saida_dir)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
