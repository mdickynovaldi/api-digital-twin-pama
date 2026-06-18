import { OpenAPIHono } from "@hono/zod-openapi";

/**
 * Shared validation hook: turns zod request-validation failures into our
 * standard `{ error, message }` envelope with a 400 status.
 */
export const defaultHook = (
  result: { success: boolean; error?: { issues?: Array<{ path?: unknown[]; message: string }> } },
  c: { json: (body: unknown, status: 400) => Response },
): Response | undefined => {
  if (!result.success) {
    const issue = result.error?.issues?.[0];
    const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
    const message = issue
      ? `${path ? `${path}: ` : ""}${issue.message}`
      : "Validation failed";
    return c.json({ error: "Bad Request", message }, 400);
  }
  return undefined;
};

/** Factory for an OpenAPIHono instance wired with the shared validation hook. */
export function createOpenAPIApp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OpenAPIHono({ defaultHook: defaultHook as any });
}
