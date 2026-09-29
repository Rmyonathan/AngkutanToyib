import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPermissionsForRole } from "@/lib/auth/role-permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      permissions: string[];
    };
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    email?: string | null;
    permissions?: string[];
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });

        if (!user?.passwordHash || !user.isActive) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.permissions = await getPermissionsForRole(user.role);
        return token;
      }

      // Re-bind id/role after DB reset (email stays; cuid changes)
      const email = token.email ?? null;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
          // Nonaktif / dihapus → token kehilangan id & role, middleware redirect ke /login
          return { ...token, id: "", role: undefined as unknown as Role, permissions: [] };
        }
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.permissions = await getPermissionsForRole(dbUser.role);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.permissions = token.permissions ?? [];
      }
      return session;
    },
  },
};
