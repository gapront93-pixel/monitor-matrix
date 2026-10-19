-- CreateEnum
CREATE TYPE "SegmentVerdict" AS ENUM ('lead', 'even', 'weak');

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "verdict" "SegmentVerdict";

