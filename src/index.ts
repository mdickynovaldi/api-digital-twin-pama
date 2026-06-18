import { Hono } from "hono";
import app from "./application.ts";

/**
 * Vercel's zero-config Hono preset scans for a file at app/index/server (root
 * or src/) that default-exports a PLAIN `new Hono()` instance, and turns its
 * routes into Vercel Functions (Fluid compute) on the Node.js runtime.
 *
 * Our actual app is an OpenAPIHono (from @hono/zod-openapi); we mount it inside
 * a plain Hono here so the default export is exactly what the preset expects.
 */
const root = new Hono();

root.route("/", app);

root.notFound((c) =>
  c.json(
    { error: "Not Found", message: `No route for ${c.req.method} ${c.req.path}` },
    404,
  ),
);

root.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

export default root;
