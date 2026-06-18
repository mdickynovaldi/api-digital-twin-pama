import { createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.ts";
import { computeMeasurements } from "../lib/geo.ts";
import { recomputeAnalysis, includePointsOrdered } from "../lib/analysis.ts";
import { createOpenAPIApp } from "../lib/validation.ts";
import {
  serializeAnalysis,
  serializeAnalysisListItem,
} from "../lib/serialize.ts";
import {
  AnalysisCreateSchema,
  AnalysisListItemSchema,
  AnalysisSchema,
  AnalysisUpdateSchema,
  ErrorSchema,
  IdParamSchema,
} from "../openapi/schemas.ts";

const app = createOpenAPIApp();

const TAG = "Analyses";

const jsonContent = <T>(schema: T) => ({ "application/json": { schema } });

// --- POST /analyses ---------------------------------------------------------
const createAnalysis = createRoute({
  method: "post",
  path: "/analyses",
  tags: [TAG],
  summary: "Create an analysis",
  description:
    "Create a volumetric analysis from an ordered polygon of geo points. Measurements are computed and stored automatically.",
  request: {
    body: { content: jsonContent(AnalysisCreateSchema), required: true },
  },
  responses: {
    201: { content: jsonContent(AnalysisSchema), description: "The created analysis" },
    400: { content: jsonContent(ErrorSchema), description: "Invalid input" },
  },
});

app.openapi(createAnalysis, async (c) => {
  const body = c.req.valid("json");
  const m = computeMeasurements(body.geoPoints, body.referenceHeight);

  const created = await prisma.analysis.create({
    data: {
      name: body.name,
      referenceHeight: body.referenceHeight,
      lineWidth: body.lineWidth,
      area: m.area,
      volume: m.volume,
      xSize: m.xSize,
      ySize: m.ySize,
      zSize: m.zSize,
      segmentDistances: m.segmentDistances,
      geoPoints: {
        create: body.geoPoints.map((p, index) => ({
          longitude: p.longitude,
          latitude: p.latitude,
          height: p.height,
          order: index,
        })),
      },
    },
    include: includePointsOrdered,
  });

  return c.json(serializeAnalysis(created), 201);
});

// --- GET /analyses ----------------------------------------------------------
const listAnalyses = createRoute({
  method: "get",
  path: "/analyses",
  tags: [TAG],
  summary: "List analyses",
  description: "List all analyses (most recent first) with their measurements and point counts.",
  responses: {
    200: {
      content: jsonContent(z.array(AnalysisListItemSchema)),
      description: "Array of analyses",
    },
  },
});

app.openapi(listAnalyses, async (c) => {
  const items = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { geoPoints: true } } },
  });
  return c.json(items.map(serializeAnalysisListItem), 200);
});

// --- GET /analyses/{id} -----------------------------------------------------
const getAnalysis = createRoute({
  method: "get",
  path: "/analyses/{id}",
  tags: [TAG],
  summary: "Get an analysis",
  request: { params: IdParamSchema },
  responses: {
    200: { content: jsonContent(AnalysisSchema), description: "The analysis with its geo points" },
    404: { content: jsonContent(ErrorSchema), description: "Not found" },
  },
});

app.openapi(getAnalysis, async (c) => {
  const { id } = c.req.valid("param");
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: includePointsOrdered,
  });
  if (!analysis) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  return c.json(serializeAnalysis(analysis), 200);
});

// --- PATCH /analyses/{id} ---------------------------------------------------
const updateAnalysis = createRoute({
  method: "patch",
  path: "/analyses/{id}",
  tags: [TAG],
  summary: "Update an analysis",
  description:
    "Update metadata and/or replace the polygon points. Measurements are recomputed automatically.",
  request: {
    params: IdParamSchema,
    body: { content: jsonContent(AnalysisUpdateSchema), required: true },
  },
  responses: {
    200: { content: jsonContent(AnalysisSchema), description: "The updated analysis" },
    400: { content: jsonContent(ErrorSchema), description: "Invalid input" },
    404: { content: jsonContent(ErrorSchema), description: "Not found" },
  },
});

app.openapi(updateAnalysis, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await prisma.analysis.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }

  // Update scalar metadata (only the provided fields).
  await prisma.analysis.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.referenceHeight !== undefined ? { referenceHeight: body.referenceHeight } : {}),
      ...(body.lineWidth !== undefined ? { lineWidth: body.lineWidth } : {}),
    },
  });

  // Replace the whole polygon if new points were supplied.
  if (body.geoPoints) {
    await prisma.$transaction([
      prisma.geoPoint.deleteMany({ where: { analysisId: id } }),
      prisma.geoPoint.createMany({
        data: body.geoPoints.map((p, index) => ({
          analysisId: id,
          longitude: p.longitude,
          latitude: p.latitude,
          height: p.height,
          order: index,
        })),
      }),
    ]);
  }

  const updated = await recomputeAnalysis(id);
  if (!updated) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  return c.json(serializeAnalysis(updated), 200);
});

// --- DELETE /analyses/{id} --------------------------------------------------
const deleteAnalysis = createRoute({
  method: "delete",
  path: "/analyses/{id}",
  tags: [TAG],
  summary: "Delete an analysis",
  request: { params: IdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: { content: jsonContent(ErrorSchema), description: "Not found" },
  },
});

app.openapi(deleteAnalysis, async (c) => {
  const { id } = c.req.valid("param");
  const existing = await prisma.analysis.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return c.json({ error: "Not Found", message: `Analysis ${id} was not found` }, 404);
  }
  await prisma.analysis.delete({ where: { id } });
  return c.body(null, 204);
});

export default app;
