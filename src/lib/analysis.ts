import { prisma } from "./prisma.ts";
import { computeMeasurements } from "./geo.ts";
import type { Analysis, GeoPoint } from "../../generated/prisma/client.ts";

export type AnalysisWithPoints = Analysis & { geoPoints: GeoPoint[] };

const includePointsOrdered = {
  geoPoints: { orderBy: { order: "asc" as const } },
};

/**
 * Recompute the derived measurements for an analysis from its current points
 * (ordered) and persist them. Returns the updated analysis with points, or
 * null if the analysis no longer exists.
 */
export async function recomputeAnalysis(
  analysisId: string,
): Promise<AnalysisWithPoints | null> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: includePointsOrdered,
  });
  if (!analysis) return null;

  const m = computeMeasurements(analysis.geoPoints, analysis.referenceHeight);

  return prisma.analysis.update({
    where: { id: analysisId },
    data: {
      area: m.area,
      volume: m.volume,
      xSize: m.xSize,
      ySize: m.ySize,
      zSize: m.zSize,
      segmentDistances: m.segmentDistances,
    },
    include: includePointsOrdered,
  });
}

/**
 * Re-number a polygon's points to a contiguous 0..n-1 order (call after a
 * point is removed so there are no gaps).
 */
export async function reindexPoints(analysisId: string): Promise<void> {
  const points = await prisma.geoPoint.findMany({
    where: { analysisId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  // updateMany never throws P2025 if a row was concurrently removed, so a racing
  // delete can't crash the re-index (it just becomes a no-op for that row).
  await prisma.$transaction(
    points.map((p, index) =>
      prisma.geoPoint.updateMany({ where: { id: p.id }, data: { order: index } }),
    ),
  );
}

export { includePointsOrdered };
