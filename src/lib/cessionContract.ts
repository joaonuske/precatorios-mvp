import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Auction, User } from "@/generated/prisma/client";
import { formatCpf } from "@/lib/cpf";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DATE_BR = (d: Date) =>
  d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function extenso(n: number): string {
  // Aproximação simples para MVP — só pra ter o "valor por extenso" no contrato.
  // Em produção real, usar uma lib dedicada (numero-por-extenso, etc).
  const reais = Math.floor(n);
  const centavos = Math.round((n - reais) * 100);
  return `R$ ${reais.toLocaleString("pt-BR")} (em reais) e ${centavos.toString().padStart(2, "0")} centavos`;
}

type Args = {
  auction: Auction;
  credor: User;
  comprador: User;
};

export async function generateCessionPdf({
  auction,
  credor,
  comprador,
}: Args): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const MARGIN = 60;
  const W = 595; // A4 width in points
  const H = 842; // A4 height
  const TEXT_W = W - 2 * MARGIN;
  const SIZE = 11;
  const LINE = 16;
  const BLACK = rgb(0, 0, 0);

  let page = pdf.addPage([W, H]);
  let y = H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - MARGIN;
  };

  const drawWrapped = (text: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) => {
    const f = opts.bold ? fontBold : font;
    const sz = opts.size ?? SIZE;
    const indent = opts.indent ?? 0;
    const maxW = TEXT_W - indent;
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const width = f.widthOfTextAtSize(test, sz);
      if (width > maxW) {
        if (y < MARGIN + LINE) newPage();
        page.drawText(line, { x: MARGIN + indent, y, size: sz, font: f, color: BLACK });
        y -= LINE;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < MARGIN + LINE) newPage();
      page.drawText(line, { x: MARGIN + indent, y, size: sz, font: f, color: BLACK });
      y -= LINE;
    }
  };

  const blank = (n = 1) => {
    y -= LINE * n;
    if (y < MARGIN) newPage();
  };

  // Cabeçalho
  drawWrapped("INSTRUMENTO PARTICULAR DE CESSÃO DE CRÉDITO DE PRECATÓRIO", {
    bold: true,
    size: 13,
  });
  blank();

  // Qualificação das partes
  drawWrapped("CEDENTE (Credor):", { bold: true });
  drawWrapped(
    `${credor.name}, CPF nº ${credor.kycCpf ? formatCpf(credor.kycCpf) : "[não informado]"}, residente e domiciliado(a) em ${credor.kycAddress ?? "[endereço não informado]"}, e-mail ${credor.email}${credor.phone ? `, telefone ${credor.phone}` : ""}, doravante denominado simplesmente CEDENTE.`,
  );
  blank();

  drawWrapped("CESSIONÁRIO (Comprador):", { bold: true });
  drawWrapped(
    `${comprador.name}, CPF nº ${comprador.kycCpf ? formatCpf(comprador.kycCpf) : "[não informado]"}, ${comprador.kycAddress ? `residente e domiciliado(a) em ${comprador.kycAddress}, ` : ""}e-mail ${comprador.email}${comprador.phone ? `, telefone ${comprador.phone}` : ""}, doravante denominado simplesmente CESSIONÁRIO.`,
  );
  blank();

  drawWrapped(
    "As partes acima qualificadas têm entre si justo e contratado o presente Instrumento Particular de Cessão de Crédito, intermediado pela plataforma Precatórios MVP, mediante as cláusulas e condições seguintes:",
  );
  blank();

  // Cláusula 1: do crédito
  drawWrapped("CLÁUSULA 1ª — DO CRÉDITO CEDIDO", { bold: true });
  drawWrapped(
    `O CEDENTE é titular de crédito decorrente do processo nº ${auction.numeroProcesso}, em trâmite perante ${auction.tribunal}, classe "${auction.title}", tendo como devedor ${auction.enteDevedor}, inscrito na Lei Orçamentária Anual (LOA) do exercício de ${auction.anoLOA}, no valor de face de ${BRL(auction.valorFace)} (${extenso(auction.valorFace)}).`,
  );
  blank();

  // Cláusula 2: cessão
  drawWrapped("CLÁUSULA 2ª — DA CESSÃO", { bold: true });
  drawWrapped(
    `Por meio do presente instrumento, o CEDENTE cede e transfere ao CESSIONÁRIO, em caráter irrevogável e irretratável, a totalidade do crédito descrito na cláusula 1ª, com todos os seus acessórios, juros, correção monetária e privilégios.`,
  );
  blank();

  // Cláusula 3: preço
  drawWrapped("CLÁUSULA 3ª — DO PREÇO E DA FORMA DE PAGAMENTO", { bold: true });
  drawWrapped(
    `O CESSIONÁRIO pagará ao CEDENTE, pelo crédito ora cedido, o valor de ${BRL(auction.winningBid ?? 0)} (${extenso(auction.winningBid ?? 0)}), valor este apurado no leilão eletrônico da plataforma Precatórios MVP encerrado em ${auction.confirmedAt ? DATE_BR(auction.confirmedAt) : DATE_BR(new Date())}. A forma e o prazo de pagamento serão ajustados diretamente entre as partes, fora da Plataforma.`,
  );
  blank();

  // Cláusula 4: comissão
  drawWrapped("CLÁUSULA 4ª — DA COMISSÃO DE INTERMEDIAÇÃO", { bold: true });
  const comissao = (auction.winningBid ?? 0) * (auction.commissionPct / 100);
  drawWrapped(
    `O CESSIONÁRIO declara estar ciente de que é devida à plataforma Precatórios MVP a comissão de intermediação de ${auction.commissionPct}% (${auction.commissionPct} por cento) sobre o valor arrematado, correspondente a ${BRL(comissao)}, a ser paga conforme cobrança emitida pela Plataforma.`,
  );
  blank();

  // Cláusula 5: garantias
  drawWrapped("CLÁUSULA 5ª — DAS DECLARAÇÕES DO CEDENTE", { bold: true });
  drawWrapped(
    "O CEDENTE declara, sob as penas da lei: (a) ser o legítimo titular do crédito cedido; (b) que o crédito não foi cedido a terceiros, no todo ou em parte; (c) que não há penhora, arresto, bloqueio, gravame ou ônus de qualquer natureza sobre o crédito; (d) que os documentos por ele apresentados são verdadeiros e atuais. A falsidade de qualquer dessas declarações sujeita o CEDENTE às sanções dos arts. 171 e 299 do Código Penal, sem prejuízo da indenização cabível ao CESSIONÁRIO.",
  );
  blank();

  // Cláusula 6: averbação
  drawWrapped("CLÁUSULA 6ª — DA AVERBAÇÃO NO JUÍZO", { bold: true });
  drawWrapped(
    "Cabe ao CESSIONÁRIO providenciar, às suas expensas, a averbação da presente cessão no juízo competente, mediante petição de habilitação de cessionário, com prova do pagamento do preço ao CEDENTE.",
  );
  blank();

  // Cláusula 7: foro
  drawWrapped("CLÁUSULA 7ª — DO FORO", { bold: true });
  drawWrapped(
    "Fica eleito o foro da Comarca do domicílio do CEDENTE para dirimir quaisquer controvérsias decorrentes deste Instrumento, com renúncia expressa a qualquer outro.",
  );
  blank(2);

  // Local e data
  drawWrapped(`${DATE_BR(new Date())}.`, { bold: false });
  blank(3);

  // Assinaturas
  if (y < MARGIN + 80) newPage();
  page.drawLine({
    start: { x: MARGIN, y: y },
    end: { x: MARGIN + 220, y: y },
    color: BLACK,
    thickness: 0.5,
  });
  page.drawText(`${credor.name} (CEDENTE)`, {
    x: MARGIN,
    y: y - 14,
    size: 9,
    font,
    color: BLACK,
  });

  page.drawLine({
    start: { x: W - MARGIN - 220, y: y },
    end: { x: W - MARGIN, y: y },
    color: BLACK,
    thickness: 0.5,
  });
  page.drawText(`${comprador.name} (CESSIONÁRIO)`, {
    x: W - MARGIN - 220,
    y: y - 14,
    size: 9,
    font,
    color: BLACK,
  });

  y -= 60;
  if (y < MARGIN + 30) newPage();
  drawWrapped(
    "Documento gerado automaticamente pela plataforma Precatórios MVP a partir dos dados do leilão arrematado. Recomenda-se a assinatura digital com certificado ICP-Brasil ou o reconhecimento de firma em cartório.",
    { size: 8 },
  );

  return await pdf.save();
}
