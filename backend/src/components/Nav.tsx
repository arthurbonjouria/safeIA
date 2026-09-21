"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Nav({ name }: { name: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-white">SAFEIA</span>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">
            Tableau de bord
          </Link>
          <Link href="/settings" className="text-sm text-neutral-400 hover:text-white">
            Paramètres
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">{name}</span>
          <button onClick={logout} className="text-sm text-neutral-400 hover:text-white">
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
