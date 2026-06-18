import "dotenv/config";
import app from "../src/app.ts";

/**
 * Full CRUD lifecycle test against a REAL database (the one in DATABASE_URL).
 * Run it once after `npm run db:push` (or `db:deploy`) against your Neon DB:
 *
 *   npm run test:integration
 *
 * It creates, mutates and deletes its own data, so it is safe to re-run.
 */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}`, extra ?? "");
  }
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const basePoints = [
  { longitude: 106.827153, latitude: -6.175392, height: 12.5 },
  { longitude: 106.827553, latitude: -6.175392, height: 12.8 },
  { longitude: 106.827553, latitude: -6.175092, height: 13.1 },
];

let analysisId = "";

// CREATE
{
  const res = await app.request("/analyses", json({ name: "Integration test", geoPoints: basePoints }));
  const body = (await res.json()) as any;
  check("POST /analyses -> 201", res.status === 201, res.status);
  check("has id", typeof body.id === "string", body);
  check("3 points stored", body.geoPoints?.length === 3, body.geoPoints?.length);
  check("area computed", typeof body.area === "number" && body.area > 0, body.area);
  analysisId = body.id;
}

// LIST
{
  const res = await app.request("/analyses");
  const body = (await res.json()) as any;
  check("GET /analyses -> 200", res.status === 200);
  check("created analysis appears with pointCount=3", body.some((a: { id: string; pointCount: number }) => a.id === analysisId && a.pointCount === 3));
}

// GET ONE
{
  const res = await app.request(`/analyses/${analysisId}`);
  check("GET /analyses/{id} -> 200", res.status === 200, res.status);
}

// ADD POINT
{
  const res = await app.request(`/analyses/${analysisId}/geo-points`, json({ longitude: 106.827153, latitude: -6.175092, height: 12.6 }));
  const body = (await res.json()) as any;
  check("POST geo-points -> 201", res.status === 201, res.status);
  check("now 4 points, ordered 0..3", JSON.stringify(body.geoPoints.map((p: { order: number }) => p.order)) === "[0,1,2,3]", body.geoPoints?.map((p: { order: number }) => p.order));
}

// UPDATE A POINT
let firstPointId = "";
{
  const res = await app.request(`/analyses/${analysisId}`);
  const body = (await res.json()) as any;
  firstPointId = body.geoPoints[0].id;
  const upd = await app.request(`/analyses/${analysisId}/geo-points/${firstPointId}`, { ...json({ height: 99 }), method: "PATCH" });
  const updBody = (await upd.json()) as any;
  check("PATCH point -> 200", upd.status === 200, upd.status);
  check("point height updated", updBody.geoPoints.find((p: { id: string; height: number }) => p.id === firstPointId)?.height === 99);
}

// DELETE A POINT (and re-index)
{
  const res = await app.request(`/analyses/${analysisId}/geo-points/${firstPointId}`, { method: "DELETE" });
  const body = (await res.json()) as any;
  check("DELETE point -> 200", res.status === 200, res.status);
  check("back to 3 points, re-indexed 0..2", JSON.stringify(body.geoPoints.map((p: { order: number }) => p.order)) === "[0,1,2]", body.geoPoints?.map((p: { order: number }) => p.order));
}

// REPLACE POINTS via PATCH
{
  const res = await app.request(`/analyses/${analysisId}`, {
    ...json({ referenceHeight: 5, geoPoints: basePoints }),
    method: "PATCH",
  });
  const body = (await res.json()) as any;
  check("PATCH replace points -> 200", res.status === 200, res.status);
  check("referenceHeight updated", body.referenceHeight === 5, body.referenceHeight);
  check("3 points after replace", body.geoPoints.length === 3);
}

// DELETE ANALYSIS (cascade)
{
  const res = await app.request(`/analyses/${analysisId}`, { method: "DELETE" });
  check("DELETE analysis -> 204", res.status === 204, res.status);
  const after = await app.request(`/analyses/${analysisId}`);
  check("GET deleted -> 404", after.status === 404, after.status);
}

console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
