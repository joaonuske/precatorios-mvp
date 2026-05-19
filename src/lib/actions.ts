"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth, signIn, signOut } from "@/lib/auth";
import { lookupProcesso } from "@/lib/datajud";
import { cleanCpf, isValidCpf } from "@/lib/cpf";
import { analyzePdf } from "@/lib/pdfsig";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  document: z.string().optional(),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
    document: formData.get("document") || undefined,
  });
  if (!parsed.success) {
    throw new Error("Dados inválidos. Verifique os campos.");
  }
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) throw new Error("Email já cadastrado.");
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      phone: parsed.data.phone,
      document: parsed.data.document,
    },
  });
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/leiloes",
  });
}

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/leiloes",
    });
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    throw new Error("Email ou senha inválidos.");
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

const auctionSchema = z.object({
  title: z.string().min(3),
  tribunal: z.string().min(2),
  numeroProcesso: z.string().min(5),
  enteDevedor: z.string().min(2),
  anoLOA: z.coerce.number().int().min(2000).max(2100),
  valorFace: z.coerce.number().positive(),
  lanceMinimoPct: z.coerce.number().min(1).max(100).default(60),
  descricao: z.string().optional(),
  durationDays: z.coerce.number().int().min(1).max(60).default(20),
});

export async function createAuctionAction(formData: FormData) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: "Não autenticado." };

  const credorUser = await prisma.user.findUnique({ where: { id: userId } });
  if (credorUser?.kycStatus !== "approved") {
    return {
      error:
        credorUser?.kycStatus === "pending"
          ? "Sua verificação de identidade está em análise. Aguarde a aprovação."
          : credorUser?.kycStatus === "rejected"
          ? `Verificação de identidade rejeitada: ${credorUser.kycRejectionReason ?? "consulte o suporte"}.`
          : "Você precisa concluir a verificação de identidade antes de publicar um leilão. Acesse /kyc.",
    };
  }

  const parsed = auctionSchema.safeParse({
    title: formData.get("title"),
    tribunal: formData.get("tribunal"),
    numeroProcesso: formData.get("numeroProcesso"),
    enteDevedor: formData.get("enteDevedor"),
    anoLOA: formData.get("anoLOA"),
    valorFace: formData.get("valorFace"),
    lanceMinimoPct: formData.get("lanceMinimoPct") || 60,
    descricao: formData.get("descricao") || undefined,
    durationDays: formData.get("durationDays") || 20,
  });
  if (!parsed.success) {
    return { error: "Dados inválidos: " + parsed.error.issues[0].message };
  }

  let pdfPath: string | null = null;
  let pdfSha256: string | null = null;
  let pdfSignatures: string | null = null;
  const pdf = formData.get("pdf");
  if (pdf instanceof File && pdf.size > 0) {
    if (pdf.type !== "application/pdf") {
      return { error: "Arquivo deve ser PDF." };
    }
    if (pdf.size > 10 * 1024 * 1024) {
      return { error: "PDF maior que 10MB." };
    }
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${pdf.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fullPath = path.join(uploadsDir, filename);
    const buf = Buffer.from(await pdf.arrayBuffer());
    await writeFile(fullPath, buf);
    pdfPath = filename;

    const analysis = analyzePdf(buf);
    pdfSha256 = analysis.sha256;
    pdfSignatures = JSON.stringify(analysis);
  }

  const endsAt = new Date(Date.now() + parsed.data.durationDays * 24 * 60 * 60 * 1000);

  // Bloqueia duplicidade: mesmo nº CNJ já em leilão ativo na plataforma
  const digits = parsed.data.numeroProcesso.replace(/\D+/g, "");
  if (digits.length === 20) {
    const dup = await prisma.auction.findFirst({
      where: {
        status: "active",
        numeroProcesso: { contains: digits.slice(0, 7) },
      },
      select: { id: true, numeroProcesso: true, credorId: true },
    });
    if (dup && dup.numeroProcesso.replace(/\D+/g, "") === digits) {
      return {
        error:
          dup.credorId === userId
            ? "Você já tem um leilão ativo para esse processo."
            : "Já existe um leilão ativo para esse processo na plataforma. Se você for o titular, entre em contato com o suporte.",
      };
    }
  }

  const credor = await prisma.user.findUnique({ where: { id: userId } });
  const datajud = await lookupProcesso(
    parsed.data.numeroProcesso,
    credor?.name ?? "",
    { tribunal: parsed.data.tribunal, enteDevedor: parsed.data.enteDevedor },
  );

  const auction = await prisma.auction.create({
    data: {
      credorId: userId,
      title: parsed.data.title,
      tribunal: parsed.data.tribunal,
      numeroProcesso: parsed.data.numeroProcesso,
      enteDevedor: parsed.data.enteDevedor,
      anoLOA: parsed.data.anoLOA,
      valorFace: parsed.data.valorFace,
      lanceMinimoPct: parsed.data.lanceMinimoPct,
      descricao: parsed.data.descricao,
      pdfPath,
      pdfSha256,
      pdfSignatures,
      endsAt,
      commissionPct: Number(process.env.COMMISSION_PCT_DEFAULT ?? 5),
      datajudStatus: datajud.status,
      datajudSummary: JSON.stringify(datajud),
      datajudCheckedAt: new Date(),
    },
  });

  revalidatePath("/leiloes");
  redirect(`/leiloes/${auction.id}`);
}

export async function recheckDatajudAction(auctionId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("Não autenticado.");
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { credor: true },
  });
  if (!auction) throw new Error("Leilão não encontrado.");
  if (auction.credorId !== userId) throw new Error("Apenas o credor pode reconsultar.");

  const datajud = await lookupProcesso(auction.numeroProcesso, auction.credor.name, {
    tribunal: auction.tribunal,
    enteDevedor: auction.enteDevedor,
  });
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      datajudStatus: datajud.status,
      datajudSummary: JSON.stringify(datajud),
      datajudCheckedAt: new Date(),
    },
  });
  revalidatePath(`/leiloes/${auctionId}`);
}

const bidSchema = z.object({
  auctionId: z.string(),
  amount: z.coerce.number().positive(),
});

export async function placeBidAction(formData: FormData) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("Faça login para dar um lance.");

  const parsed = bidSchema.safeParse({
    auctionId: formData.get("auctionId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) throw new Error("Lance inválido.");

  await settleIfExpired(parsed.data.auctionId);

  const auction = await prisma.auction.findUnique({
    where: { id: parsed.data.auctionId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  if (!auction) throw new Error("Leilão não encontrado.");
  if (auction.status === "suspended")
    throw new Error("Leilão suspenso por alerta de integridade. Lances bloqueados.");
  if (auction.status !== "active") throw new Error("Leilão encerrado.");
  if (auction.credorId === userId) {
    throw new Error("Você não pode dar lance no próprio leilão.");
  }

  const minimoAbs = (auction.valorFace * auction.lanceMinimoPct) / 100;
  const highest = auction.bids[0]?.amount ?? 0;
  const floor = Math.max(minimoAbs, highest + 0.01);

  if (parsed.data.amount < floor) {
    throw new Error(
      `Lance precisa ser ao menos ${floor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}.`,
    );
  }

  const softMin = Number(process.env.SOFT_CLOSE_MINUTES ?? 5);
  const msUntilEnd = auction.endsAt.getTime() - Date.now();
  const shouldExtend = msUntilEnd < softMin * 60 * 1000;

  await prisma.$transaction(async (tx) => {
    await tx.bid.create({
      data: {
        auctionId: auction.id,
        bidderId: userId,
        amount: parsed.data.amount,
      },
    });
    if (shouldExtend) {
      await tx.auction.update({
        where: { id: auction.id },
        data: { endsAt: new Date(Date.now() + softMin * 60 * 1000) },
      });
    }
  });

  revalidatePath(`/leiloes/${auction.id}`);
  revalidatePath("/leiloes");
}

const DD_DAYS = Number(process.env.DD_WINDOW_DAYS ?? 7);

export async function settleIfExpired(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  if (!auction) return;

  // Transição 1: active → pending_dd | expired
  if (auction.status === "active" && auction.endsAt.getTime() <= Date.now()) {
    const top = auction.bids[0];
    await prisma.auction.update({
      where: { id: auctionId },
      data: top
        ? {
            status: "pending_dd",
            winnerId: top.bidderId,
            winningBid: top.amount,
            contactReleased: true,
            ddDeadline: new Date(Date.now() + DD_DAYS * 24 * 60 * 60 * 1000),
          }
        : { status: "expired" },
    });
    return;
  }

  // Transição 2: pending_dd → withdrawn (silencioso, prazo expirado sem ação)
  if (
    auction.status === "pending_dd" &&
    auction.ddDeadline &&
    auction.ddDeadline.getTime() <= Date.now()
  ) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "withdrawn",
        withdrawnAt: new Date(),
        withdrawnReason:
          "Vencedor não confirmou a cessão dentro do prazo de due diligence.",
      },
    });
  }
}

export async function confirmCessionAction(auctionId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("Não autenticado.");
  await settleIfExpired(auctionId);
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new Error("Leilão não encontrado.");
  if (auction.winnerId !== userId)
    throw new Error("Apenas o arrematante pode confirmar.");
  if (auction.status !== "pending_dd")
    throw new Error("Leilão não está em janela de due diligence.");

  await prisma.auction.update({
    where: { id: auctionId },
    data: { status: "sold", confirmedAt: new Date() },
  });
  revalidatePath(`/leiloes/${auctionId}`);
}

export async function withdrawCessionAction(formData: FormData) {
  const auctionId = String(formData.get("auctionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Informe o motivo da desistência.");

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("Não autenticado.");
  await settleIfExpired(auctionId);
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new Error("Leilão não encontrado.");
  if (auction.winnerId !== userId)
    throw new Error("Apenas o arrematante pode desistir.");
  if (auction.status !== "pending_dd")
    throw new Error("Leilão não está em janela de due diligence.");

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: "withdrawn",
      withdrawnAt: new Date(),
      withdrawnReason: reason,
    },
  });
  revalidatePath(`/leiloes/${auctionId}`);
}

const kycSchema = z.object({
  cpf: z.string().refine(isValidCpf, "CPF inválido."),
  birthDate: z.string().min(8),
  address: z.string().min(10),
  declaration: z.string().optional(),
});

export async function submitKycAction(_prev: { error?: string } | undefined, formData: FormData) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: "Não autenticado." };

  const parsed = kycSchema.safeParse({
    cpf: formData.get("cpf") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    address: formData.get("address") ?? "",
    declaration: formData.get("declaration") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (parsed.data.declaration !== "on") {
    return { error: "É necessário aceitar a declaração de inexistência de cessão." };
  }

  const doc = formData.get("docId");
  if (!(doc instanceof File) || doc.size === 0) {
    return { error: "Envie a foto do documento (RG ou CNH)." };
  }
  if (!/^image\/(jpe?g|png|webp)$|^application\/pdf$/.test(doc.type)) {
    return { error: "Documento deve ser JPG, PNG, WebP ou PDF." };
  }
  if (doc.size > 8 * 1024 * 1024) {
    return { error: "Documento maior que 8MB." };
  }

  const dir = path.join(process.cwd(), "uploads", "kyc", userId);
  await mkdir(dir, { recursive: true });
  const ext = doc.name.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `${Date.now()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await doc.arrayBuffer()));

  await prisma.user.update({
    where: { id: userId },
    data: {
      kycCpf: cleanCpf(parsed.data.cpf),
      kycBirthDate: new Date(parsed.data.birthDate),
      kycAddress: parsed.data.address,
      kycDocPath: `${userId}/${filename}`,
      kycDeclaration: true,
      kycStatus: "pending",
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycRejectionReason: null,
    },
  });
  revalidatePath("/kyc");
  revalidatePath("/admin/kyc");
  return {};
}

export async function approveKycAction(targetUserId: string) {
  const session = await auth();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) throw new Error("Não autenticado.");
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin?.isAdmin) throw new Error("Apenas admins.");
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      kycStatus: "approved",
      kycReviewedAt: new Date(),
      kycRejectionReason: null,
    },
  });
  revalidatePath("/admin/kyc");
}

export async function rejectKycAction(formData: FormData) {
  const session = await auth();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) throw new Error("Não autenticado.");
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin?.isAdmin) throw new Error("Apenas admins.");

  const targetUserId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Informe o motivo.");
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      kycStatus: "rejected",
      kycReviewedAt: new Date(),
      kycRejectionReason: reason,
    },
  });
  revalidatePath("/admin/kyc");
}

export async function previewProcessoAction(numeroProcesso: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: "Não autenticado." as const };
  const credor = await prisma.user.findUnique({ where: { id: userId } });
  const result = await lookupProcesso(numeroProcesso, credor?.name ?? "");
  return { result } as const;
}

export async function monitorAuction(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { credor: true },
  });
  if (!auction || auction.status !== "active") return { skipped: true as const };

  const datajud = await lookupProcesso(auction.numeroProcesso, auction.credor.name, {
    tribunal: auction.tribunal,
    enteDevedor: auction.enteDevedor,
  });

  const redAlerts = (datajud.alerts ?? []).filter((a) => a.level === "red");

  const update: {
    datajudStatus: string;
    datajudSummary: string;
    datajudCheckedAt: Date;
    status?: string;
    suspendedReason?: string;
    suspendedAt?: Date;
  } = {
    datajudStatus: datajud.status,
    datajudSummary: JSON.stringify(datajud),
    datajudCheckedAt: new Date(),
  };

  if (redAlerts.length > 0) {
    update.status = "suspended";
    update.suspendedReason = redAlerts.map((a) => a.message).join(" · ");
    update.suspendedAt = new Date();
  }

  await prisma.auction.update({ where: { id: auctionId }, data: update });
  revalidatePath(`/leiloes/${auctionId}`);
  return {
    suspended: redAlerts.length > 0,
    alerts: redAlerts.length,
  } as const;
}

export async function monitorAllActive() {
  const actives = await prisma.auction.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  const results: Array<{ id: string; suspended: boolean; alerts: number }> = [];
  for (const a of actives) {
    const r = await monitorAuction(a.id);
    if ("suspended" in r) {
      results.push({ id: a.id, suspended: !!r.suspended, alerts: r.alerts ?? 0 });
    }
    // pequeno respiro pra não martelar o Datajud
    await new Promise((res) => setTimeout(res, 250));
  }
  revalidatePath("/leiloes");
  return {
    checked: results.length,
    suspended: results.filter((r) => r.suspended).length,
    results,
  };
}

export async function settleAllExpired() {
  const now = new Date();
  const expired = await prisma.auction.findMany({
    where: {
      OR: [
        { status: "active", endsAt: { lt: now } },
        { status: "pending_dd", ddDeadline: { lt: now } },
      ],
    },
    select: { id: true },
  });
  for (const a of expired) await settleIfExpired(a.id);
  return expired.length;
}
