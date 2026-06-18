import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.ts";

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 API ready at http://localhost:${info.port}`);
  console.log(`📚 Docs (Scalar) at http://localhost:${info.port}/`);
  console.log(`📄 OpenAPI at http://localhost:${info.port}/openapi.json`);
});
