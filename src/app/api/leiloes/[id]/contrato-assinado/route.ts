import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await auth();
  const viewerId = (session?.user as { id?: string } | undefined)?.id;
  if (!viewerId) return new NextResponse("Unauthorized", { status: 401 });

  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) return new NextResponse("Não encontrado", { status: 404 });
  if (!auction.signedPdfPath) {
    return new NextResponse("PDF assinado ainda não disponível.", {
      status: 400,
    });
  }
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  const isParty =
    viewerId === auction.credorId || viewerId === auction.winnerId;
  if (!isParty && !viewer?.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const baseDir = path.resolve(
      process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"),
    );
    const full = path.join(baseDir, "signed", auction.signedPdfPath);
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cessao-assinada-${auction.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch {
    return new NextResponse("Arquivo não encontrado no servidor", {
      status: 404,
    });
  }
}
