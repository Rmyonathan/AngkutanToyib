# Roadmap — Sistem Manajemen Hauling Batubara

Based on `guide.docx` + **Phase 3 photo-first pivot** (Supir uploads photos → Admin verifies).

Theme: **black & white** (unit status dots keep 🟢🟡🔴🔵).

**Last updated:** 30 Sep 2026 — HPP Settings diputus dari keuangan (biaya = aktual DO saja), unit form disederhanakan, DO bisa diedit di semua status (invoice dihitung ulang), edit jatuh tempo & periode invoice, jurnal kas via popup, akun supir hanya dari Master Driver, nama perusahaan **Tambang Transport Abadi** (`src/lib/company.ts`).

**29 Sep 2026** — Alur baru: supir upload dulu (pilih trip) → admin verifikasi → DO dibuat. Netto langsung (tanpa bruto/tara), solar per liter × harga/liter, trip per customer, akun login per driver, assign driver di unit.

**Migrate (fresh env):** `npx prisma migrate deploy` (semua SQL sudah ada di `prisma/migrations/`)
*(Riwayat migration digabung jadi satu baseline `prisma/migrations/20260929000000_init/` pada 29 Sep 2026, lalu `20260929120000_driver_upload_flow` untuk alur upload baru. Reset total + seed, setara Laravel `migrate:fresh --seed`: `npx prisma migrate reset --force`. Perubahan schema berikutnya: `npx prisma migrate dev --name nama_perubahan`.)*

📘 **Penjelasan HPP Settings, Kas & Piutang:** [`docs/HPP-SETTINGS.md`](docs/HPP-SETTINGS.md)  
🧪 **Panduan tes semua fitur:** [`docs/TESTING.md`](docs/TESTING.md)

### Alur DO (sejak 29 Sep 2026)
1. **Admin (master)** — Customer + **daftar trip/rute** (`customer_trips`: nama, jarak, tarif opsional, uang jalan). Driver + **akun login** (username, role OPERATOR) dibuat sekaligus. Unit → tombol **Assign / Ganti driver** (1 driver = 1 unit).
2. **Supir** → `/upload` — login → pilih **trip** → foto **Surat Jalan** (wajib) + **Nota Solar** (opsional) + nota biaya lain (opsional) dalam satu `FieldSubmission`. Driver & unit otomatis dari akun (`MasterDriver.userId` → `MasterUnit.defaultDriverId`).
3. **Admin** → `/operations/verify` — lihat foto → isi tiket, **netto**, KM, tarif, uang jalan, **solar liter × harga/liter**, biaya lain → **DO dibuat** (`VERIFIED`) + `OperationalCost`. Atau **Reject** dengan alasan (terlihat di HP supir).
4. **Data DO** → `/operations/trips` — daftar & detail DO; **Edit DO** di semua status (termasuk solar & biaya lain). DO yang sudah di-invoice: total invoice dihitung ulang (`src/lib/finance/invoice-recalc.ts`), customer terkunci, ditolak jika total < yang sudah dibayar.

### DO status lifecycle
```
VERIFIED (dibuat saat verifikasi) → INVOICED (Sudah Ditagih) → COMPLETED (Lunas)
```
- `VERIFIED` = DO lahir dari upload supir yang sudah dicek admin. Pendapatan diakui (laba-rugi), masuk Piutang "belum ditagih".
- `INVOICED` = sudah masuk invoice (belum / sebagian dibayar).
- `COMPLETED` = invoice **lunas** (otomatis saat pembayaran menutup sisa tagihan).
- Status upload supir (`FieldSubmission`): PENDING → PROCESSED (jadi DO) / REJECTED (+ alasan).
- Helper terpusat: `src/lib/operations/do-status.ts` (`DO_REVENUE_STATUSES`, `DO_INVOICEABLE_STATUSES`, `isDoEditable`, …).
- Edit DO (unit, driver, trip, tonase, tiket, KM, tarif, uang jalan, solar, biaya lain) bisa di semua status. Semua edit tercatat di AuditLog.
- Status unit BREAKDOWN otomatis: aktif selama `start ≤ sekarang < end` (atau end kosong), kembali RUNNING setelah jam selesai lewat.

---

## Progress overview

| Phase | Feature | Status | Can use now? |
|------:|---------|--------|--------------|
| 0 | App shell (navbar, layout, routes) | ✅ Done | Yes |
| 1 | Auth (login, logout, roles, seed) | ✅ Done | Yes |
| 2 | Master Data CRUD | ✅ Done | `/masters/*` |
| 3 | Daily Ops — **Photo-first → DO** | ✅ Done | Verify → DO `VERIFIED`; edit trip |
| 4 | Breakdown history | ✅ Done | `/breakdown` |
| 5 | HPP Settings UI | ⏸ Tidak terhubung | `/settings/hpp` — disimpan untuk HPP real nanti; tidak dipakai keuangan |
| 6 | Owner Dashboard | ✅ Done | `/dashboard?date=` — armada, produksi (rit/ton/KM/ton-km/rit-unit), finansial (profit/ton, profit/unit, HPP/ton, cash out) |
| 6b | Konsumsi Solar per unit | ✅ Done | `/operations/solar` |
| 7 | Reports + Excel/PDF | ✅ Done | `/reports` — CSV export + cetak/PDF |
| 7b | Penagihan, Piutang & Pembayaran (tempo) | ✅ Done | `/finance/piutang` |
| 7c | Kas basis tunai | ✅ Done | `/finance/kas` |
| 8 | Audit trail viewer | ✅ Done | `/audit` |
| 9 | User management + editor role | ✅ Done | `/users` (OWNER) |
| 10 | QA + Deploy | 🟨 QA | Checklist tes: [`docs/TESTING.md`](docs/TESTING.md) |

**Billing model:** one trip = one `DeliveryOrder` (Surat Jalan Timbangan). Revenue = `netto × ratePerTon`. Invoice pulls unbilled VERIFIED DOs.


---

## Phase 7b — Penagihan & Piutang (tempo)

| Route | Role | Purpose |
|-------|------|---------|
| `/finance/piutang` | Lihat: finance area · Tulis: OWNER, FINANCE, ADMIN | DO belum ditagih per customer → buat invoice; daftar invoice + aging |
| `/finance/piutang/[id]` | sama | Detail/cetak invoice, catat pembayaran (+PPh 23), **Edit Invoice** (jatuh tempo & periode), batalkan |

- `MasterCustomer.paymentTermDays` (default 30; 0 = tunai) → `Invoice.dueDate = invoiceDate + tempo`
- `InvoicePayment` (tanggal, nominal diterima, PPh 23 dipotong, metode, referensi). Status invoice: ISSUED → PARTIAL → PAID
- Invoice hanya 1 customer; DO harus VERIFIED & punya netto. Batal invoice hanya jika belum ada pembayaran (DO kembali VERIFIED)
- Aging: belum jatuh tempo, 1–30, 31–60, 61–90, >90 hari
- Actions: `src/actions/finance.ts` · Loader: `src/lib/finance/receivables.ts`

## Phase 7c — Kas basis tunai

- **Kas masuk** = pembayaran invoice (tgl bayar) + jurnal kas masuk
- **Kas keluar** = uang jalan DO + solar/biaya lain terverifikasi + biaya breakdown + jurnal kas keluar
- Jurnal diinput lewat popup **Input Jurnal**. Kas keluar kategori **Driver** (bayar gaji) hanya mengurangi kas, tidak masuk HPP (gaji sudah dihitung per DO). `HppJournalEntry.kasOnly` tidak dipakai lagi.
- HPP per DO (`src/lib/finance/do-hpp.ts`) = uang jalan + solar + biaya lain aktual + gaji supir (Master Driver; harian/bulanan dibagi per rit per supir per hari). **Tanpa** ban/maintenance/cicilan/depresiasi/moving dari HPP Settings. Dipakai Buku Harian, Profitabilitas, Dashboard.

## Phase 8 — Audit Trail (`/audit`, OWNER/MANAGER/ADMIN)
- Filter tabel, aksi, user, tanggal (WIB), record ID; 50/halaman; klik baris → diff field sebelum → sesudah

## Phase 9 — User Management (`/users`, OWNER)
- Tambah user, ubah nama/email/role, reset password, aktif/nonaktif (user tidak dihapus karena terikat audit log)
- User nonaktif ditolak saat login dan sesi aktifnya langsung berakhir; tidak bisa menonaktifkan diri sendiri / OWNER aktif terakhir

## Phase 9b — Role & hak akses yang bisa diubah
- Tabel `role_permissions` (1 baris per role yang diubah; kosong = pakai default di `src/lib/auth/rbac.ts` `DEFAULT_ROLE_PERMISSIONS`)
- `/users` → matriks fitur × role (Manager, Admin, Finance, Operator). OWNER selalu akses penuh. Tombol "Default" untuk kembali ke bawaan
- Server membaca izin langsung dari DB (cache 10 dtk); menu/middleware ikut dari JWT (diperbarui ± 60 dtk)
- Default: **Admin tidak lagi punya akses Keuangan** (Kas/Piutang/Jurnal) — pisah tugas lapangan vs finansial; Owner bisa aktifkan lagi via editor
- Izin baru: `billing:write` (buat invoice & catat pembayaran), `fuel:read` (halaman konsumsi solar)

## Phase 6b — Konsumsi Solar (`/operations/solar`)
- Liter & Rp dari nota solar terverifikasi (`OperationalCost` SOLAR: `volume`, `amount`); KM/rit/ton dari DO terverifikasi (`kmHauling`, `netto`)
- Per unit: liter, Rp/L, L/km, km/L, L/rit, L/ton, solar/ton, solar/km; status BOROS/NORMAL/HEMAT vs rata-rata armada (ambang % bisa diatur)
- Rincian harian per unit, ekspor CSV. Wajib isi **liter** saat verifikasi nota solar & **KM hauling** saat verifikasi timbangan

## Phase 10 — Sisa pekerjaan (menuju produksi)
- QA menyeluruh dengan data nyata 1 bulan (bandingkan Kas vs rekening koran)
- Deploy: Postgres terkelola, penyimpanan foto (S3/R2) menggantikan `public/uploads`, backup harian, HTTPS, `NEXTAUTH_SECRET` produksi
- Opsional: PPN 11% + nomor faktur, hutang gaji supir (settlement), snapshot HPP per bulan, `.xlsx` multi-sheet, dashboard piutang/kas

---

## Phase 7 — Laporan

| Route | Role | Purpose |
|-------|------|---------|
| `/reports` | OWNER, MANAGER, ADMIN, FINANCE (`reports`) | Rekap operasional & finansial dari DO VERIFIED |

### Features
- Filter periode (dari/sampai, preset bulan ini / bulan lalu), unit, customer — via query string (shareable URL)
- KPI: ritase, tonase, revenue, untung, margin; breakdown uang jalan / solar / biaya lain / biaya tanpa trip
- Tab: **Per DO/Trip**, **Rekap per Unit**, **Rekap per Customer**, **Rekap Harian**
- **Export Excel (CSV)** per tab — UTF-8 BOM + `;` separator, langsung terbuka rapi di Excel lokal ID
- **Cetak / PDF** — `window.print()`; navbar & filter disembunyikan, semua tab ikut tercetak
- Loader: `src/lib/reports/get-operations-report.ts`; CSV util: `src/lib/reports/csv.ts`

### Next (Phase 7.x)
- `.xlsx` asli (multi-sheet) & PDF server-side jika diperlukan accounting
- Rekap mingguan + perbandingan periode

---

## Phase 4 — Breakdown history

| Route | Role | Purpose |
|-------|------|---------|
| `/breakdown` | ADMIN write; OWNER full; MANAGER read | CRUD histori downtime + biaya |

### Features
- Catat masalah, mulai/selesai, downtime (auto), biaya maintenance
- Open breakdown → unit status 🔴 BREAKDOWN; close → RUNNING
- Ringkasan bulan: total downtime, biaya, availability %
- Filter per unit & bulan
- AuditLog on create/update/delete

---

## Phase 3 — Photo-first workflow

```
SUPIR (login sendiri)                ADMIN / OWNER
─────────────────────                ─────────────
Upload Dokumen                       Verifikasi Dokumen
  · Pilih trip (rute customer)         · Lihat foto (tab SJ / Solar / Biaya)
  · Foto Surat Jalan (wajib)           · Isi tiket, netto, KM, tarif, uang jalan
  · Foto Nota Solar (opsional)         · Solar: liter × harga/liter
  · Foto Biaya Lain (opsional)         · Simpan → DeliveryOrder VERIFIED
  · Unit & nama dari akun                + OperationalCost + AuditLog
       │                                      │
       └──── FieldSubmission PENDING ─────────┘ → PROCESSED / REJECTED
```

| Route | Role | Purpose |
|-------|------|---------|
| `/upload` | field:submit (Supir; Admin bisa upload atas nama supir) | Pilih trip + foto |
| `/operations/verify` | ops:verify | Foto → DO |
| `/operations/trips` | operations:read / write | Data DO + edit |
| `/operations/submit/*`, `/operations/manual` | — | Alamat lama, dialihkan |

### Schema
- `CustomerTrip` (customerId, name, distanceKm?, ratePerTon?, uangJalan?, isActive)
- `FieldSubmission` (customerTripId, suratJalanPhoto, solarPhoto?, otherPhoto?, status, rejectReason?, deliveryOrderId @unique)
- `DeliveryOrder` (customerTripId, netto — tanpa bruto/tara)
- `OperationalCost.pricePerLiter` (solar: amount = volume × pricePerLiter)
- `MasterDriver.userId` @unique → akun login; `MasterUnit.defaultDriverId` @unique (1 driver = 1 unit)

### Uploads
- **UploadThing** when `UPLOADTHING_TOKEN` + `NEXT_PUBLIC_UPLOADTHING=true`
- **Local fallback** `/api/upload/local` → `public/uploads/field` (default for MVP)


---

## Guide.docx coverage

| Guide item | Status |
|------------|--------|
| Master Data | ✅ Phase 2 |
| Ritase / tonase / solar / KM | ✅ Admin fills after photos (Phase 3) |
| Flexible HPP | ✅ Master Biaya |
| Owner dashboard | ✅ Phase 6 (KPI lengkap + filter tanggal/bulan) |
| Breakdown history | ✅ Phase 4 |
| Reports export | ✅ Phase 7 (CSV + cetak/PDF) |
| RBAC (Owner/Manager/Admin/Operator/Finance) | ✅ Editor role di `/users` |
| Audit trail | ✅ Phase 8 (tampilan bahasa manusia) |

---

## Data flow

```
SUPIR LOGIN (driver + unit) → PILIH TRIP → FOTO (Surat Jalan / Solar) → ADMIN VERIFY
        → DeliveryOrder VERIFIED → REVENUE → HPP → PROFIT → Dashboard / Laporan
```
