import app from "../src/app.ts";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}`, extra ?? "");
  }
}

// GET /health
{
  const res = await app.request("/health");
  const body = (await res.json()) as any;
  check("GET /health -> 200", res.status === 200, res.status);
  check("health status ok", body.status === "ok", body);
}

// GET /openapi.json (exercises zod v4 -> OpenAPI generation)
{
  const res = await app.request("/openapi.json");
  const doc = (await res.json()) as any;
  check("GET /openapi.json -> 200", res.status === 200, res.status);
  check("openapi version 3.1.0", doc.openapi === "3.1.0", doc.openapi);
  check("has /analyses path", !!doc.paths?.["/analyses"], Object.keys(doc.paths ?? {}));
  check("has /compute path", !!doc.paths?.["/compute"]);
  check(
    "has GeoPointInput component",
    !!doc.components?.schemas?.GeoPointInput,
    Object.keys(doc.components?.schemas ?? {}),
  );
}

// GET / (Scalar docs UI -> HTML)
{
  const res = await app.request("/");
  const text = await res.text();
  check("GET / -> 200", res.status === 200, res.status);
  check("docs HTML mentions scalar", /scalar/i.test(text));
}

// POST /compute (stateless geometry, no DB)
{
  const res = await app.request("/compute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      referenceHeight: 0,
      geoPoints: [
        { longitude: 106.827153, latitude: -6.175392, height: 12.5 },
        { longitude: 106.827553, latitude: -6.175392, height: 12.8 },
        { longitude: 106.827553, latitude: -6.175092, height: 13.1 },
        { longitude: 106.827153, latitude: -6.175092, height: 12.6 },
      ],
    }),
  });
  const body = (await res.json()) as any;
  check("POST /compute -> 200", res.status === 200, res.status);
  check("area ~1470 m²", body.area > 1300 && body.area < 1600, body.area);
  check("volume ~18700 m³", body.volume > 17000 && body.volume < 20000, body.volume);
  check("xSize ~44 m (east)", body.xSize > 40 && body.xSize < 48, body.xSize);
  check("zSize ~33 m (north)", body.zSize > 30 && body.zSize < 36, body.zSize);
  check("4 segment distances", body.segmentDistances.length === 4, body.segmentDistances);
  check("pointCount = 4", body.pointCount === 4);
}

// POST /compute validation failure (only 2 points -> 400)
{
  const res = await app.request("/compute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      geoPoints: [
        { longitude: 106.8, latitude: -6.1, height: 1 },
        { longitude: 106.9, latitude: -6.1, height: 1 },
      ],
    }),
  });
  const body = (await res.json()) as any;
  check("POST /compute (2 pts) -> 400", res.status === 400, res.status);
  check("error envelope present", body.error === "Bad Request", body);
}

// 404 fallback
{
  const res = await app.request("/does-not-exist");
  check("unknown route -> 404", res.status === 404, res.status);
}

console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
