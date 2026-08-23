# ECGO Power Systems — Battery Swap Station Dashboard

Dashboard manajemen stasiun tukar baterai: daftar cabinet (pencarian, filter status,
sorting berdasarkan swap 24 jam terakhir, pagination) dan halaman detail per cabinet
(grid 12 slot baterai dengan SOC, grafik swap per jam 24 jam terakhir, serta 20
transaksi swap terakhir).

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Prisma 7** dengan driver adapter `@prisma/adapter-pg`
- **PostgreSQL**
- **Tailwind CSS v4** — semua styling termasuk grafik bar (tanpa library chart)
- **Zod v4** — validasi input API dan format error yang konsisten
- **Bun** sebagai package manager & runtime

## Cara Setup

### Opti 1: With Docker (Automatic setup DB)

1. Salin .env.example menjadi .env.docker:
  ```bash
  cp .env.example .env.docker
  ```
  
2. **PENTING**: Ubah variabel DB_HOST dari localhost menjadi postgres pada file .env.docker.

3. Jalankan container:
  ```bash
  docker compose up -d --build
  ```
  
4. Buka <http://localhost:3000>.

### Opti 2: With npm

1. Pastikan PostgreSQL sudah berjalan.
2. Clone repo, lalu install dependencies:

   ```bash
   npm install
   ```

3. Siapkan environment — salin `.env.example` ke `.env` dan sesuaikan kredensial DB:

   ```bash
   cp .env.example .env
   ```

4. Jalankan migrasi untuk membuat tabel:

   ```bash
   npx prisma migrate dev
   ```

5. Generate prisma client

  ```bash
   npx prisma generate
   ```

6. Seed data (50 cabinet, 600 slot, 20.000 transaksi tersebar 30 hari):

   ```bash
   npx prisma db seed
   ```

7. Jalankan dev server:

   ```bash
   npm run dev
   ```

8. Buka <http://localhost:3000>.

### Opti 3: With bun

1. Pastikan PostgreSQL sudah berjalan.
2. Clone repo, lalu install dependencies:

   ```bash
   bun install
   ```

3. Siapkan environment — salin `.env.example` ke `.env` dan sesuaikan kredensial DB:

   ```bash
   cp .env.example .env
   ```

4. Jalankan migrasi untuk membuat tabel:

   ```bash
   bunx prisma migrate dev
   ```

5. Generate prisma client

  ```bash
   bunx prisma generate
   ```

6. Seed data (50 cabinet, 600 slot, 20.000 transaksi tersebar 30 hari):

   ```bash
   bunx prisma db seed
   ```

7. Jalankan dev server:

   ```bash
   bun dev
   ```

8. Buka <http://localhost:3000>.

## Asumsi

- SOC bernilai 0–100 dan konsisten dengan state (mis. FULL = 100%).
- Transaksi swap hanya terjadi pada cabinet ONLINE; `swap_type` bernilai `IN`/`OUT`.
- `last_heartbeat` adalah indikator terakhir cabinet hidup; OFFLINE diasumsikan
  hilang heartbeat berhari-hari.
- Pencarian bersifat substring case-insensitive pada kode dan cabang.
- Waktu ditampilkan sesuai timezone browser klien.

## Trade-off

| Keputusan | Alternatif yang ditinggalkan | Alasan |
| --- | --- | --- |
| Offset pagination | Cursor-based | Total count dibutuhkan UI; dataset kecil; data tidak sering berubah. |
| Raw SQL untuk list cabinet (`ORDER BY` + `LIMIT/OFFSET` di database) | Sort + paginate di memori setelah `findMany` | Prisma tidak mendukung orderBy based on filtered relation sehingga menggunaka raw SQL lebih baik untuk performance dan scaling jika nanti data yang ada jumlahnya sudah banyak. |
| Client components untuk kedua halaman | Server components + form actions | Debounce search, toggle filter, dan pagination lebih cocok sebagai state klien; state juga menjadi shareable karena tertera di dalam URL |

## Keputusan Desain

### Pagination: offset (bukan cursor)

Alasan memilih **offset pagination**:

**Dataset kecil dan relatif statis** — ±50 cabinet; risiko item bergeser di
antara halaman (duplikat/terlewat saat data berubah) dapat diabaikan, sedangkan
cursor justru menambah kompleksitas (perlu kursor stabil berdasarkan kombinasi
kolom sort).

## Apa yang Belum Selesai

- [ ] **Indeks komposit** `(cabinet_id, created_at)` pada `swap_transaction` untuk
      mempercepat query 24 jam dan agregasi hourly.
- [ ] **Real-time update** — status cabinet dan transaksi baru tidak live;
      butuh polling berkala atau WebSocket/SSE.
- [ ] **Responsive mobile** — layout dioptimalkan untuk desktop; tabel perlu
      pola card/list di layar kecil.
- [ ] **Test otomatis** — belum ada unit/integration test.
- [ ] **Enum di database** — `status`/`state`/`swap_type` masih string bebas. Validasi hanya di boundary API.

## AI Tool yang Dipakai

- **OpenCode** — documentation, planning (analisis requirement & penyusunan rencana), scaffolding
  code boilerplate, dan code review.
