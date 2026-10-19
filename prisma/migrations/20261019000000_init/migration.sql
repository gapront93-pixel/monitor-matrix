-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('retail', 'dealer');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('in_stock', 'out_of_stock', 'discontinued', 'contact', 'unknown');

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "conclusionVi" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "isGigabyte" BOOLEAN NOT NULL,
    "model" TEXT NOT NULL,
    "series" TEXT,
    "line" TEXT,
    "segmentId" TEXT,
    "sizeIn" DOUBLE PRECISION,
    "panel" TEXT,
    "shape" TEXT,
    "resolution" TEXT,
    "refreshHz" INTEGER,
    "responseMs" DOUBLE PRECISION,
    "brightnessSdrNits" INTEGER,
    "brightnessHdrPeakNits" INTEGER,
    "hdr" TEXT,
    "dciP3Pct" DOUBLE PRECISION,
    "srgbPct" DOUBLE PRECISION,
    "contrast" TEXT,
    "bitDepth" TEXT,
    "hdmiVer" TEXT,
    "dpVer" TEXT,
    "usbC" BOOLEAN,
    "usbCPdW" INTEGER,
    "kvm" BOOLEAN,
    "heightAdjMm" INTEGER,
    "pivot" BOOLEAN,
    "speaker" TEXT,
    "warranty" TEXT,
    "msrpUsd" TEXT,
    "url" TEXT,
    "rawSpecs" JSONB NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER,
    "segmentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date" DATE,
    "dateText" TEXT,
    "metric" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "verdict" TEXT,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "priceType" "PriceType" NOT NULL DEFAULT 'retail',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImport" (
    "id" SERIAL NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImportDealer" (
    "importId" INTEGER NOT NULL,
    "dealerId" TEXT NOT NULL,

    CONSTRAINT "PriceImportDealer_pkey" PRIMARY KEY ("importId","dealerId")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "dealerId" TEXT NOT NULL,
    "priceVnd" INTEGER,
    "listPriceVnd" INTEGER,
    "inStock" BOOLEAN,
    "stockStatus" "StockStatus" NOT NULL,
    "note" TEXT,
    "nameOnSite" TEXT,
    "url" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedPrice" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "dealerId" TEXT NOT NULL,
    "nameOnSite" TEXT NOT NULL,
    "slugInFile" TEXT,
    "priceVnd" INTEGER,
    "url" TEXT,
    "note" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmatchedPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_segmentId_idx" ON "Product"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_brand_model_key" ON "Product"("brand", "model");

-- CreateIndex
CREATE INDEX "Benchmark_productId_idx" ON "Benchmark"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_segmentId_subject_source_url_metric_key" ON "Benchmark"("segmentId", "subject", "source", "url", "metric");

-- CreateIndex
CREATE INDEX "PriceImportDealer_dealerId_idx" ON "PriceImportDealer"("dealerId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_productId_dealerId_capturedAt_idx" ON "PriceSnapshot"("productId", "dealerId", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_dealerId_capturedAt_idx" ON "PriceSnapshot"("dealerId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSnapshot_importId_productId_dealerId_key" ON "PriceSnapshot"("importId", "productId", "dealerId");

-- CreateIndex
CREATE INDEX "UnmatchedPrice_importId_idx" ON "UnmatchedPrice"("importId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportDealer" ADD CONSTRAINT "PriceImportDealer_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PriceImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportDealer" ADD CONSTRAINT "PriceImportDealer_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PriceImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedPrice" ADD CONSTRAINT "UnmatchedPrice_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PriceImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedPrice" ADD CONSTRAINT "UnmatchedPrice_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

