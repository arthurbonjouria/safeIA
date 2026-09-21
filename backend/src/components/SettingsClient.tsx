"use client";

import { useState } from "react";

export default function SettingsClient({
  apiToken,
  name,
  email,
  role,
}: {
  apiToken: string;
  name: string;
  email: string;
  role: string;
}) {
  const [token, setToken] = useState(apiToken);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!confirm("Regenerer le token va deconnecter l'extension et l'agent existants. Continuer ?")) return;
    setRotating(true);
    const res = await fetch("/api/me", { method: "POST" });
    const data = await res.json();
    setRotating(false);
    if (res.ok) setToken(data.apiToken);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Paramètres</h1>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm text-neutral-400">Compte</p>
        <p className="mt-1 text-white">{name}</p>
        <p className="text-sm text-neutral-500">{email}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-orange-400">{role}</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm text-neutral-400">Token API</p>
        <p className="mt-1 text-xs text-neutral-500">
          À utiliser dans l&apos;extension navigateur et l&apos;agent desktop pour envoyer tes
          statistiques d&apos;usage. Ne le partage pas.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={token}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-white"
          />
          <button
            onClick={copy}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-800"
          >
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
        <button
          onClick={rotate}
          disabled={rotating}
          className="mt-3 text-sm text-red-400 hover:underline disabled:opacity-50"
        >
          {rotating ? "..." : "Régénérer le token"}
        </button>
      </div>
    </div>
  );
}
