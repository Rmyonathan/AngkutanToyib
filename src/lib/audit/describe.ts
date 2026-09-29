import { APP_TIMEZONE } from "@/lib/dates";
import { PERMISSION_CATALOG } from "@/lib/auth/rbac";
import { formatNumber, formatRupiah } from "@/lib/utils";

/** id → human label (unit number, driver name, invoice number, …) resolved on the server */
export type RefMap = Record<string, string>;

type Json = Record<string, unknown>;

export const TABLE_LABEL: Record<string, string> = {
  DeliveryOrder: "DO",
  CustomerTrip: "Trip Customer",
  OperationalCost: "Biaya Operasional",
  FieldSubmission: "Upload Dokumen Supir",
  MasterUnit: "Master Unit",
  MasterDriver: "Master Supir",
  MasterCustomer: "Master Customer",
  MasterCostConfig: "HPP Settings",
  HppJournalEntry: "Jurnal Kas / HPP",
  Invoice: "Invoice",
  InvoicePayment: "Pembayaran Invoice",
  BreakdownHistory: "Breakdown",
  users: "User",
  role_permissions: "Hak Akses Role",
};

export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
};

const ACTION_VERB: Record<string, string> = {
  CREATE: "menambahkan",
  UPDATE: "mengubah",
  DELETE: "menghapus",
};

export const tableLabel = (t: string) => TABLE_LABEL[t] ?? t;

const FIELD_LABEL: Record<string, string> = {
  internalTripId: "No. Trip",
  date: "Tanggal",
  unitId: "Unit",
  driverId: "Supir",
  customerId: "Customer",
  customerTripId: "Trip",
  uangJalan: "Uang jalan",
  ratePerTon: "Tarif / ton",
  ticketNumber: "No. tiket timbangan",
  netto: "Tonase",
  kmHauling: "KM hauling",
  suratJalanPhoto: "Foto surat jalan",
  solarPhoto: "Foto nota solar",
  otherPhoto: "Foto nota biaya lain",
  rejectReason: "Alasan ditolak",
  invoiceId: "Invoice",
  status: "Status",
  notes: "Catatan",
  costType: "Jenis biaya",
  deliveryOrderId: "DO",
  amount: "Nominal",
  volume: "Volume solar",
  pricePerLiter: "Harga / liter",
  distanceKm: "Jarak",
  description: "Keterangan",
  fieldSubmissionId: "Upload supir",
  unitNumber: "No. unit",
  brandType: "Merek / tipe",
  year: "Tahun",
  licensePlate: "Plat nomor",
  capacity: "Kapasitas",
  defaultDriverId: "Supir unit",
  currentKm: "KM saat ini",
  operationStartDate: "Mulai operasi",
  purchasePrice: "Harga beli",
  estimatedSalvageValue: "Nilai residu",
  economicLifespanDays: "Umur ekonomis",
  estimatedOpsDaysPerMonth: "Hari operasi / bulan",
  monthlyCicilan: "Cicilan / bulan",
  monthlyMaintenanceBudget: "Budget maintenance / bulan",
  monthlyMovingCost: "Moving cost / bulan",
  allocatedTonasePerPeriod: "Tonase alokasi moving",
  name: "Nama",
  salarySystem: "Sistem gaji",
  driverRatePerTon: "Gaji / ton",
  monthlySalary: "Gaji bulanan",
  dailySalary: "Gaji harian",
  attendanceStatus: "Status kehadiran",
  customerName: "Nama customer",
  loadingLocation: "Lokasi muat",
  dumpingLocation: "Lokasi bongkar",
  oneWayDistance: "Jarak sekali jalan",
  targetTonase: "Target tonase",
  paymentTermDays: "Tempo pembayaran",
  isActive: "Aktif",
  globalSolarPrice: "Harga solar",
  globalTirePrice: "Harga ban (set)",
  tireLifespanDays: "Umur ban",
  defaultMaintenanceBudget: "Budget maintenance / bulan",
  defaultCicilan: "Cicilan default / bulan",
  defaultDepreciation: "Depresiasi / hari",
  defaultMovingCost: "Moving cost / bulan",
  entryType: "Jenis",
  category: "Kategori",
  kasOnly: "Hanya kas (tidak masuk HPP)",
  invoiceNumber: "No. invoice",
  invoiceDate: "Tanggal invoice",
  dueDate: "Jatuh tempo",
  periodStart: "Periode dari",
  periodEnd: "Periode sampai",
  totalTonase: "Total tonase",
  totalAmount: "Total tagihan",
  paidAmount: "Sudah dibayar",
  withholdingAmount: "PPh 23 dipotong",
  method: "Metode bayar",
  reference: "Referensi",
  issueDescription: "Kerusakan",
  startTime: "Mulai",
  endTime: "Selesai",
  downtimeHours: "Downtime",
  maintenanceCost: "Biaya perbaikan",
  email: "Email / username",
  role: "Role",
  permissions: "Hak akses",
  userId: "Akun login",
  createdById: "Dibuat oleh",
  doIds: "DO",
  doCount: "Jumlah DO",
  termDays: "Tempo",
  invoiceStatus: "Status invoice jadi",
  reason: "Alasan",
  passwordReset: "Password direset",
  reset: "Dikembalikan ke default",
};

const TABLE_FIELD_LABEL: Record<string, Record<string, string>> = {
  DeliveryOrder: { date: "Tanggal DO", notes: "Catatan DO" },
  CustomerTrip: { name: "Nama trip", ratePerTon: "Tarif / ton (trip)" },
  Invoice: { status: "Status invoice", ratePerTon: "Tarif rata-rata / ton" },
  InvoicePayment: { amount: "Diterima (kas masuk)", date: "Tanggal bayar" },
  MasterUnit: { status: "Status unit" },
  HppJournalEntry: { amount: "Nominal" },
};

/** Technical fields that mean nothing to a person reading the log */
const HIDDEN = new Set(["id", "createdAt", "updatedAt", "passwordHash", "createdById"]);

const MONEY = new Set([
  "uangJalan", "ratePerTon", "amount", "withholdingAmount", "totalAmount", "paidAmount",
  "purchasePrice", "estimatedSalvageValue", "monthlyCicilan", "monthlyMaintenanceBudget",
  "monthlyMovingCost", "driverRatePerTon", "monthlySalary", "dailySalary", "globalSolarPrice",
  "globalTirePrice", "defaultMaintenanceBudget", "defaultCicilan", "defaultDepreciation",
  "defaultMovingCost", "maintenanceCost", "pricePerLiter",
]);
const TON = new Set(["netto", "totalTonase", "capacity", "targetTonase", "allocatedTonasePerPeriod"]);
const KM = new Set(["kmHauling", "currentKm", "oneWayDistance", "distanceKm"]);
const DAYS = new Set(["termDays", "paymentTermDays", "economicLifespanDays", "tireLifespanDays", "estimatedOpsDaysPerMonth"]);
const DATE_ONLY = new Set(["date", "invoiceDate", "dueDate", "periodStart", "periodEnd", "operationStartDate"]);
const DATE_TIME = new Set(["startTime", "endTime", "timestamp"]);
const PHOTO = new Set(["suratJalanPhoto", "solarPhoto", "otherPhoto"]);
const REF = new Set([
  "unitId", "driverId", "customerId", "customerTripId", "invoiceId", "deliveryOrderId",
  "defaultDriverId", "createdById", "userId", "fieldSubmissionId",
]);

const ENUM_LABEL: Record<string, Record<string, string>> = {
  DeliveryOrder_status: {
    VERIFIED: "Terverifikasi",
    INVOICED: "Sudah ditagih",
    COMPLETED: "Lunas",
  },
  Invoice_status: {
    DRAFT: "Draft",
    ISSUED: "Belum dibayar",
    PARTIAL: "Dibayar sebagian",
    PAID: "Lunas",
    CANCELLED: "Dibatalkan",
  },
  MasterUnit_status: {
    RUNNING: "🟢 Running",
    STANDBY: "🟡 Standby",
    BREAKDOWN: "🔴 Breakdown",
    MAINTENANCE: "🔵 Maintenance",
  },
  invoiceStatus: {
    DRAFT: "Draft",
    ISSUED: "Belum dibayar",
    PARTIAL: "Dibayar sebagian",
    PAID: "Lunas",
    CANCELLED: "Dibatalkan",
  },
  FieldSubmission_status: { PENDING: "Menunggu verifikasi", PROCESSED: "Sudah jadi DO", REJECTED: "Ditolak" },
  costType: { SOLAR: "Solar", MAINTENANCE: "Maintenance", LAINNYA: "Biaya lain" },
  role: { OWNER: "Owner", MANAGER: "Manager", ADMIN: "Admin", OPERATOR: "Supir / Operator", FINANCE: "Finance" },
  salarySystem: { PER_TON: "Per ton", MONTHLY: "Bulanan", DAILY: "Harian" },
  attendanceStatus: { ACTIVE: "Aktif", LEAVE: "Cuti", INACTIVE: "Tidak aktif" },
  method: { TRANSFER: "Transfer", CASH: "Tunai", GIRO: "Giro", OTHER: "Lainnya" },
  entryType: { CASH_OUT: "Kas keluar", CASH_IN: "Kas masuk" },
  category: {
    SOLAR: "Solar", DRIVER: "Gaji supir", TIRE: "Ban", MAINTENANCE: "Maintenance",
    CICILAN: "Cicilan", DEPRECIATION: "Depresiasi", MOVING: "Moving", BIAYA_LAIN: "Biaya lain",
    UANG_JALAN: "Uang jalan", REVENUE: "Pendapatan", OTHER: "Lainnya",
  },
};

const PERMISSION_LABEL = new Map<string, string>(PERMISSION_CATALOG.map((p) => [p.key, p.label]));

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function fieldLabel(table: string, key: string): string {
  return TABLE_FIELD_LABEL[table]?.[key] ?? FIELD_LABEL[key] ?? key;
}

export function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

export type FormattedValue = { text: string; href?: string };

export function formatValue(table: string, key: string, v: unknown, refs: RefMap): FormattedValue {
  if (isEmpty(v)) return { text: "—" };
  if (typeof v === "boolean") return { text: v ? "Ya" : "Tidak" };

  if (REF.has(key) && typeof v === "string") {
    return { text: refs[v] ?? "(data sudah dihapus)" };
  }
  if (key === "doIds" && Array.isArray(v)) {
    return { text: v.map((id) => refs[String(id)] ?? "?").join(", ") };
  }
  if (PHOTO.has(key) && typeof v === "string") return { text: "Lihat foto", href: v };
  if (key === "permissions" && Array.isArray(v)) {
    return { text: v.map((p) => PERMISSION_LABEL.get(String(p)) ?? String(p)).join(", ") };
  }

  if (typeof v === "number") {
    if (MONEY.has(key)) return { text: formatRupiah(v) };
    if (TON.has(key)) return { text: `${formatNumber(v, 2)} ton` };
    if (KM.has(key)) return { text: `${formatNumber(v, 0)} km` };
    if (DAYS.has(key)) return { text: `${formatNumber(v, 0)} hari` };
    if (key === "volume") return { text: `${formatNumber(v, 1)} liter` };
    if (key === "downtimeHours") return { text: `${formatNumber(v, 1)} jam` };
    if (key === "year") return { text: String(v) };
    return { text: formatNumber(v, Number.isInteger(v) ? 0 : 2) };
  }

  if (typeof v === "string") {
    if (DATE_ONLY.has(key) || DATE_TIME.has(key)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return { text: DATE_ONLY.has(key) ? dateFmt.format(d) : `${dateTimeFmt.format(d)} WIB` };
      }
    }
    const enumMap = ENUM_LABEL[`${table}_${key}`] ?? ENUM_LABEL[key];
    if (enumMap?.[v]) return { text: enumMap[v] };
    return { text: v };
  }

  if (Array.isArray(v)) return { text: v.map(String).join(", ") };
  return { text: JSON.stringify(v) };
}

function asObject(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}

export type FieldDiff = {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  changed: boolean;
  hidden: boolean;
};

export function diffFields(table: string, oldData: unknown, newData: unknown): FieldDiff[] {
  const o = asObject(oldData) ?? {};
  const n = asObject(newData) ?? {};
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
  return keys.map((key) => ({
    key,
    label: fieldLabel(table, key),
    before: o[key],
    after: n[key],
    changed: JSON.stringify(o[key] ?? null) !== JSON.stringify(n[key] ?? null),
    hidden: HIDDEN.has(key),
  }));
}

/** Short name of the record: "TRIP-20260928-0003 · DT-01", "INV-2026-09-001", "Budi", … */
export function recordLabel(table: string, oldData: unknown, newData: unknown, recordId: string, refs: RefMap): string {
  const d = { ...(asObject(oldData) ?? {}), ...(asObject(newData) ?? {}) };
  const ref = (k: string) => (typeof d[k] === "string" ? refs[d[k] as string] : undefined);
  const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(" · ");
  const fv = (k: string) => formatValue(table, k, d[k], refs).text;

  switch (table) {
    case "DeliveryOrder":
      return join((d.internalTripId as string) ?? refs[recordId], ref("unitId"));
    case "Invoice":
      return (d.invoiceNumber as string) ?? refs[recordId] ?? "Invoice";
    case "InvoicePayment":
      return join(ref("invoiceId"), !isEmpty(d.amount) && fv("amount"));
    case "OperationalCost":
      return join(!isEmpty(d.costType) && fv("costType"), ref("unitId"), !isEmpty(d.amount) && fv("amount"));
    case "FieldSubmission":
      return join(ref("customerTripId"), ref("unitId"), ref("driverId"));
    case "BreakdownHistory":
      return join(ref("unitId"), d.issueDescription as string);
    case "HppJournalEntry":
      return join(d.description as string, !isEmpty(d.amount) && fv("amount"));
    case "MasterUnit":
      return join(d.unitNumber as string, d.licensePlate as string) || (refs[recordId] ?? "Unit");
    case "MasterDriver":
      return (d.name as string) ?? refs[recordId] ?? "Supir";
    case "MasterCustomer":
      return (d.customerName as string) ?? refs[recordId] ?? "Customer";
    case "CustomerTrip":
      return join(d.name as string, ref("customerId")) || (refs[recordId] ?? "Trip");
    case "MasterCostConfig":
      return (d.name as string) ?? "HPP Settings";
    case "users":
      return join(d.name as string, d.email as string) || (refs[recordId] ?? "User");
    case "role_permissions":
      return ENUM_LABEL.role[recordId] ?? ENUM_LABEL.role[d.role as string] ?? recordId;
    default:
      return refs[recordId] ?? recordId;
  }
}

/** Fields worth mentioning in the one-line summary of a CREATE / DELETE */
const HIGHLIGHT: Record<string, string[]> = {
  DeliveryOrder: ["date", "driverId", "customerTripId", "netto", "ticketNumber"],
  OperationalCost: ["date", "volume", "pricePerLiter", "description"],
  CustomerTrip: ["ratePerTon", "uangJalan"],
  FieldSubmission: ["date", "driverId"],
  Invoice: ["customerId", "totalTonase", "totalAmount", "dueDate"],
  InvoicePayment: ["date", "method", "withholdingAmount"],
  BreakdownHistory: ["date", "maintenanceCost"],
  HppJournalEntry: ["date", "entryType", "category"],
  MasterDriver: ["salarySystem", "driverRatePerTon", "userId"],
  MasterCustomer: ["ratePerTon", "paymentTermDays"],
  MasterUnit: ["brandType", "status"],
  users: ["role"],
};

/** One human sentence for the table row */
export function summarize(
  table: string,
  action: string,
  oldData: unknown,
  newData: unknown,
  refs: RefMap
): string {
  const diffs = diffFields(table, oldData, newData).filter((d) => !d.hidden);
  if (action === "UPDATE") {
    const changed = diffs.filter((d) => d.changed);
    if (changed.length === 0) return "Tidak ada perubahan nilai";
    const parts = changed.slice(0, 3).map(
      (d) =>
        `${d.label}: ${formatValue(table, d.key, d.before, refs).text} → ${formatValue(table, d.key, d.after, refs).text}`
    );
    return changed.length > 3 ? `${parts.join("; ")}; +${changed.length - 3} lainnya` : parts.join("; ");
  }
  const src = asObject(action === "DELETE" ? oldData : newData) ?? {};
  const keys = HIGHLIGHT[table] ?? [];
  const parts = keys
    .filter((k) => !isEmpty(src[k]) && src[k] !== 0)
    .map((k) => `${fieldLabel(table, k)} ${formatValue(table, k, src[k], refs).text}`);
  return parts.join(" · ") || (action === "DELETE" ? "Data dihapus" : "Data baru");
}

/** "Owner Toyib menambahkan Trip / DO TRIP-… pada 28 Sep 2026 15.14 WIB" */
export function sentence(
  userName: string,
  action: string,
  table: string,
  label: string,
  timestamp: string
): string {
  return `${userName} ${ACTION_VERB[action] ?? action} ${tableLabel(table)} ${label} pada ${dateTimeFmt.format(new Date(timestamp))} WIB`;
}

/** All ids referenced by audit payloads, so the server can resolve them to names */
export function collectRefIds(values: unknown[]): string[] {
  const ids = new Set<string>();
  for (const v of values) {
    const o = asObject(v);
    if (!o) continue;
    for (const [k, val] of Object.entries(o)) {
      if (REF.has(k) && typeof val === "string") ids.add(val);
      if (k === "doIds" && Array.isArray(val)) val.forEach((x) => typeof x === "string" && ids.add(x));
    }
  }
  return Array.from(ids);
}
