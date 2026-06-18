import { createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.ts";
import { recomputeAnalysis, reindexPoints } from "../lib/analysis.ts";
import { createOpenAPIApp } from "../lib/validation.ts";
import { serializeAnalysis, serializeGeoPoint } from "../lib/serialize.ts";
import {
  AnalysisSchema,
  AnalysisPointParamSchema,
  ErrorSchema,
  GeoPointInputSchema,
  GeoPointSchema,
  GeoPointUpdateSchema,
  IdParamSchema,
} from "../openapi/schemas.ts";

const app = createOpenAPIApp();

const TAG = "Geo points";
const jsonContent = <T>(schema: T) => ({ "application/json": { schema } });

async function analysisExists(id: string): Promise<boolean> {
  const found = await prisma.analysis.findUnique({ where: { id }, select: { id: true } });
  return found !== null;
}

// --- GET /analyses/{id}/geo-points ------------------------------------------
const listPoints = createRoute({
  method: "get",
  path: "/analyses/{id}/geo-points",
  tags: [TAG],
  summary: "List an analysis' geo points",
  request: { params: IdParamSchema },
  responses: {
    200: { content: jsonContent(z.array(GeoPointSchema)), description: "Ordered geo points" },
    404: { content: jsonContent(ErrorSchema), description: "Analysis not found" },
  },
});

app.openapi(listPoints, async (c) => {
  const { id } = c.req.valid("param");
  if (!(await analysisExists(id))) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  const points = await prisma.geoPoint.findMany({
    where: { analysisId: id },
    orderBy: { order: "asc" },
  });
  return c.json(points.map(serializeGeoPoint), 200);
});

// --- POST /analyses/{id}/geo-points -----------------------------------------
const addPoint = createRoute({
  method: "post",
  path: "/analyses/{id}/geo-points",
  tags: [TAG],
  summary: "Append a geo point",
  description: "Append a point to the polygon and recompute the analysis measurements.",
  request: {
    params: IdParamSchema,
    body: { content: jsonContent(GeoPointInputSchema), required: true },
  },
  responses: {
    201: { content: jsonContent(AnalysisSchema), description: "The updated analysis" },
    400: { content: jsonContent(ErrorSchema), description: "Invalid input" },
    404: { content: jsonContent(ErrorSchema), description: "Analysis not found" },
  },
});

app.openapi(addPoint, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  if (!(await analysisExists(id))) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }

  const count = await prisma.geoPoint.count({ where: { analysisId: id } });
  await prisma.geoPoint.create({
    data: {
      analysisId: id,
      longitude: body.longitude,
      latitude: body.latitude,
      height: body.height,
      order: count,
    },
  });

  const updated = await recomputeAnalysis(id);
  if (!updated) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  return c.json(serializeAnalysis(updated), 201);
});

// --- PATCH /analyses/{id}/geo-points/{pointId} ------------------------------
const updatePoint = createRoute({
  method: "patch",
  path: "/analyses/{id}/geo-points/{pointId}",
  tags: [TAG],
  summary: "Update a geo point",
  request: {
    params: AnalysisPointParamSchema,
    body: { content: jsonContent(GeoPointUpdateSchema), required: true },
  },
  responses: {
    200: { content: jsonContent(AnalysisSchema), description: "The updated analysis" },
    400: { content: jsonContent(ErrorSchema), description: "Invalid input" },
    404: { content: jsonContent(ErrorSchema), description: "Analysis or point not found" },
  },
});

app.openapi(updatePoint, async (c) => {
  const { id, pointId } = c.req.valid("param");
  const body = c.req.valid("json");

  const point = await prisma.geoPoint.findFirst({
    where: { id: pointId, analysisId: id },
    select: { id: true },
  });
  if (!point) {
    return c.json(
      { error: "Not Found", message: `Geo point ${pointId} was not found in analysis ${id}` },
      404,
    );
  }

  await prisma.geoPoint.update({
    where: { id: pointId },
    data: {
      ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
      ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
      ...(body.height !== undefined ? { height: body.height } : {}),
    },
  });

  const updated = await recomputeAnalysis(id);
  if (!updated) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  return c.json(serializeAnalysis(updated), 200);
});

// --- DELETE /analyses/{id}/geo-points/{pointId} -----------------------------
const deletePoint = createRoute({
  method: "delete",
  path: "/analyses/{id}/geo-points/{pointId}",
  tags: [TAG],
  summary: "Delete a geo point",
  description: "Remove a point, re-index the remaining points, and recompute measurements.",
  request: { params: AnalysisPointParamSchema },
  responses: {
    200: { content: jsonContent(AnalysisSchema), description: "The updated analysis" },
    404: { content: jsonContent(ErrorSchema), description: "Analysis or point not found" },
  },
});

app.openapi(deletePoint, async (c) => {
  const { id, pointId } = c.req.valid("param");

  const point = await prisma.geoPoint.findFirst({
    where: { id: pointId, analysisId: id },
    select: { id: true },
  });
  if (!point) {
    return c.json(
      { error: "Not Found", message: `Geo point ${pointId} was not found in analysis ${id}` },
      404,
    );
  }

  await prisma.geoPoint.delete({ where: { id: pointId } });
  await reindexPoints(id);

  const updated = await recomputeAnalysis(id);
  if (!updated) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  return c.json(serializeAnalysis(updated), 200);
});

export default app;
