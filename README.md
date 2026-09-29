# Sistem Manajemen Hauling Batubara (AngkutanToyibV1)

Operational & financial tracking for coal hauling — ritase, dynamic HPP, and Owner dashboard.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI primitives
- Prisma 5 + PostgreSQL (Supabase)
- NextAuth.js (credentials / RBAC)
- Recharts (dashboard charts)

## Quick start

```bash
cd AngkutanToyibV1
npm install

# 1. Set DATABASE_URL in .env (Supabase Postgres URI)
# 2. Generate client & push schema
npm run db:generate
npm run db:push
npm run db:seed

npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) after login.

### Seed accounts (password: `password123`)

| Email / username | Role |
|-------|------|
| owner@toyib.local | OWNER |
| admin@toyib.local | ADMIN |
| budi | OPERATOR (supir Budi Santoso, unit DT-01) |
| finance@toyib.local | FINANCE |

Akun supir dibuat dari **Master Driver** (username + password), bukan dari menu Users.

## Project map

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | Full domain schema (RBAC, masters, ops, audit) |
| `src/lib/calculations/hpp.ts` | Revenue / HPP / profit formulas |
| `src/actions/daily-operation.ts` | CRUD + AuditLog for ritase |
| `src/middleware.ts` | Route-level RBAC |
| `src/app/dashboard/page.tsx` | Owner command center |
| `src/lib/auth/rbac.ts` | Permission helpers |

## RBAC

- **ADMIN / OPERATOR** (+ OWNER): `/operations` input
- **FINANCE** (+ OWNER): `/settings/hpp`
- **OWNER / MANAGER / ADMIN / FINANCE**: `/dashboard`
