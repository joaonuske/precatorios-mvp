-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "clicksignDocumentKey" TEXT,
ADD COLUMN     "signatureStartedAt" TIMESTAMP(3),
ADD COLUMN     "signatureStatus" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedPdfPath" TEXT;
