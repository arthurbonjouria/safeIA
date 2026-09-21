# SAFEIA — Suivi d'usage des IA

Mesure le temps passé et le volume de messages envoyés sur les IA (Claude, ChatGPT, Gemini, Copilot, Perplexity, Mistral...) par chaque membre de l'équipe, avec un dashboard centralisé pour comparer les usages.

## Architecture

```
backend/     Next.js + Prisma + PostgreSQL — API d'ingestion + dashboard web (déployé sur Vercel)
extension/   Extension Chrome/Edge (Manifest V3) — détecte l'usage sur les sites IA
agent/       Script Python (Windows) — détecte l'usage des apps IA desktop natives
```

Chaque utilisateur a un **token API personnel** (visible dans Paramètres après connexion) à renseigner dans l'extension et/ou l'agent desktop. Les événements remontent vers `/api/events`, sont stockés en base, et agrégés dans le dashboard.

Un administrateur (premier compte créé dans une organisation) voit les statistiques de toute l'équipe ; les autres membres ne voient que les leurs.

## 1. Déployer le backend

1. Créer une base PostgreSQL (ex: [Vercel Postgres](https://vercel.com/storage/postgres) ou [Neon](https://neon.tech)).
2. Dans `backend/`, copier `.env.example` vers `.env.local` et renseigner `DATABASE_URL` et `JWT_SECRET` (`openssl rand -base64 32`).
3. Appliquer le schéma :
   ```bash
   cd backend
   npx prisma migrate dev --name init
   ```
4. Lancer en local : `npm run dev` puis ouvrir http://localhost:3000, créer un compte (le premier compte d'une organisation devient admin).
5. Déployer sur Vercel : `vercel` (ou via le dashboard Vercel, en connectant ce repo), en renseignant les mêmes variables d'environnement `DATABASE_URL` et `JWT_SECRET` dans les settings du projet Vercel. Exécuter `npx prisma migrate deploy` contre la base de prod avant le premier déploiement.

## 2. Installer l'extension navigateur

1. Ouvrir `chrome://extensions` (ou `edge://extensions`), activer le "Mode développeur".
2. "Charger l'extension non empaquetée" → sélectionner le dossier `extension/`.
3. Cliquer sur l'icône SAFEIA dans la barre d'outils, renseigner l'URL du backend déployé et le token API (page Paramètres du dashboard).

L'extension mesure le temps passé (onglet actif + fenêtre au premier plan) sur claude.ai, chatgpt.com, gemini.google.com, copilot.microsoft.com, perplexity.ai et chat.mistral.ai, et détecte l'envoi de messages (sans jamais lire leur contenu).

## 3. Installer l'agent desktop (Windows)

Détecte l'usage des applications IA **desktop natives** (ex: app Claude, app ChatGPT) via le titre de la fenêtre active — jamais le contenu. Les fenêtres de navigateur sont ignorées volontairement (déjà couvertes par l'extension), pour éviter les doublons.

```bash
cd agent
pip install -r requirements.txt
python safeia_agent.py configure --api-base https://votre-app.vercel.app --api-token <token depuis Paramètres>
python safeia_agent.py run
```

Pour un lancement automatique à la connexion Windows, créer une tâche planifiée (Planificateur de tâches → Créer une tâche → Déclencheur "À l'ouverture de session" → Action `pythonw.exe safeia_agent.py run`).

## Confidentialité

Ni l'extension ni l'agent ne lisent jamais le contenu des prompts ou réponses. Seules sont collectées : le temps passé, le nombre de messages envoyés (détecté par l'action d'envoi, pas par le contenu), le titre de fenêtre / domaine visité, et l'app/le site concerné.

## Prochaines étapes possibles

- Coûts réels via les API d'usage OpenAI/Anthropic (comptes API pro) en complément du tracking desktop/navigateur.
- Export CSV/Excel des statistiques.
- Alertes (ex: usage anormalement bas/haut par équipe).
- Agent desktop macOS/Linux.
- Packager l'agent en exécutable (PyInstaller) pour un déploiement sans Python sur les postes de l'équipe.
