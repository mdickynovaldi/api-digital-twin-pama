import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";
import { computeMeasurements } from "../src/lib/geo.ts";

/**
 * Seeds a sample analysis (a ~44m × ~33m quad near Jakarta) so the API has
 * something to return out of the box.
 */
async function main() {
  const geoPoints = [
    { longitude: 106.827153, latitude: -6.175392, height: 12.5 },
    { longitude: 106.827553, latitude: -6.175392, height: 12.8 },
    { longitude: 106.827553, latitude: -6.175092, height: 13.1 },
    { longitude: 106.827153, latitude: -6.175092, height: 12.6 },
  ];
  const referenceHeight = 0;

  const m = computeMeasurements(geoPoints, referenceHeight);

  const analysis = await prisma.analysis.create({
    data: {
      name: "Sample stockpile — Monas area",
      referenceHeight,
      lineWidth: 3,
      area: m.area,
      volume: m.volume,
      xSize: m.xSize,
      ySize: m.ySize,
      zSize: m.zSize,
      segmentDistances: m.segmentDistances,
      geoPoints: {
        create: geoPoints.map((p, index) => ({ ...p, order: index })),
      },
    },
    include: { geoPoints: { orderBy: { order: "asc" } } },
  });

  console.log(`✅ Seeded analysis ${analysis.id} with ${analysis.geoPoints.length} points`);
  console.log(`   area=${m.area.toFixed(2)} m²  volume=${m.volume.toFixed(2)} m³`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
