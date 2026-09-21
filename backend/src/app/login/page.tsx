"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur de connexion");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 50% -10%, rgba(249,115,22,0.12), transparent 60%)",
        }}
      />
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 shadow-2xl shadow-black/40"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div>
            <h1 className="text-lg font-semibold text-white">Connexion</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Suivi de l&apos;usage des IA en équipe
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-3 py-2.5 font-medium text-white shadow-lg shadow-orange-950/50 transition hover:from-orange-400 hover:to-orange-500 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Se connecter <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Pas de compte ?{" "}
          <Link href="/register" className="font-medium text-orange-400 hover:text-orange-300">
            Créer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}
