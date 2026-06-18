import { createRoute } from "@hono/zod-openapi";
import { computeMeasurements } from "../lib/geo.ts";
import { createOpenAPIApp } from "../lib/validation.ts";
import {
  ComputeRequestSchema,
  ErrorSchema,
  MeasurementsSchema,
} from "../openapi/schemas.ts";

const app = createOpenAPIApp();

const jsonContent = <T>(schema: T) => ({ "application/json": { schema } });

// --- POST /compute ----------------------------------------------------------
const compute = createRoute({
  method: "post",
  path: "/compute",
  tags: ["Compute"],
  summary: "Compute measurements (stateless)",
  description:
    "Compute area, volume, bounding-box sizes and edge distances for a polygon of geo points without persisting anything. Mirrors the Unity RuntimeVolumetricVisualizer measurement pipeline.",
  request: {
    body: { content: jsonContent(ComputeRequestSchema), required: true },
  },
  responses: {
    200: { content: jsonContent(MeasurementsSchema), description: "Computed measurements" },
    400: { content: jsonContent(ErrorSchema), description: "Invalid input" },
  },
});

app.openapi(compute, async (c) => {
  const body = c.req.valid("json");
  const measurements = computeMeasurements(body.geoPoints, body.referenceHeight);
  return c.json(measurements, 200);
});

export default app;
