import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  if (file.includes("/") || file.includes("\\") || file.includes("..")) {
    return new NextResponse("Bad path", { status: 400 });
  }
  try {
    const base = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
    const full = path.join(base, file);
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file}"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
