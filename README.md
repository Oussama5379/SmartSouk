# Aurea — AI-Powered Smart Business Suite

Aurea est une plateforme IA pensée pour les PME, avec trois capacités intégrées: **analytics**, **agent conversationnel de vente** et **assistant marketing génératif**.  
Le dépôt contient une application web Next.js complète, des APIs IA et un backend FastAPI complémentaire.

## Problématique du challenge

Les PME manquent souvent d’outils accessibles pour:

- exploiter leurs données clients et ventes,
- automatiser leur marketing,
- engager efficacement leurs prospects et clients.

Le challenge demande de concevoir une plateforme AI qui rend une PME “smart” en combinant:

1. **Smart Analytics Dashboard**  
2. **Sales Intelligence Agent**  
3. **Marketing AI Assistant**

> Exigence officielle: couvrir au minimum **2 piliers** avec profondeur et utilité réelle.

## Couverture des piliers dans ce repo

| Pilier | Attendu par le challenge | Implémentation dans Aurea |
| --- | --- | --- |
| Smart Analytics Dashboard | KPIs temps réel, insights automatiques, recommandations actionnables | `/dashboard`, `/dashboard/analytics`, `/dashboard/recommendations`, `/dashboard/tracking`, `GET/POST /api/recommendations`, `GET/POST /api/track`, `POST /api/webhooks/payment` |
| Sales Intelligence Agent | Chat conversationnel, qualification des besoins, recommandation commerciale personnalisée | Widget chat sur `/`, `POST /api/chat` (RAG catalogue + contexte session), `POST /api/qualify-lead` (lead scoring + next actions) |
| Marketing AI Assistant | Génération d’idées, textes, visuels et contenu de campagne | `/dashboard/marketing`, `POST /api/enhance-prompt`, `POST /api/generate-image`, `POST /api/generate-captions`, `POST /api/marketing/suggest-email`, `POST /api/marketing/send-email`, `GET /api/marketing/segments` |

**Statut:** ce dépôt couvre **3/3 piliers**.

## Cas d’usage démontré

Le prototype est appliqué à un **secteur e-commerce artisanal** (storefront SmartSouk):

1. Le visiteur échange avec l’agent IA pour être orienté vers des produits pertinents.
2. Les équipes suivent les performances (sessions, conversion, revenus, abandon panier, sources de trafic).
3. L’équipe marketing génère visuels, captions multi-tons et emails de campagne, puis lance l’envoi.

## Stack technique

| Couche | Technologies |
| --- | --- |
| Frontend & app | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| IA texte/conversation | Vercel AI SDK + `@ai-sdk/google` (Gemini) |
| IA image | HuggingFace Inference (`black-forest-labs/FLUX.1-schnell`, provider nscale) |
| Backend Python | FastAPI, Uvicorn, httpx, Pillow |
| Données | Neon Postgres (`sessions`, `product_events`, `orders`, `store_products`, `store_settings`) |
| Cache contexte session | Upstash Redis (optionnel) |
| Auth | Better Auth (email/password + Google OAuth optionnel) |
| Email | Nodemailer SMTP (envoi de campagnes) |

## Structure du projet

```text
Aurea/
├── app/                      # UI Next.js + routes API
│   ├── page.tsx              # storefront + chat agent
│   ├── dashboard/            # analytics, marketing, tracking, products, settings
│   └── api/                  # endpoints IA, tracking, store, auth, webhooks
├── backend/                  # API FastAPI (image/captions/health)
│   ├── main.py
│   ├── requirements.txt
│   └── routers/
├── components/               # UI components (dont le chat-widget)
├── hooks/
├── lib/                      # logique métier (store, tracking, auth, email, types)
├── db/
│   └── migrations/
└── scripts/
```

## Démarrage rapide

### 1) Application Next.js

```bash
pnpm install
```

Créez `.env.local` depuis `.env.local.example`, puis renseignez les clés.

PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Bash:

```bash
cp .env.local.example .env.local
```

Lancez l’application:

```bash
pnpm dev
```

### 2) Backend FastAPI (optionnel mais disponible)

```bash
cd backend
python -m venv .venv
```

Activation:

- Windows (PowerShell): `.\.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

Installation + run:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Assurez-vous que `HF_TOKEN` et `GEMINI_API_KEY` sont définis dans l’environnement de lancement.

## Variables d’environnement principales

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Base Neon Postgres (tracking + store + auth) |
| `BETTER_AUTH_SECRET` | Secret Better Auth (obligatoire) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` | URL applicative |
| `ADMIN_EMAILS` | Emails autorisés pour routes admin |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Modèles Gemini via `@ai-sdk/google` |
| `GEMINI_API_KEY` | Appels Gemini directs (prompt/captions/fallbacks) |
| `HF_TOKEN` | Génération d’images FLUX via HuggingFace |
| `OPENAI_API_KEY` | Optionnel (utilisé par `/api/marketing/suggest-email`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Cache contexte session (optionnel) |
| `PAYMENT_WEBHOOK_SECRET` | Sécurisation de `/api/webhooks/payment` |
| `SMTP_USER`, `SMTP_PASSWORD` | Envoi d’emails campagnes (`/api/marketing/send-email`) |

Optionnel selon configuration auth/email:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google OAuth)
- `RESEND_API_KEY`, `EMAIL_FROM` (email verification Better Auth)

## Migrations auth (si `DATABASE_URL` est configurée)

```bash
pnpm auth:generate
pnpm auth:migrate
```
