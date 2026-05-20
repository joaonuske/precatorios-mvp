import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await ctx.params;
  if (
    parts.length !== 2 ||
    parts.some((p) => p.includes("..") || p.includes("/") || p.includes("\\"))
  ) {
    return new NextResponse("Bad path", { status: 400 });
  }
  const [ownerId, file] = parts;

  const session = await auth();
  const viewerId = (session?.user as { id?: string } | undefined)?.id;
  if (!viewerId) return new NextResponse("Unauthorized", { status: 401 });
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (viewerId !== ownerId && !viewer?.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const base = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
    const full = path.join(base, "kyc", ownerId, file);
    const data = await readFile(full);
    const ext = file.toLowerCase().split(".").pop();
    const type =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": type, "Content-Disposition": "inline" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
