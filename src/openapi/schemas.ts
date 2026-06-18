import { z } from "@hono/zod-openapi";

/**
 * GeoPoint input — the JSON shape consumed by the Unity `GeoPoint`:
 * `{ longitude, latitude, height }`.
 */
export const GeoPointInputSchema = z
  .object({
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .openapi({ example: 106.827153, description: "WGS84 longitude in degrees" }),
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .openapi({ example: -6.175392, description: "WGS84 latitude in degrees" }),
    height: z
      .number()
      .openapi({ example: 12.5, description: "Height / altitude in metres" }),
  })
  .openapi("GeoPointInput");

export type GeoPointInput = z.infer<typeof GeoPointInputSchema>;

/** Partial GeoPoint body for updating a single point. */
export const GeoPointUpdateSchema = z
  .object({
    longitude: z.number().min(-180).max(180).optional().openapi({ example: 106.8272 }),
    latitude: z.number().min(-90).max(90).optional().openapi({ example: -6.1754 }),
    height: z.number().optional().openapi({ example: 13.0 }),
  })
  .openapi("GeoPointUpdate");

/** GeoPoint as stored and returned. */
export const GeoPointSchema = z
  .object({
    id: z.string().openapi({ example: "clx0geo000001" }),
    longitude: z.number().openapi({ example: 106.827153 }),
    latitude: z.number().openapi({ example: -6.175392 }),
    height: z.number().openapi({ example: 12.5 }),
    order: z.number().int().openapi({ example: 0, description: "0-based position in the polygon" }),
    analysisId: z.string().openapi({ example: "clx0analysis0001" }),
    createdAt: z
      .string()
      .openapi({ format: "date-time", example: "2026-06-18T08:00:00.000Z" }),
  })
  .openapi("GeoPoint");

/** Measurements derived from the polygon (matches the Unity component fields). */
export const MeasurementsSchema = z
  .object({
    area: z.number().openapi({ example: 1542.87, description: "Horizontal area (m²)" }),
    volume: z.number().openapi({ example: 19285.4, description: "area × |meanHeight − referenceHeight| (m³)" }),
    xSize: z.number().openapi({ example: 48.2, description: "Bounding-box East extent (m)" }),
    ySize: z.number().openapi({ example: 6.1, description: "Bounding-box Up extent (m)" }),
    zSize: z.number().openapi({ example: 33.7, description: "Bounding-box North extent (m)" }),
    segmentDistances: z
      .array(z.number())
      .openapi({ example: [48.2, 33.7, 48.1, 33.6], description: "Edge lengths in order (m)" }),
    pointCount: z.number().int().openapi({ example: 4 }),
  })
  .openapi("Measurements");

/** Body for creating an analysis. */
export const AnalysisCreateSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Stockpile A — June survey" }),
    referenceHeight: z
      .number()
      .default(0)
      .openapi({ example: 0, description: "Datum altitude for volume (m)" }),
    lineWidth: z
      .number()
      .positive()
      .default(3)
      .openapi({ example: 3, description: "Polygon outline width (visual only)" }),
    geoPoints: z
      .array(GeoPointInputSchema)
      .min(3)
      .openapi({ description: "Ordered polygon vertices (at least 3)" }),
  })
  .openapi("AnalysisCreate");

/** Body for updating an analysis. All fields optional. */
export const AnalysisUpdateSchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: "Stockpile A — July survey" }),
    referenceHeight: z.number().optional().openapi({ example: 1.5 }),
    lineWidth: z.number().positive().optional().openapi({ example: 4 }),
    geoPoints: z
      .array(GeoPointInputSchema)
      .min(3)
      .optional()
      .openapi({ description: "If provided, replaces all points and recomputes measurements" }),
  })
  .openapi("AnalysisUpdate");

/** Full analysis with points + measurements. */
export const AnalysisSchema = z
  .object({
    id: z.string().openapi({ example: "clx0analysis0001" }),
    name: z.string().openapi({ example: "Stockpile A — June survey" }),
    referenceHeight: z.number().openapi({ example: 0 }),
    lineWidth: z.number().openapi({ example: 3 }),
    area: z.number().nullable().openapi({ example: 1542.87 }),
    volume: z.number().nullable().openapi({ example: 19285.4 }),
    xSize: z.number().nullable().openapi({ example: 48.2 }),
    ySize: z.number().nullable().openapi({ example: 6.1 }),
    zSize: z.number().nullable().openapi({ example: 33.7 }),
    segmentDistances: z.array(z.number()).openapi({ example: [48.2, 33.7, 48.1, 33.6] }),
    geoPoints: z.array(GeoPointSchema),
    createdAt: z.string().openapi({ format: "date-time", example: "2026-06-18T08:00:00.000Z" }),
    updatedAt: z.string().openapi({ format: "date-time", example: "2026-06-18T08:00:00.000Z" }),
  })
  .openapi("Analysis");

/** Compact analysis for list responses (no points array). */
export const AnalysisListItemSchema = z
  .object({
    id: z.string().openapi({ example: "clx0analysis0001" }),
    name: z.string().openapi({ example: "Stockpile A — June survey" }),
    referenceHeight: z.number().openapi({ example: 0 }),
    lineWidth: z.number().openapi({ example: 3 }),
    area: z.number().nullable().openapi({ example: 1542.87 }),
    volume: z.number().nullable().openapi({ example: 19285.4 }),
    xSize: z.number().nullable().openapi({ example: 48.2 }),
    ySize: z.number().nullable().openapi({ example: 6.1 }),
    zSize: z.number().nullable().openapi({ example: 33.7 }),
    segmentDistances: z.array(z.number()).openapi({ example: [48.2, 33.7, 48.1, 33.6] }),
    pointCount: z.number().int().openapi({ example: 4 }),
    createdAt: z.string().openapi({ format: "date-time", example: "2026-06-18T08:00:00.000Z" }),
    updatedAt: z.string().openapi({ format: "date-time", example: "2026-06-18T08:00:00.000Z" }),
  })
  .openapi("AnalysisListItem");

/** Stateless compute request — measure a polygon without persisting it. */
export const ComputeRequestSchema = z
  .object({
    referenceHeight: z.number().default(0).openapi({ example: 0 }),
    geoPoints: z.array(GeoPointInputSchema).min(3).openapi({
      example: [
        { longitude: 106.827153, latitude: -6.175392, height: 12.5 },
        { longitude: 106.827553, latitude: -6.175392, height: 12.8 },
        { longitude: 106.827553, latitude: -6.175092, height: 13.1 },
        { longitude: 106.827153, latitude: -6.175092, height: 12.6 },
      ],
    }),
  })
  .openapi("ComputeRequest");

export const HealthSchema = z
  .object({
    status: z.string().openapi({ example: "ok" }),
    service: z.string().openapi({ example: "api-digital-twin-pama" }),
  })
  .openapi("Health");

/** Standard error envelope. */
export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Not Found" }),
    message: z.string().optional().openapi({ example: "Analysis clx0analysis0001 was not found" }),
  })
  .openapi("Error");

/** Reusable path param: an entity id. */
export const IdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    example: "clx0analysis0001",
  }),
});

export const AnalysisPointParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    example: "clx0analysis0001",
  }),
  pointId: z.string().openapi({
    param: { name: "pointId", in: "path" },
    example: "clx0geo000001",
  }),
});
