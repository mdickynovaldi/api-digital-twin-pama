-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceHeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineWidth" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "area" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "xSize" DOUBLE PRECISION,
    "ySize" DOUBLE PRECISION,
    "zSize" DOUBLE PRECISION,
    "segmentDistances" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_points" (
    "id" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "analysisId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geo_points_analysisId_idx" ON "geo_points"("analysisId");

-- AddForeignKey
ALTER TABLE "geo_points" ADD CONSTRAINT "geo_points_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

