#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interface gráfica do Gerador de Acórdãos CARF.

100% offline: usa apenas tkinter (incluído no Python) e processa tudo na
própria máquina. Nenhum arquivo é enviado para a rede ou para serviços
de IA.

Uso:
    python interface.py
"""

import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, font, messagebox, ttk

from gerar_acordaos import (MODELO_PADRAO, SAIDA_PADRAO, gravar_log_csv,
                            processar_ata)
from processar_todos import ATAS_PADRAO

import builtins


class App:
    def __init__(self, root):
        self.root = root
        root.title('Gerador de Acórdãos CARF — 100% offline')
        root.geometry('760x560')
        root.minsize(640, 480)

        self.fila_log = queue.Queue()
        self.processando = False
        self.arquivos_selecionados = []

        self._montar_layout()
        self._verificar_modelo()
        self.root.after(100, self._drenar_log)

    # ------------------------------------------------------------------ UI

    def _montar_layout(self):
        topo = ttk.Frame(self.root, padding=10)
        topo.pack(fill='x')

        ttk.Label(
            topo,
            text='Processa ATAs do CARF (PDF) e gera um .docx por acórdão.\n'
                 'Tudo roda nesta máquina — sem internet, sem upload, sem IA.',
            justify='left').pack(anchor='w')

        # --- seleção de ATAs
        frame_atas = ttk.LabelFrame(self.root, text='1. ATAs (PDF)', padding=10)
        frame_atas.pack(fill='x', padx=10, pady=(6, 0))

        self.var_atas = tk.StringVar(value=str(ATAS_PADRAO))
        ttk.Entry(frame_atas, textvariable=self.var_atas).pack(
            side='left', fill='x', expand=True)
        ttk.Button(frame_atas, text='Escolher PDFs...',
                   command=self.escolher_pdfs).pack(side='left', padx=(6, 0))
        ttk.Button(frame_atas, text='Escolher pasta...',
                   command=self.escolher_pasta_atas).pack(side='left', padx=(6, 0))

        # --- pasta de saída
        frame_saida = ttk.LabelFrame(self.root, text='2. Pasta de saída', padding=10)
        frame_saida.pack(fill='x', padx=10, pady=(6, 0))

        self.var_saida = tk.StringVar(value=str(SAIDA_PADRAO))
        ttk.Entry(frame_saida, textvariable=self.var_saida).pack(
            side='left', fill='x', expand=True)
        ttk.Button(frame_saida, text='Escolher...',
                   command=self.escolher_pasta_saida).pack(side='left', padx=(6, 0))

        # --- ações
        frame_acoes = ttk.Frame(self.root, padding=10)
        frame_acoes.pack(fill='x')

        self.btn_gerar = ttk.Button(frame_acoes, text='3. Gerar acórdãos',
                                    command=self.gerar)
        self.btn_gerar.pack(side='left')
        ttk.Button(frame_acoes, text='Abrir pasta de saída',
                   command=self.abrir_saida).pack(side='left', padx=(6, 0))

        self.var_modelo = tk.StringVar()
        ttk.Label(frame_acoes, textvariable=self.var_modelo,
                  foreground='#666').pack(side='right')

        # --- log
        frame_log = ttk.LabelFrame(self.root, text='Andamento', padding=6)
        frame_log.pack(fill='both', expand=True, padx=10, pady=(0, 10))

        fonte_mono = font.nametofont('TkFixedFont')
        self.txt_log = tk.Text(frame_log, height=12, state='disabled',
                               font=fonte_mono, wrap='word')
        barra = ttk.Scrollbar(frame_log, command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=barra.set)
        barra.pack(side='right', fill='y')
        self.txt_log.pack(fill='both', expand=True)

    def _verificar_modelo(self):
        if MODELO_PADRAO.exists():
            self.var_modelo.set(f'Modelo: {MODELO_PADRAO.name}')
        else:
            self.var_modelo.set('MODELO.docx não encontrado!')
            self.log('ATENÇÃO: coloque o MODELO.docx na pasta '
                     f'{MODELO_PADRAO.parent} antes de gerar.')

    # ------------------------------------------------------------ callbacks

    def escolher_pdfs(self):
        arquivos = filedialog.askopenfilenames(
            title='Escolha as ATAs (PDF)',
            filetypes=[('PDF', '*.pdf'), ('Todos', '*.*')])
        if arquivos:
            self.arquivos_selecionados = [Path(a) for a in arquivos]
            self.var_atas.set(f'{len(arquivos)} arquivo(s) selecionado(s)')

    def escolher_pasta_atas(self):
        pasta = filedialog.askdirectory(title='Pasta com as ATAs (PDF)')
        if pasta:
            self.arquivos_selecionados = []
            self.var_atas.set(pasta)

    def escolher_pasta_saida(self):
        pasta = filedialog.askdirectory(title='Pasta de saída')
        if pasta:
            self.var_saida.set(pasta)

    def abrir_saida(self):
        pasta = Path(self.var_saida.get())
        pasta.mkdir(parents=True, exist_ok=True)
        if sys.platform == 'win32':
            import os
            os.startfile(pasta)  # noqa — só existe no Windows
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', str(pasta)])
        else:
            subprocess.Popen(['xdg-open', str(pasta)])

    def gerar(self):
        if self.processando:
            return
        if not MODELO_PADRAO.exists():
            messagebox.showerror(
                'Modelo não encontrado',
                f'Coloque o MODELO.docx em:\n{MODELO_PADRAO.parent}')
            return

        if self.arquivos_selecionados:
            pdfs = list(self.arquivos_selecionados)
        else:
            pasta = Path(self.var_atas.get())
            pdfs = sorted(pasta.glob('*.pdf')) + sorted(pasta.glob('*.PDF'))
        if not pdfs:
            messagebox.showwarning(
                'Nada para processar',
                'Nenhum PDF selecionado e nenhum PDF na pasta de ATAs.')
            return

        self.processando = True
        self.btn_gerar.configure(state='disabled', text='Processando...')
        saida = Path(self.var_saida.get())
        threading.Thread(target=self._trabalho, args=(pdfs, saida),
                         daemon=True).start()

    # ---------------------------------------------------------- worker/log

    def _trabalho(self, pdfs, saida):
        # redireciona os print() do motor para o painel de log
        print_original = builtins.print

        def print_log(*args, **kwargs):
            self.fila_log.put(' '.join(str(a) for a in args))

        builtins.print = print_log
        try:
            registros = []
            for pdf in pdfs:
                try:
                    registros.extend(processar_ata(pdf, saida))
                except Exception as e:
                    self.fila_log.put(f'ERRO ao processar {pdf.name}: {e}')
            log = gravar_log_csv(registros, saida)
            self.fila_log.put(f'\nConcluído: {len(registros)} acórdão(s) '
                              f'gerado(s) em {saida}')
            if log:
                self.fila_log.put(f'Log de auditoria: {log.name}')
        finally:
            builtins.print = print_original
            self.fila_log.put(None)  # sinaliza fim

    def log(self, mensagem):
        self.txt_log.configure(state='normal')
        self.txt_log.insert('end', mensagem + '\n')
        self.txt_log.see('end')
        self.txt_log.configure(state='disabled')

    def _drenar_log(self):
        try:
            while True:
                msg = self.fila_log.get_nowait()
                if msg is None:
                    self.processando = False
                    self.btn_gerar.configure(state='normal',
                                             text='3. Gerar acórdãos')
                else:
                    self.log(msg)
        except queue.Empty:
            pass
        self.root.after(100, self._drenar_log)


def main():
    root = tk.Tk()
    try:
        ttk.Style().theme_use('vista')
    except tk.TclError:
        pass
    App(root)
    root.mainloop()


if __name__ == '__main__':
    main()
