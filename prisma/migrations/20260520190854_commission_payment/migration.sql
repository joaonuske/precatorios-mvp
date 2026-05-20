-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "bypassResolution" TEXT,
ADD COLUMN     "bypassResolvedAt" TIMESTAMP(3),
ADD COLUMN     "commissionPaidAt" TIMESTAMP(3),
ADD COLUMN     "commissionPaidMethod" TEXT,
ADD COLUMN     "commissionPaidNote" TEXT,
ADD COLUMN     "commissionStatus" TEXT,
ADD COLUMN     "commissionWaivedReason" TEXT;
