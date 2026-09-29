"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COMPANY_NAME } from "@/lib/company";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email / username atau password salah.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            {COMPANY_NAME}
          </p>
          <h1 className="text-xl font-bold text-neutral-900">Masuk</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Seed: owner@toyib.local · supir: budi — password123
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-neutral-600">Email / Username</span>
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/20"
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-600">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/20"
          />
        </label>

        {error && <p className="text-sm text-neutral-900">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Memproses…" : "Login"}
        </Button>
      </form>
    </div>
  );
}
