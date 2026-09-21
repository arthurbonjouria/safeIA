"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la création du compte");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-8"
      >
        <h1 className="text-xl font-semibold text-white">Créer un compte</h1>
        <p className="text-sm text-neutral-400">
          Le premier compte d&apos;une organisation en devient administrateur.
        </p>

        <div className="space-y-1">
          <label className="text-sm text-neutral-300">Nom</label>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-neutral-300">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-neutral-300">Mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-neutral-300">
            Organisation <span className="text-neutral-500">(optionnel — pour rejoindre une équipe existante)</span>
          </label>
          <input
            value={form.organizationName}
            onChange={(e) => set("organizationName", e.target.value)}
            placeholder="Bonjour World"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-orange-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-orange-600 px-3 py-2 font-medium text-white transition hover:bg-orange-500 disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le compte"}
        </button>

        <p className="text-center text-sm text-neutral-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-orange-400 hover:underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
