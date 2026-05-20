import { notFound, redirect } from "next/navigation";
import { readdir, stat } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function walk(dir: string, base: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  let entries: string[] = [];
  try {
    const items = await readdir(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const rel = path.relative(base, full);
      try {
        const st = await stat(full);
        if (st.isDirectory()) {
          entries.push(`📁 ${rel}/`);
          entries = entries.concat(await walk(full, base, depth + 1));
        } else {
          entries.push(`📄 ${rel}  (${st.size} bytes)`);
        }
      } catch {
        entries.push(`❌ ${rel}  (sem acesso)`);
      }
    }
  } catch (err) {
    entries.push(`(diretório inacessível: ${(err as Error).message})`);
  }
  return entries;
}

export default async function AdminDebugPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.isAdmin) notFound();

  const uploadsEnv = process.env.UPLOADS_DIR;
  const uploadsResolved = path.resolve(uploadsEnv || path.join(process.cwd(), "uploads"));
  const entries = await walk(uploadsResolved, uploadsResolved);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin · Debug</h1>
      <div className="bg-white border rounded p-4 text-sm space-y-2">
        <div>
          <strong>process.cwd():</strong> <code>{process.cwd()}</code>
        </div>
        <div>
          <strong>UPLOADS_DIR (env):</strong>{" "}
          <code>{uploadsEnv ?? "(unset)"}</code>
        </div>
        <div>
          <strong>UPLOADS_DIR (resolved):</strong>{" "}
          <code>{uploadsResolved}</code>
        </div>
      </div>
      <div className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">
          Conteúdo de {uploadsResolved}
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">(vazio)</p>
        ) : (
          <ul className="text-xs font-mono space-y-1">
            {entries.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
