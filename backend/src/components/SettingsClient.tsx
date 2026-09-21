"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Globe, Key, Laptop, RefreshCw, User } from "lucide-react";

const REPO_ZIP_URL = "https://github.com/arthurbonjouria/safeIA/archive/refs/heads/main.zip";
const AGENT_EXE_URL = "https://github.com/arthurbonjouria/safeIA/raw/main/agent/dist/SAFEIA-Agent.exe";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

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
  const [origin, setOrigin] = useState("https://votre-app.vercel.app");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!confirm("Régénérer le token va déconnecter l'extension et l'agent existants. Continuer ?"))
      return;
    setRotating(true);
    const res = await fetch("/api/me", { method: "POST" });
    const data = await res.json();
    setRotating(false);
    if (res.ok) setToken(data.apiToken);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Paramètres</h1>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          Ton compte, ton token API et l&apos;installation des trackers
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <User className="h-4 w-4" />
          <p className="text-sm">Compte</p>
        </div>
        <p className="mt-2 text-white">{name}</p>
        <p className="text-sm text-[var(--text-muted)]">{email}</p>
        <span className="mt-2 inline-block rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-orange-400">
          {role === "ADMIN" ? "Administrateur" : "Membre"}
        </span>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Key className="h-4 w-4" />
          <p className="text-sm">Token API</p>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          À utiliser dans l&apos;extension navigateur et l&apos;agent desktop pour envoyer tes
          statistiques d&apos;usage. Ne le partage pas.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={token}
            className="flex-1 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 font-mono text-sm text-white"
          />
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white transition hover:bg-white/5"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
        <button
          onClick={rotate}
          disabled={rotating}
          className="mt-3 flex items-center gap-1.5 text-sm text-red-400 transition hover:text-red-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
          Régénérer le token
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Globe className="h-4 w-4" />
          <p className="text-sm">Extension navigateur (Chrome / Edge)</p>
        </div>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-zinc-300">
          <li>
            Télécharge le code :{" "}
            <a
              href={REPO_ZIP_URL}
              className="inline-flex items-center gap-1 font-medium text-orange-400 hover:text-orange-300"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger le ZIP
            </a>{" "}
            puis dézippe-le et repère le dossier <code className="text-orange-300">extension/</code>.
          </li>
          <li>
            Ouvre <code className="text-orange-300">chrome://extensions</code> (ou{" "}
            <code className="text-orange-300">edge://extensions</code>), active le{" "}
            <strong>Mode développeur</strong>.
          </li>
          <li>
            Clique <strong>Charger l&apos;extension non empaquetée</strong> et sélectionne le
            dossier <code className="text-orange-300">extension/</code>.
          </li>
          <li>
            Clique l&apos;icône SAFEIA dans la barre d&apos;outils, renseigne l&apos;URL du
            backend et ton token (copié ci-dessus) :
          </li>
        </ol>
        <div className="mt-2 space-y-1 pl-5">
          <p className="text-xs text-[var(--text-muted)]">URL du backend</p>
          <CodeBlock>{origin}</CodeBlock>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Laptop className="h-4 w-4" />
          <p className="text-sm">Agent desktop (Windows)</p>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Détecte l&apos;usage des applications IA installées sur ton PC (ex : app Claude, app
          ChatGPT) — jamais le contenu des conversations.
        </p>

        <div className="mt-4 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-sm font-medium text-white">Installation en 2 clics</p>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-zinc-300">
            <li>
              <a
                href={AGENT_EXE_URL}
                className="inline-flex items-center gap-1 font-medium text-orange-400 hover:text-orange-300"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger SAFEIA-Agent.exe
              </a>
            </li>
            <li>Double-clique le fichier téléchargé.</li>
            <li>
              Colle ton token (copié ci-dessus) dans la fenêtre qui s&apos;ouvre, puis clique{" "}
              <strong>Démarrer</strong>.
            </li>
          </ol>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            C&apos;est tout — il tourne en arrière-plan et se relance automatiquement à chaque
            connexion Windows. Windows peut afficher un avertissement &quot;éditeur
            inconnu&quot; (SmartScreen) car l&apos;app n&apos;est pas signée : clique{" "}
            <strong>Informations complémentaires → Exécuter quand même</strong>.
          </p>
        </div>

        <details className="mt-4 text-sm text-zinc-300">
          <summary className="cursor-pointer text-[var(--text-muted)] hover:text-white">
            Installation manuelle (avancé, nécessite Python)
          </summary>
          <ol className="mt-3 list-inside list-decimal space-y-2">
            <li>
              Télécharge le code :{" "}
              <a href={REPO_ZIP_URL} className="font-medium text-orange-400 hover:text-orange-300">
                ZIP du repo
              </a>{" "}
              et repère le dossier <code className="text-orange-300">agent/</code>.
            </li>
            <li>Installe les dépendances :</li>
          </ol>
          <div className="mt-2 pl-5">
            <CodeBlock>{"pip install -r requirements.txt"}</CodeBlock>
          </div>
          <ol start={3} className="mt-2 list-inside list-decimal space-y-2">
            <li>Configure puis lance :</li>
          </ol>
          <div className="mt-2 space-y-2 pl-5">
            <CodeBlock>
              {`python safeia_agent.py configure --api-base ${origin} --api-token ${token}`}
            </CodeBlock>
            <CodeBlock>{"python safeia_agent.py run"}</CodeBlock>
          </div>
        </details>
      </div>
    </div>
  );
}
