import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Em build (collecting page data) ou ambientes sem DB,
    // criamos um client com placeholder. As queries falham só quando rodam.
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: "postgresql://placeholder@localhost/placeholder" }),
    });
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
