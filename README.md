# API Digital Twin — Volumetric / GeoPoint

API untuk **geo point (WGS84)** dan **analisis volumetrik polygon**, dibuat berdasarkan script Unity `RuntimeVolumetricVisualizer`. Bentuk JSON geo point sama persis seperti `GeoPoint` di script:

```json
{ "longitude": 106.827153, "latitude": -6.175392, "height": 12.5 }
```

Stack: **Hono** (web framework) · **Prisma 7** (ORM, Neon driver adapter) · **Scalar** (dokumentasi API) · **Vercel** (deploy) · **Neon** (PostgreSQL serverless).

---

## Fitur

- CRUD **Analysis** (polygon = kumpulan geo point + hasil pengukuran).
- CRUD **Geo Point** di dalam sebuah analysis (tambah / ubah / hapus titik, urutan dijaga otomatis).
- Endpoint **`/compute`** stateless: hitung area, volume, ukuran bounding box, dan panjang tiap sisi tanpa menyimpan ke DB.
- Pengukuran (area, volume, xSize/ySize/zSize, segmentDistances) **dihitung otomatis** dan disimpan setiap kali titik berubah.
- Dokumentasi interaktif (Scalar) di `/` dan spesifikasi OpenAPI 3.1 di `/openapi.json`.

### Bagaimana pengukuran dihitung

Port dari pipeline Unity (`ComputeBounds/Area/Distances/Volume`). Karena di server tidak ada Cesium georeference, titik diproyeksikan ke bidang singgung lokal **ENU (East-North-Up)** yang berpusat di centroid polygon (satuan meter), dengan pemetaan ala Unity: `x = East`, `y = Up`, `z = North`.

| Field | Arti |
|------|------|
| `area` | Luas horizontal (shoelace di bidang East-North), m² |
| `volume` | `area × \|meanHeight − referenceHeight\|`, m³ |
| `xSize` / `ySize` / `zSize` | Rentang bounding box (East / Up / North), m |
| `segmentDistances` | Panjang tiap sisi polygon berurutan (3D), m |

`referenceHeight` diperlakukan sebagai datum ketinggian (mis. permukaan tanah/lantai), satuan sama dengan `height`.

---

## Endpoint

| Method | Path | Keterangan |
|--------|------|-----------|
| `GET` | `/` | Dokumentasi (Scalar UI) |
| `GET` | `/openapi.json` | Spesifikasi OpenAPI 3.1 |
| `GET` | `/health` | Health check |
| `POST` | `/compute` | Hitung pengukuran (tanpa simpan) |
| `GET` | `/geo-points` | List **semua** titik lintas analysis, bentuk murni `{ longitude, latitude, height }` (tanpa id) |
| `POST` | `/analyses` | Buat analysis |
| `GET` | `/analyses` | List analysis |
| `GET` | `/analyses/{id}` | Detail analysis + titik |
| `PATCH` | `/analyses/{id}` | Ubah metadata / ganti semua titik |
| `DELETE` | `/analyses/{id}` | Hapus analysis (cascade ke titik) |
| `GET` | `/analyses/{id}/geo-points` | List titik |
| `POST` | `/analyses/{id}/geo-points` | Tambah titik |
| `PATCH` | `/analyses/{id}/geo-points/{pointId}` | Ubah titik |
| `DELETE` | `/analyses/{id}/geo-points/{pointId}` | Hapus titik |

---

## Menjalankan secara lokal

### 1. Install dependency

```bash
npm install
```

(`postinstall` otomatis menjalankan `prisma generate`.)

### 2. Siapkan database Neon

1. Buat project gratis di [neon.tech](https://neon.tech).
2. Salin **dua** connection string dari dashboard Neon:
   - **Pooled** (host mengandung `-pooler`) → untuk `DATABASE_URL`.
   - **Direct** (tanpa `-pooler`) → untuk `DIRECT_URL`.
3. Buat file `.env` (lihat `.env.example`):

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

### 3. Buat skema di database

```bash
npm run db:deploy   # menerapkan migration prisma/migrations (disarankan)
# atau, untuk prototyping cepat:
npm run db:push     # push skema tanpa file migration
```

(Opsional) isi data contoh:

```bash
npm run db:seed
```

### 4. Jalankan server dev

```bash
npm run dev
```

- API & docs: <http://localhost:3000/>
- OpenAPI: <http://localhost:3000/openapi.json>

### 5. Tes

```bash
npm run typecheck          # cek TypeScript
npm run test:smoke         # tes HTTP/OpenAPI/geometry (tanpa DB)
npm run test:integration   # tes CRUD lengkap (butuh DATABASE_URL aktif)
```

---

## Deploy ke Vercel + Neon

1. Push repo ini ke GitHub/GitLab, lalu **Import Project** di [vercel.com](https://vercel.com).
2. Di **Settings → Environment Variables**, tambahkan:
   - `DATABASE_URL` → connection string **pooled** Neon.
   - `DIRECT_URL` → connection string **direct** Neon.
3. Deploy. **Zero-config** — Vercel mendeteksi preset **Hono** secara otomatis lewat entrypoint `src/index.ts` (yang `export default` sebuah app Hono), dan mengubah route-nya menjadi Vercel Functions (Node.js runtime, Fluid compute). `prisma generate` jalan otomatis di `postinstall` sebelum bundling. Tidak perlu `vercel.json`.
4. Jalankan migration ke database produksi (sekali saja), dari mesin lokal yang `.env`-nya mengarah ke Neon:

   ```bash
   npm run db:deploy
   ```

   > Tip: bisa juga dijadikan bagian build dengan mengubah Build Command menjadi `prisma generate && prisma migrate deploy`. Pastikan `DIRECT_URL` tersedia saat build.

5. Buka URL produksi → tampil dokumentasi Scalar. Selesai. 🎉

### Kenapa Prisma 7 cocok untuk Vercel + Neon

Prisma 7 memakai **query compiler berbasis WASM** + **driver adapter** (tanpa engine binary Rust). Artinya tidak ada masalah binary target di serverless, dan koneksi ke Neon lewat `@prisma/adapter-neon` (driver serverless WebSocket Neon) yang ramah cold-start.

---

## Contoh request

Hitung cepat (tanpa simpan):

```bash
curl -X POST http://localhost:3000/compute \
  -H "content-type: application/json" \
  -d '{
    "referenceHeight": 0,
    "geoPoints": [
      { "longitude": 106.827153, "latitude": -6.175392, "height": 12.5 },
      { "longitude": 106.827553, "latitude": -6.175392, "height": 12.8 },
      { "longitude": 106.827553, "latitude": -6.175092, "height": 13.1 },
      { "longitude": 106.827153, "latitude": -6.175092, "height": 12.6 }
    ]
  }'
```

Buat analysis:

```bash
curl -X POST http://localhost:3000/analyses \
  -H "content-type: application/json" \
  -d '{
    "name": "Stockpile A",
    "referenceHeight": 0,
    "geoPoints": [
      { "longitude": 106.827153, "latitude": -6.175392, "height": 12.5 },
      { "longitude": 106.827553, "latitude": -6.175392, "height": 12.8 },
      { "longitude": 106.827553, "latitude": -6.175092, "height": 13.1 }
    ]
  }'
```

---

## Struktur proyek

```
src/
  index.ts              # Entrypoint Vercel (plain Hono, default export) — preset Hono
  application.ts        # OpenAPIHono: middleware, routes, OpenAPI doc, Scalar UI
  dev-server.ts         # Server lokal (@hono/node-server)
  lib/
    prisma.ts           # Prisma Client + Neon driver adapter (singleton)
    geo.ts              # Port geometri Unity (WGS84 → ENU → pengukuran)
    analysis.ts         # Helper recompute & reindex
    serialize.ts        # Konversi hasil Prisma → JSON
    validation.ts       # Hook validasi + factory OpenAPIHono
  routes/
    analyses.ts         # CRUD analysis
    geoPoints.ts        # CRUD geo point
    compute.ts          # /compute stateless
  openapi/schemas.ts    # Skema Zod + komponen OpenAPI
prisma/
  schema.prisma         # Model Analysis & GeoPoint
  migrations/           # Migration SQL awal (0_init)
  seed.ts               # Data contoh
prisma.config.ts        # Konfigurasi CLI Prisma 7
test/                   # Smoke & integration test
```
