/**
 * Geometry port of the Unity `RuntimeVolumetricVisualizer`.
 *
 * The Unity script converts each WGS84 geo point to ECEF, then to Cesium/Unity
 * local space, and measures area / volume / bounds / edge lengths in that local
 * frame. We reproduce the same measurements server-side (without a Cesium
 * georeference) by projecting the points onto a local East-North-Up (ENU)
 * tangent plane centred on the polygon's centroid.
 *
 * Local axis mapping (matches Unity's Y-up, XZ-ground convention):
 *   x = East, y = Up, z = North   (all in metres)
 */

export interface GeoPointLike {
  longitude: number;
  latitude: number;
  height: number;
}

export interface Measurements {
  /** Horizontal polygon area (shoelace, ENU east-north plane), m². */
  area: number;
  /** area * |meanHeight - referenceHeight|, m³. */
  volume: number;
  /** Bounding-box extent along East, m. */
  xSize: number;
  /** Bounding-box extent along Up, m. */
  ySize: number;
  /** Bounding-box extent along North, m. */
  zSize: number;
  /** Length of each polygon edge in order, looping back to the first point, m. */
  segmentDistances: number[];
  /** Number of points used in the computation. */
  pointCount: number;
}

// WGS84 ellipsoid constants.
const WGS84_A = 6_378_137.0; // semi-major axis (m)
const WGS84_E2 = 6.694_379_990_141_316e-3; // first eccentricity squared

const toRad = (deg: number): number => (deg * Math.PI) / 180;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function geodeticToEcef(p: GeoPointLike): Vec3 {
  const lat = toRad(p.latitude);
  const lon = toRad(p.longitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return {
    x: (n + p.height) * cosLat * Math.cos(lon),
    y: (n + p.height) * cosLat * Math.sin(lon),
    z: (n * (1 - WGS84_E2) + p.height) * sinLat,
  };
}

/**
 * Project geo points into a local ENU frame (metres) centred on their centroid.
 * Returned vectors use Unity's mapping: x = East, y = Up, z = North.
 */
function toLocalEnu(points: GeoPointLike[]): Vec3[] {
  const lat0 = toRad(average(points.map((p) => p.latitude)));
  const lon0 = toRad(average(points.map((p) => p.longitude)));
  const origin = geodeticToEcef({
    longitude: average(points.map((p) => p.longitude)),
    latitude: average(points.map((p) => p.latitude)),
    height: average(points.map((p) => p.height)),
  });

  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const sinLon0 = Math.sin(lon0);
  const cosLon0 = Math.cos(lon0);

  return points.map((p) => {
    const ecef = geodeticToEcef(p);
    const dx = ecef.x - origin.x;
    const dy = ecef.y - origin.y;
    const dz = ecef.z - origin.z;

    const east = -sinLon0 * dx + cosLon0 * dy;
    const north =
      -sinLat0 * cosLon0 * dx - sinLat0 * sinLon0 * dy + cosLat0 * dz;
    const up = cosLat0 * cosLon0 * dx + cosLat0 * sinLon0 * dy + sinLat0 * dz;

    return { x: east, y: up, z: north };
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute the volumetric measurements for an ordered polygon of geo points.
 * Mirrors `ComputeBounds`, `ComputeArea`, `ComputeDistances`, `ComputeVolume`.
 */
export function computeMeasurements(
  points: GeoPointLike[],
  referenceHeight = 0,
): Measurements {
  const pointCount = points.length;

  if (pointCount === 0) {
    return {
      area: 0,
      volume: 0,
      xSize: 0,
      ySize: 0,
      zSize: 0,
      segmentDistances: [],
      pointCount: 0,
    };
  }

  const local = toLocalEnu(points);

  // --- Bounds ---
  let minX = local[0].x;
  let maxX = local[0].x;
  let minY = local[0].y;
  let maxY = local[0].y;
  let minZ = local[0].z;
  let maxZ = local[0].z;
  for (const v of local) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  }

  // --- Area (shoelace over the East-North plane) ---
  let area = 0;
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = local[(i + 1) % local.length];
    area += a.x * b.z - b.x * a.z;
  }
  area = Math.abs(area) * 0.5;

  // --- Segment distances (3D, cyclic) ---
  const segmentDistances: number[] = [];
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = local[(i + 1) % local.length];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    segmentDistances.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  // --- Volume = area * |meanHeight - referenceHeight| ---
  // `referenceHeight` is treated as an absolute altitude datum (the same units
  // as the geo point `height`), matching the script's prismatic volume idea.
  const meanHeight = average(points.map((p) => p.height));
  const volume = pointCount < 3 ? 0 : area * Math.abs(meanHeight - referenceHeight);

  return {
    area,
    volume,
    xSize: maxX - minX,
    ySize: maxY - minY,
    zSize: maxZ - minZ,
    segmentDistances,
    pointCount,
  };
}
