import type { Analysis, GeoPoint } from "../../generated/prisma/client.ts";
import type { z } from "@hono/zod-openapi";
import type {
  AnalysisSchema,
  AnalysisListItemSchema,
  GeoPointSchema,
} from "../openapi/schemas.ts";

type GeoPointOut = z.infer<typeof GeoPointSchema>;
type AnalysisOut = z.infer<typeof AnalysisSchema>;
type AnalysisListItemOut = z.infer<typeof AnalysisListItemSchema>;

export function serializeGeoPoint(gp: GeoPoint): GeoPointOut {
  return {
    id: gp.id,
    longitude: gp.longitude,
    latitude: gp.latitude,
    height: gp.height,
    order: gp.order,
    analysisId: gp.analysisId,
    createdAt: gp.createdAt.toISOString(),
  };
}

export function serializeAnalysis(
  a: Analysis & { geoPoints: GeoPoint[] },
): AnalysisOut {
  return {
    id: a.id,
    name: a.name,
    referenceHeight: a.referenceHeight,
    lineWidth: a.lineWidth,
    area: a.area,
    volume: a.volume,
    xSize: a.xSize,
    ySize: a.ySize,
    zSize: a.zSize,
    segmentDistances: a.segmentDistances,
    geoPoints: a.geoPoints.map(serializeGeoPoint),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function serializeAnalysisListItem(
  a: Analysis & { _count: { geoPoints: number } },
): AnalysisListItemOut {
  return {
    id: a.id,
    name: a.name,
    referenceHeight: a.referenceHeight,
    lineWidth: a.lineWidth,
    area: a.area,
    volume: a.volume,
    xSize: a.xSize,
    ySize: a.ySize,
    zSize: a.zSize,
    segmentDistances: a.segmentDistances,
    pointCount: a._count.geoPoints,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
