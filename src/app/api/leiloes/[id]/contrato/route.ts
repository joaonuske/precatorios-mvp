import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCessionPdf } from "@/lib/cessionContract";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const session = await auth();
  const viewerId = (session?.user as { id?: string } | undefined)?.id;
  if (!viewerId) return new NextResponse("Unauthorized", { status: 401 });

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { credor: true, winner: true },
  });
  if (!auction) return new NextResponse("Não encontrado", { status: 404 });
  if (auction.status !== "sold" || !auction.winner) {
    return new NextResponse(
      "Contrato só disponível após confirmação da cessão.",
      { status: 400 },
    );
  }

  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  const isParty = viewerId === auction.credorId || viewerId === auction.winnerId;
  if (!isParty && !viewer?.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const pdfBytes = await generateCessionPdf({
    auction,
    credor: auction.credor,
    comprador: auction.winner,
  });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-cessao-${auction.id.slice(0, 8)}.pdf"`,
    },
  });
}
