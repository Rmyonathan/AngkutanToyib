"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import {
  AttendanceStatus,
  AuditAction,
  Prisma,
  Role,
  SalarySystem,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { setDriverUnit } from "@/lib/masters/assign-unit";
import { LOGIN_ID_REGEX } from "@/lib/auth/login-id";
import {
  emptyToNull,
  optionalNumber,
  type ActionResult,
} from "@/lib/actions/types";

const driverSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib"),
  driverId: z.string().trim().min(1, "ID driver wajib"),
  unitId: z.string().optional().nullable(),
  salarySystem: z.nativeEnum(SalarySystem),
  driverRatePerTon: z.coerce.number().min(0).default(0),
  monthlySalary: z.union([z.coerce.number(), z.literal("")]).optional().nullable(),
  dailySalary: z.union([z.coerce.number(), z.literal("")]).optional().nullable(),
  attendanceStatus: z.nativeEnum(AttendanceStatus),
  /** Akun login supir — disimpan di users.email */
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(LOGIN_ID_REGEX, "Username 3–50 karakter: huruf kecil, angka, titik, - atau _"),
  /** Wajib saat akun baru dibuat; kosong saat edit = password tidak diubah */
  password: z.string().optional().nullable(),
});

export type DriverInput = z.input<typeof driverSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertMasterWrite() {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "masters:write") &&
    !hasPermission(session.user.role, "*")
  ) {
    throw new Error("Forbidden: ADMIN/OWNER only");
  }
  return session;
}

function mapDriver(data: z.infer<typeof driverSchema>) {
  return {
    name: data.name,
    driverId: data.driverId,
    salarySystem: data.salarySystem,
    driverRatePerTon: data.driverRatePerTon,
    monthlySalary: optionalNumber(data.monthlySalary),
    dailySalary: optionalNumber(data.dailySalary),
    attendanceStatus: data.attendanceStatus,
  };
}

function checkPassword(password: string | null | undefined, required: boolean) {
  const pw = password ?? "";
  if (!pw && required) return "Password akun supir wajib diisi";
  if (pw && pw.length < 8) return "Password minimal 8 karakter";
  return null;
}

function fail(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String(err.meta?.target ?? "");
    if (target.includes("email")) {
      return { success: false, error: "Username sudah dipakai akun lain" };
    }
    if (target.includes("driverId")) {
      return { success: false, error: "ID driver sudah dipakai" };
    }
  }
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

function revalidateDriverPaths() {
  revalidatePath("/masters/drivers");
  revalidatePath("/masters/units");
  revalidatePath("/users");
  revalidatePath("/upload");
}

/** Buat driver + akun login (role OPERATOR) sekaligus. */
export async function createDriver(
  raw: DriverInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = driverSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const data = parsed.data;
    const pwError = checkPassword(data.password, true);
    if (pwError) return { success: false, error: pwError };
    const passwordHash = await hash(data.password!, 10);

    const row = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.username,
          passwordHash,
          role: Role.OPERATOR,
          isActive: data.attendanceStatus !== AttendanceStatus.INACTIVE,
        },
      });
      const created = await tx.masterDriver.create({
        data: { ...mapDriver(data), userId: user.id },
      });
      await setDriverUnit(tx, created.id, emptyToNull(data.unitId ?? null));
      await tx.auditLog.createMany({
        data: [
          {
            userId: session.user.id,
            action: AuditAction.CREATE,
            tableName: "users",
            recordId: user.id,
            newData: toJson({ name: user.name, email: user.email, role: user.role }),
          },
          {
            userId: session.user.id,
            action: AuditAction.CREATE,
            tableName: "MasterDriver",
            recordId: created.id,
            newData: toJson({ ...created, unitId: data.unitId || null }),
          },
        ],
      });
      return created;
    });

    revalidateDriverPaths();
    return { success: true, data: { id: row.id } };
  } catch (err) {
    return fail(err, "Gagal menyimpan driver");
  }
}

export async function updateDriver(
  id: string,
  raw: DriverInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = driverSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const data = parsed.data;

    const existing = await prisma.masterDriver.findUnique({
      where: { id },
      include: { user: true, assignedUnit: { select: { id: true } } },
    });
    if (!existing) return { success: false, error: "Driver tidak ditemukan" };

    const pwError = checkPassword(data.password, !existing.user);
    if (pwError) return { success: false, error: pwError };
    const passwordHash = data.password ? await hash(data.password, 10) : null;
    const isActive = data.attendanceStatus !== AttendanceStatus.INACTIVE;

    await prisma.$transaction(async (tx) => {
      let userId = existing.userId;
      if (existing.user) {
        const u = existing.user;
        const changed =
          u.email !== data.username ||
          u.name !== data.name ||
          u.isActive !== isActive ||
          !!passwordHash;
        if (changed) {
          await tx.user.update({
            where: { id: u.id },
            data: {
              email: data.username,
              name: data.name,
              isActive,
              ...(passwordHash ? { passwordHash } : {}),
            },
          });
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: AuditAction.UPDATE,
              tableName: "users",
              recordId: u.id,
              oldData: toJson({ name: u.name, email: u.email, isActive: u.isActive }),
              newData: toJson({
                name: data.name,
                email: data.username,
                isActive,
                ...(passwordHash ? { passwordReset: true } : {}),
              }),
            },
          });
        }
      } else {
        const user = await tx.user.create({
          data: {
            name: data.name,
            email: data.username,
            passwordHash: passwordHash!,
            role: Role.OPERATOR,
            isActive,
          },
        });
        userId = user.id;
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: AuditAction.CREATE,
            tableName: "users",
            recordId: user.id,
            newData: toJson({ name: user.name, email: user.email, role: user.role }),
          },
        });
      }

      const updated = await tx.masterDriver.update({
        where: { id },
        data: { ...mapDriver(data), userId },
      });
      const unitId = emptyToNull(data.unitId ?? null);
      await setDriverUnit(tx, id, unitId);

      const { user: _u, assignedUnit, ...oldRow } = existing;
      void _u;
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "MasterDriver",
          recordId: id,
          oldData: toJson({ ...oldRow, unitId: assignedUnit?.id ?? null }),
          newData: toJson({ ...updated, unitId }),
        },
      });
    });

    revalidateDriverPaths();
    return { success: true, data: { id } };
  } catch (err) {
    return fail(err, "Gagal update driver");
  }
}

export async function deleteDriver(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const existing = await prisma.masterDriver.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Driver tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.masterDriver.delete({ where: { id } });
      // Akun login tidak dihapus (terikat audit log) — cukup dinonaktifkan
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { isActive: false },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "MasterDriver",
          recordId: id,
          oldData: toJson(existing),
          newData: Prisma.JsonNull,
        },
      });
    });

    revalidateDriverPaths();
    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error && err.message.includes("Foreign key")
          ? "Driver masih terpakai di operasi — tidak bisa dihapus (ubah absensi ke INACTIVE)"
          : err instanceof Error
            ? err.message
            : "Gagal hapus driver",
    };
  }
}
