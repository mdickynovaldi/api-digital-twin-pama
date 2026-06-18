import { createRoute } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Scalar } from "@scalar/hono-api-reference";

import { createOpenAPIApp } from "./lib/validation.ts";
import { HealthSchema } from "./openapi/schemas.ts";
import analyses from "./routes/analyses.ts";
import geoPoints from "./routes/geoPoints.ts";
import compute from "./routes/compute.ts";

// The OpenAPI-aware application. It is mounted into a plain Hono instance in
// src/index.ts (Vercel's Hono preset expects a plain `new Hono()` default export).
const app = createOpenAPIApp();

// --- Middleware -------------------------------------------------------------
app.use("*", logger());
app.use("*", cors());

// --- Health -----------------------------------------------------------------
const health = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  responses: {
    200: {
      content: { "application/json": { schema: HealthSchema } },
      description: "Service is up",
    },
  },
});

app.openapi(health, (c) =>
  c.json({ status: "ok", service: "api-digital-twin-pama" }, 200),
);

// --- Feature routes ---------------------------------------------------------
app.route("/", analyses);
app.route("/", geoPoints);
app.route("/", compute);

// --- OpenAPI document -------------------------------------------------------
app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Digital Twin — Volumetric / GeoPoint API",
    version: "1.0.0",
    description:
      "API for WGS84 geo points and volumetric polygon analysis, based on the Unity `RuntimeVolumetricVisualizer`. " +
      "GeoPoint JSON shape: `{ longitude, latitude, height }`.",
  },
  servers: [{ url: "/", description: "Current host" }],
  tags: [
    { name: "Analyses", description: "Polygon analyses + their measurements" },
    { name: "Geo points", description: "Individual WGS84 points of an analysis" },
    { name: "Compute", description: "Stateless measurement helper" },
    { name: "System", description: "Health & meta" },
  ],
});

// --- Scalar API reference (docs UI) -----------------------------------------
app.get(
  "/",
  Scalar({
    url: "/openapi.json",
    pageTitle: "Digital Twin API — Reference",
    theme: "purple",
  }),
);

export default app;
