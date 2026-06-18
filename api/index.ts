import { handle } from "hono/vercel";
import app from "../src/app.ts";

// Vercel serves files in /api as serverless functions. The default runtime is
// Node.js, which is required here (Prisma's query compiler + the Neon driver).
export default handle(app);
