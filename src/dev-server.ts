import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.ts";

// Local development server. In production Vercel runs the default export from
// src/index.ts directly, so we serve the exact same app here.
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 API ready at http://localhost:${info.port}`);
  console.log(`📚 Docs (Scalar) at http://localhost:${info.port}/`);
  console.log(`📄 OpenAPI at http://localhost:${info.port}/openapi.json`);
});
