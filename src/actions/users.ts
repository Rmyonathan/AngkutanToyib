"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { AuditAction, Role, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import {
  canAccessUsers,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
  permissionsForRole,
} from "@/lib/auth/rbac";
import {
  loadRolePermissions,
  sanitizePermissions,
} from "@/lib/auth/role-permissions";
import type { ActionResult } from "@/lib/actions/types";
import { LOGIN_ID_REGEX } from "@/lib/auth/login-id";

const roleSchema = z.nativeEnum(Role);
const passwordSchema = z.string().min(8, "Password minimal 8 karakter");

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(LOGIN_ID_REGEX, "Email / username tidak valid (3–50 karakter, tanpa spasi)"),
  role: roleSchema,
  password: passwordSchema,
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nama wajib"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(LOGIN_ID_REGEX, "Email / username tidak valid (3–50 karakter, tanpa spasi)"),
  role: roleSchema,
});

export type CreateUserInput = z.infer<typeof createSchema>;
export type UpdateUserInput = z.infer<typeof updateSchema>;

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;

async function assertUserAdmin() {
  const session = await requireSession();
  if (!canAccessUsers(session.user.role)) {
    throw new Error("Forbidden: hanya OWNER");
  }
  return session;
}

function fail(e: unknown, fallback: string): { success: false; error: string } {
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  ) {
    return { success: false, error: "Email / username sudah dipakai user lain" };
  }
  return { success: false, error: e instanceof Error ? e.message : fallback };
}

/** Refuse changes that would leave no active OWNER */
async function assertOwnerRemains(
  tx: Prisma.TransactionClient,
  userId: string,
  next: { role: Role; isActive: boolean }
) {
  const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const losingOwner =
    current.role === Role.OWNER &&
    current.isActive &&
    (next.role !== Role.OWNER || !next.isActive);
  if (!losingOwner) return current;
  const others = await tx.user.count({
    where: { role: Role.OWNER, isActive: true, id: { not: userId } },
  });
  if (others === 0) {
    throw new Error("Minimal harus ada 1 OWNER aktif");
  }
  return current;
}

export async function createUser(
  raw: CreateUserInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertUserAdmin();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const { password, ...rest } = parsed.data;
    if (rest.role === Role.OPERATOR) {
      return {
        success: false,
        error: "Akun supir dibuat dari Master Driver (sekalian dengan data driver)",
      };
    }
    const passwordHash = await hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...rest, passwordHash },
        select: publicSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "users",
          recordId: created.id,
          newData: created,
        },
      });
      return created;
    });

    revalidatePath("/users");
    return { success: true, data: { id: user.id } };
  } catch (e) {
    return fail(e, "Gagal membuat user");
  }
}

export async function updateUser(
  raw: UpdateUserInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertUserAdmin();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const { id, ...data } = parsed.data;
    if (id === session.user.id && data.role !== Role.OWNER) {
      return { success: false, error: "Tidak bisa menurunkan role akun sendiri" };
    }

    await prisma.$transaction(async (tx) => {
      const before = await assertOwnerRemains(tx, id, {
        role: data.role,
        isActive: true,
      });
      if ((before.role === Role.OPERATOR) !== (data.role === Role.OPERATOR)) {
        throw new Error(
          "Role Operator / Supir hanya untuk akun driver — kelola dari Master Driver"
        );
      }
      const after = await tx.user.update({
        where: { id },
        data,
        select: publicSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "users",
          recordId: id,
          oldData: {
            name: before.name,
            email: before.email,
            role: before.role,
            isActive: before.isActive,
          },
          newData: after,
        },
      });
    });

    revalidatePath("/users");
    return { success: true, data: { id } };
  } catch (e) {
    return fail(e, "Gagal mengubah user");
  }
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertUserAdmin();
    if (id === session.user.id && !isActive) {
      return { success: false, error: "Tidak bisa menonaktifkan akun sendiri" };
    }

    await prisma.$transaction(async (tx) => {
      const before = await assertOwnerRemains(tx, id, {
        role: (await tx.user.findUniqueOrThrow({ where: { id } })).role,
        isActive,
      });
      await tx.user.update({ where: { id }, data: { isActive } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "users",
          recordId: id,
          oldData: { isActive: before.isActive },
          newData: { isActive },
        },
      });
    });

    revalidatePath("/users");
    return { success: true, data: { id } };
  } catch (e) {
    return fail(e, "Gagal mengubah status user");
  }
}

export async function resetUserPassword(
  id: string,
  password: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertUserAdmin();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const passwordHash = await hash(parsed.data, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "users",
          recordId: id,
          newData: { passwordReset: true },
        },
      });
    });

    revalidatePath("/users");
    return { success: true, data: { id } };
  } catch (e) {
    return fail(e, "Gagal reset password");
  }
}

// ─── Role permissions ────────────────────────────────────────────────────────

const editableRoleSchema = z
  .nativeEnum(Role)
  .refine((r) => r !== Role.OWNER, "Role Owner selalu akses penuh");

function withImplied(list: string[]): string[] {
  const out = new Set(list);
  for (const p of PERMISSION_CATALOG) {
    if (out.has(p.key)) p.implies?.forEach((i) => out.add(i));
  }
  return Array.from(out);
}

function revalidateEverything() {
  revalidatePath("/", "layout");
}

export async function saveRolePermissions(
  role: Role,
  permissions: string[]
): Promise<ActionResult<{ role: Role }>> {
  try {
    const session = await assertUserAdmin();
    const parsedRole = editableRoleSchema.safeParse(role);
    if (!parsedRole.success) {
      return { success: false, error: parsedRole.error.issues[0]?.message ?? "Role tidak valid" };
    }
    const next = sanitizePermissions(withImplied(permissions));
    if (role === session.user.role && !next.includes("users")) {
      return {
        success: false,
        error: "Tidak bisa mencabut hak Kelola User dari role Anda sendiri",
      };
    }

    const before = [...permissionsForRole(role)];
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.upsert({
        where: { role },
        create: { role, permissions: next },
        update: { permissions: next },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "role_permissions",
          recordId: role,
          oldData: { permissions: before },
          newData: { permissions: next },
        },
      });
    });

    await loadRolePermissions(true);
    revalidateEverything();
    return { success: true, data: { role } };
  } catch (e) {
    return fail(e, "Gagal menyimpan hak akses");
  }
}

export async function resetRolePermissions(
  role: Role
): Promise<ActionResult<{ role: Role }>> {
  try {
    const session = await assertUserAdmin();
    const parsedRole = editableRoleSchema.safeParse(role);
    if (!parsedRole.success) {
      return { success: false, error: parsedRole.error.issues[0]?.message ?? "Role tidak valid" };
    }
    const defaults = [...DEFAULT_ROLE_PERMISSIONS[role]];
    if (role === session.user.role && !defaults.includes("users")) {
      return {
        success: false,
        error: "Reset akan mencabut hak Kelola User dari role Anda sendiri",
      };
    }

    const before = [...permissionsForRole(role)];
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "role_permissions",
          recordId: role,
          oldData: { permissions: before },
          newData: { permissions: defaults, reset: true },
        },
      });
    });

    await loadRolePermissions(true);
    revalidateEverything();
    return { success: true, data: { role } };
  } catch (e) {
    return fail(e, "Gagal reset hak akses");
  }
}